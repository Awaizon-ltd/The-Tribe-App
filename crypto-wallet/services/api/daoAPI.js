// services/api/daoAPI.js
import axios from 'axios';
import { APP_CONFIG } from '../../constants/Config';

// ─── Shared axios instance ────────────────────────────────────────────────────
const http = axios.create({
  baseURL: APP_CONFIG.BACKEND_URL,
  timeout: 12_000,
  headers: { 'Content-Type': 'application/json' },
});

http.interceptors.request.use(
  (config) => config,
  (err) => Promise.reject(err),
);

// ─── Retry logic (network errors and 5xx only, never on 4xx) ─────────────────
const MAX_RETRIES   = 2;
const RETRY_DELAY   = 800; // ms

http.interceptors.response.use(
  (res) => res,
  async (err) => {
    const config = err.config;
    const status = err.response?.status;
    const body   = err.response?.data;
    const url    = config?.url ?? '(unknown)';

    // Log once
    if (status) {
      console.error(`[daoAPI] HTTP ${status} on ${url}`, body);
    } else if (err.request) {
      console.error(`[daoAPI] No response from ${url} — unreachable or timeout`);
    } else {
      console.error(`[daoAPI] Request setup error: ${err.message}`);
    }

    // Retry on network errors and 5xx (not 4xx — those are caller mistakes)
    const retryable = !status || status >= 500;
    config._retryCount = config._retryCount ?? 0;

    if (retryable && config._retryCount < MAX_RETRIES) {
      config._retryCount += 1;
      const delay = RETRY_DELAY * config._retryCount;
      console.warn(`[daoAPI] Retry ${config._retryCount}/${MAX_RETRIES} in ${delay}ms for ${url}`);
      await new Promise(r => setTimeout(r, delay));
      return http(config);
    }

    return Promise.reject(err);
  },
);

// ─── Response normaliser ──────────────────────────────────────────────────────
// All list endpoints return { success, data: [...], count, offset, limit }.
// This helper asserts that shape and gives a clear error if the backend changes.
function parseListResponse(res, label) {
  const body = res.data;

  if (!body?.success) {
    throw new Error(`[daoAPI] ${label}: backend returned success=false — ${body?.error ?? 'unknown'}`);
  }

  const items = Array.isArray(body.data) ? body.data : [];
  const count  = typeof body.count === 'number' ? body.count : items.length;

  return { items, count, offset: body.offset ?? 0, limit: body.limit ?? items.length };
}

// ─── In-flight deduplication ──────────────────────────────────────────────────
// Prevents duplicate requests when the chain changes mid-flight or the component
// re-mounts rapidly. Key = `${method}:${url}`.
const inflight = new Map();

function deduped(key, requestFn) {
  if (inflight.has(key)) return inflight.get(key);
  const promise = requestFn().finally(() => inflight.delete(key));
  inflight.set(key, promise);
  return promise;
}

// ─── Public API ───────────────────────────────────────────────────────────────

class DaoApiService {
  // ── Fetch all DAOs for a chain ─────────────────────────────────────────────
  // Primary method used by useDaoFactory. Returns a plain array — no cursor, no
  // pagination state. The caller decides what to do with the list.
  async fetchDAOsForChain(chainId, limit = 500) {
    const url = `/daos/chain/${chainId}?offset=0&limit=${limit}`;

    return deduped(`GET:${url}`, async () => {
      console.log(`[daoAPI] fetchDAOsForChain → ${url}`);
      const res = parseListResponse(await http.get(url), 'fetchDAOsForChain');
      console.log(`[daoAPI] fetchDAOsForChain ✅ ${res.items.length} DAOs (total=${res.count})`);
      return res.items;
    });
  }

  // ── Fetch with pagination (kept for legacy screens) ────────────────────────
  async fetchDAOs(chainId, options = {}) {
    const { page = 1, limit = 20, genre = null } = options;
    const offset = (page - 1) * limit;

    const params = new URLSearchParams({ offset: String(offset), limit: String(limit) });
    if (genre != null) params.append('genre', String(genre));

    const url = `/daos/chain/${chainId}?${params}`;

    console.log(`[daoAPI] fetchDAOs → ${url}`);
    const res = parseListResponse(await http.get(url), 'fetchDAOs');
    const totalPages  = Math.ceil(res.count / limit) || 1;
    const currentPage = Math.floor(res.offset / limit) + 1;

    console.log(`[daoAPI] fetchDAOs ✅ ${res.items.length}/${res.count} DAOs`);

    return {
      daos: res.items,
      pagination: { currentPage, totalPages, totalDAOs: res.count, hasMore: res.offset + res.items.length < res.count },
    };
  }

