// services/miniappDbService.js
// Mini-app directory + per-guild installs, backed by PostgreSQL.
import db from '../db/postgres.js';
import crypto from 'crypto';

// ─── Normalizers ────────────────────────────────────────────────────────────

function normalizeMiniApp(row) {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    tagline: row.tagline,
    description: row.description,
    icon: row.icon_url,
    iconUrl: row.icon_url,
    bannerUrl: row.banner_url,
    category: row.category,
    url: row.url,
    originWhitelist: row.origin_whitelist,
    requestedScopes: row.requested_scopes || [],
    scopes: row.requested_scopes || [], // AppSCreen.js reads `app.scopes`
    manifest: row.manifest || {},
    manifestVersion: row.manifest_version,
    sdkVersion: row.sdk_version,
    developerId: row.developer_id,
    developerName: row.developer_name,
    status: row.status,
    reviewNotes: row.review_notes,
    reviewedBy: row.reviewed_by,
    reviewedAt: row.reviewed_at,
    featured: row.featured,
    installCount: row.install_count,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function normalizeInstall(row) {
  return {
    guildId: row.guild_id,
    miniAppId: row.miniapp_id,
    grantedScopes: row.granted_scopes || [],
    installedBy: row.installed_by,
    installedAt: row.installed_at,
  };
}

// ─── Slugs ───────────────────────────────────────────────────────────────────

const slugify = (name) =>
  name.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '').slice(0, 50) ||
  crypto.randomBytes(4).toString('hex');

async function uniqueSlug(baseName) {
  const base = slugify(baseName);
  let slug = base;
  let n = 1;
  // Small tables, small n — a loop here is fine; avoids a race-prone
  // "check then insert" for the extremely common case of no collision.
  while ((await db.query('SELECT 1 FROM miniapps WHERE slug = $1', [slug])).rows.length) {
    slug = `${base}-${++n}`;
  }
  return slug;
}

// ─── Directory (public) ─────────────────────────────────────────────────────

export async function getDirectory({ category, search } = {}) {
  const clauses = [`status = 'approved'`];
  const values = [];
  if (category && category !== 'All') {
    values.push(category);
    clauses.push(`category = $${values.length}`);
  }
  if (search?.trim()) {
    values.push(`%${search.trim()}%`);
    clauses.push(`(name ILIKE $${values.length} OR tagline ILIKE $${values.length})`);
  }
  const res = await db.query(
    `SELECT * FROM miniapps WHERE ${clauses.join(' AND ')}
     ORDER BY featured DESC, install_count DESC, created_at DESC`,
    values,
  );
  return res.rows.map(normalizeMiniApp);
}

export async function getMiniAppById(id) {
  const res = await db.query('SELECT * FROM miniapps WHERE id = $1', [id]);
  return res.rows[0] ? normalizeMiniApp(res.rows[0]) : null;
}

// ─── Developer submissions ──────────────────────────────────────────────────

export async function getMyMiniApps(developerId) {
  const res = await db.query(
    'SELECT * FROM miniapps WHERE developer_id = $1 ORDER BY updated_at DESC',
    [developerId],
  );
  return res.rows.map(normalizeMiniApp);
}

export async function createMiniApp(developerId, developerName, data) {
  const {
    name, tagline, description, iconUrl, bannerUrl, category,
    url, originWhitelist, requestedScopes, manifest, manifestVersion, sdkVersion,
  } = data;

  const slug = await uniqueSlug(name);

  const res = await db.query(
    `INSERT INTO miniapps (
       slug, name, tagline, description, icon_url, banner_url, category,
       url, origin_whitelist, requested_scopes, manifest, manifest_version, sdk_version,
       developer_id, developer_name, status
     ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,'pending_review')
     RETURNING *`,
    [
      slug, name, tagline || null, description || null, iconUrl || null, bannerUrl || null,
      category || 'games', url, originWhitelist,
      JSON.stringify(requestedScopes || []), JSON.stringify(manifest || {}),
      manifestVersion || '1.0.0', sdkVersion || null,
      developerId, developerName || null,
    ],
  );
  return normalizeMiniApp(res.rows[0]);
}

// Only the developer who owns it, and only while it hasn't been approved yet
// — an already-live app needs a new review pass for changes, not a silent
// edit under users' feet. Editing bumps it back to pending_review.
export async function updateMiniApp(id, developerId, updates) {
  const owned = await db.query(
    'SELECT status FROM miniapps WHERE id = $1 AND developer_id = $2',
    [id, developerId],
  );
  if (!owned.rows[0]) return null;

  const allowed = [
    'name', 'tagline', 'description', 'icon_url', 'banner_url', 'category',
    'url', 'origin_whitelist', 'requested_scopes', 'manifest', 'manifest_version', 'sdk_version',
  ];
  const fieldMap = {
    iconUrl: 'icon_url', bannerUrl: 'banner_url', originWhitelist: 'origin_whitelist',
    requestedScopes: 'requested_scopes', manifestVersion: 'manifest_version', sdkVersion: 'sdk_version',
  };
  const sets = [];
  const values = [];
  for (const [key, val] of Object.entries(updates)) {
    const col = fieldMap[key] || key;
    if (!allowed.includes(col)) continue;
    values.push(col === 'requested_scopes' || col === 'manifest' ? JSON.stringify(val) : val);
    sets.push(`${col} = $${values.length}`);
  }
  if (!sets.length) return getMiniAppById(id);

  sets.push(`status = 'pending_review'`, `updated_at = NOW()`);
  values.push(id, developerId);
  const res = await db.query(
    `UPDATE miniapps SET ${sets.join(', ')}
     WHERE id = $${values.length - 1} AND developer_id = $${values.length}
     RETURNING *`,
    values,
  );
  return res.rows[0] ? normalizeMiniApp(res.rows[0]) : null;
}