  // ── Fetch a single DAO's cached metadata ──────────────────────────────────
  // Note: on-chain governance data (proposals, voting power) is always fetched
  // directly from the contract by useDAOContract — this only returns the
  // PostgreSQL-cached record (name, image, genre, etc.).
  async fetchDAODetails(daoAddress, chainId) {
    const url = `/daos/${chainId}/${daoAddress}`;
    console.log(`[daoAPI] fetchDAODetails → ${url}`);

    const res = await http.get(url, { timeout: 10_000 });

    // Backend returns { success, data: { ...dao, offChain: {...} } }
    const dao = res.data?.data;
    if (!dao) throw new Error(`[daoAPI] fetchDAODetails: empty response for ${daoAddress}`);

    console.log(`[daoAPI] fetchDAODetails ✅ ${dao.dao_name ?? dao.daoName}`);
    return dao;
  }

  // ── DAOs by genre (paginated) ──────────────────────────────────────────────
  async fetchDAOsByGenre(chainId, genreId, options = {}) {
    const { page = 1, limit = 20 } = options;
    const offset = (page - 1) * limit;

    const url = `/daos/genre/${chainId}/${genreId}?offset=${offset}&limit=${limit}`;
    console.log(`[daoAPI] fetchDAOsByGenre → ${url}`);

    const res = parseListResponse(await http.get(url), 'fetchDAOsByGenre');
    console.log(`[daoAPI] fetchDAOsByGenre ✅ ${res.items.length} DAOs`);

    return {
      daos: res.items,
      pagination: {
        currentPage:  Math.floor(res.offset / limit) + 1,
        totalPages:   Math.ceil(res.count / limit) || 1,
        totalDAOs:    res.count,
        hasMore:      res.offset + res.items.length < res.count,
      },
    };
  }

  // ── Register a freshly deployed DAO ───────────────────────────────────────
  // Fire-and-forget from LaunchDaoScreen. Failure is non-fatal because the DAO
  // is already on-chain; the next poll will pick it up anyway.
  async registerDAO(daoAddress, chainId, txHash, creator, offChainData = {}) {
    try {
      console.log(`[daoAPI] registerDAO ${daoAddress} on chain ${chainId}`);

      const res = await http.post(
        '/daos/register',
        { daoAddress, chainId, txHash, creator, offChainData },
        { timeout: 20_000 },
      );

      console.log('[daoAPI] registerDAO ✅');
      return res.data?.data ?? null;
    } catch (err) {
      // Log but don't propagate — caller treats this as best-effort
      console.warn(`[daoAPI] registerDAO failed (non-fatal): ${err.message}`);
      return null;
    }
  }

  // ── Supported chains ──────────────────────────────────────────────────────
  async getChains() {
    const res = await http.get('/chains', { timeout: 10_000 });
    // Backend: { success, count, data: [...chains] }
    return Array.isArray(res.data?.data) ? res.data.data : [];
  }

  // ── Global stats ──────────────────────────────────────────────────────────
  async getStats() {
    const res = await http.get('/stats', { timeout: 10_000 });
    return res.data ?? {};
  }

  // ── Health check — use this to verify backend reachability ────────────────
  async ping() {
    try {
      const res = await axios.get(
        `${APP_CONFIG.BACKEND_URL.replace(/\/v1$/, '')}/health`,
        { timeout: 5_000 },
      );
      return { ok: true, uptime: res.data?.uptime };
    } catch {
      return { ok: false };
    }
  }

  // ── Cache bust (debug) ────────────────────────────────────────────────────
  async clearCache(chainId) {
    const res = await http.post('/cache/clear', chainId ? { chainId } : {}, { timeout: 10_000 });
    return res.data;
  }
}

export default new DaoApiService();