export async function deleteMiniApp(id, developerId) {
  const res = await db.query(
    'DELETE FROM miniapps WHERE id = $1 AND developer_id = $2 RETURNING id',
    [id, developerId],
  );
  return !!res.rows[0];
}

// ─── Review (admin) ──────────────────────────────────────────────────────────

export async function reviewMiniApp(id, reviewerId, { status, reviewNotes }) {
  if (!['approved', 'rejected', 'suspended'].includes(status)) {
    throw new Error(`Invalid review status: ${status}`);
  }
  const res = await db.query(
    `UPDATE miniapps
     SET status = $1, review_notes = $2, reviewed_by = $3, reviewed_at = NOW(), updated_at = NOW()
     WHERE id = $4
     RETURNING *`,
    [status, reviewNotes || null, reviewerId, id],
  );
  return res.rows[0] ? normalizeMiniApp(res.rows[0]) : null;
}

export async function getPendingReview() {
  const res = await db.query(
    `SELECT * FROM miniapps WHERE status = 'pending_review' ORDER BY created_at ASC`,
  );
  return res.rows.map(normalizeMiniApp);
}

// ─── Guild installs ──────────────────────────────────────────────────────────

export async function getGuildMiniApps(guildId) {
  const res = await db.query(
    `SELECT m.*, gm.granted_scopes, gm.installed_by, gm.installed_at
     FROM guild_miniapps gm
     JOIN miniapps m ON m.id = gm.miniapp_id
     WHERE gm.guild_id = $1
     ORDER BY gm.installed_at DESC`,
    [guildId],
  );
  return res.rows.map((row) => ({
    ...normalizeMiniApp(row),
    // Scopes actually usable in this guild — install-time grant, which may
    // be a subset of what the app originally requested.
    requestedScopes: row.requested_scopes || [],
    scopes: row.granted_scopes || [],
    installedBy: row.installed_by,
    installedAt: row.installed_at,
  }));
}

export async function installMiniApp(guildId, miniAppId, installedBy, grantedScopes) {
  const app = await getMiniAppById(miniAppId);
  if (!app) throw new Error('Mini-app not found');
  if (app.status !== 'approved') throw new Error('This mini-app is not approved for use yet');

  // Never grant more than the developer actually requested/declared.
  const scopes = (grantedScopes || app.requestedScopes)
    .filter((s) => app.requestedScopes.includes(s));

  const client = await db.getClient();
  try {
    await client.query('BEGIN');
    const res = await client.query(
      `INSERT INTO guild_miniapps (guild_id, miniapp_id, granted_scopes, installed_by)
       VALUES ($1,$2,$3,$4)
       ON CONFLICT (guild_id, miniapp_id)
       DO UPDATE SET granted_scopes = $3, installed_by = $4, installed_at = NOW()
       RETURNING *`,
      [guildId, miniAppId, JSON.stringify(scopes), installedBy],
    );
    await client.query(
      `UPDATE miniapps SET install_count = install_count + 1 WHERE id = $1`,
      [miniAppId],
    );
    await client.query('COMMIT');
    return normalizeInstall(res.rows[0]);
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}

export async function uninstallMiniApp(guildId, miniAppId) {
  const res = await db.query(
    'DELETE FROM guild_miniapps WHERE guild_id = $1 AND miniapp_id = $2 RETURNING miniapp_id',
    [guildId, miniAppId],
  );
  return !!res.rows[0];
}

// ─── Per-user storage (bridge storage.get/storage.set) ──────────────────────

export async function getStorage(miniAppId, userId, key) {
  const res = await db.query(
    'SELECT value FROM miniapp_storage WHERE miniapp_id = $1 AND user_id = $2 AND key = $3',
    [miniAppId, userId, key],
  );
  return res.rows[0]?.value ?? null;
}

export async function setStorage(miniAppId, userId, key, value) {
  await db.query(
    `INSERT INTO miniapp_storage (miniapp_id, user_id, key, value)
     VALUES ($1,$2,$3,$4)
     ON CONFLICT (miniapp_id, user_id, key) DO UPDATE SET value = $4, updated_at = NOW()`,
    [miniAppId, userId, key, JSON.stringify(value)],
  );
  return true;
}

export default {
  getDirectory, getMiniAppById, getMyMiniApps, createMiniApp, updateMiniApp, deleteMiniApp,
  reviewMiniApp, getPendingReview,
  getGuildMiniApps, installMiniApp, uninstallMiniApp,
  getStorage, setStorage,
};
