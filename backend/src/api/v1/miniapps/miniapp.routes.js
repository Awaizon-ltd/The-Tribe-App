import express from 'express';
import { requireAuth, optionalAuth } from '../../../middleware/auth/guild.js';
import { requireAdmin } from '../../../middleware/auth/admin.js';
import miniappDb from '../../../services/miniappDbService.js';
import guildDb   from '../../../services/guildDbService.js';
import { BRIDGE_METHODS } from '../../../config/miniappScopes.js';
import logger from '../../../utils/logger.js';

const router = express.Router();

const ok  = (res, data, extra = {}) => res.json({ success: true, data, ...extra });
const err = (res, status, msg)      => res.status(status).json({ success: false, error: msg });

const VALID_SCOPES = new Set(Object.values(BRIDGE_METHODS).map((m) => m.scope));

// ─── Public directory ───────────────────────────────────────────────────────

router.get('/miniapps/directory', optionalAuth, async (req, res) => {
  try {
    const { category, search } = req.query;
    const apps = await miniappDb.getDirectory({ category, search });
    ok(res, apps);
  } catch (e) { logger.error('GET /miniapps/directory:', e); err(res, 500, e.message); }
});

router.get('/miniapps/:id', optionalAuth, async (req, res) => {
  try {
    const app = await miniappDb.getMiniAppById(req.params.id);
    if (!app) return err(res, 404, 'Mini-app not found');
    // Non-owners/non-admins only ever see approved apps through this route.
    const isOwner = req.uid && app.developerId === req.uid;
    if (app.status !== 'approved' && !isOwner) return err(res, 404, 'Mini-app not found');
    ok(res, app);
  } catch (e) { err(res, 500, e.message); }
});

// ─── Developer submissions ──────────────────────────────────────────────────

router.get('/miniapps/mine', requireAuth, async (req, res) => {
  try {
    ok(res, await miniappDb.getMyMiniApps(req.uid));
  } catch (e) { err(res, 500, e.message); }
});

router.post('/miniapps', requireAuth, async (req, res) => {
  try {
    const { name, url, originWhitelist, requestedScopes } = req.body;
    if (!name?.trim())        return err(res, 400, 'name is required');
    if (!url?.trim())         return err(res, 400, 'url is required');
    if (!originWhitelist?.trim()) return err(res, 400, 'originWhitelist is required');
    const scopes = requestedScopes || [];
    const badScope = scopes.find((s) => !VALID_SCOPES.has(s));
    if (badScope) return err(res, 400, `Unknown scope: ${badScope}`);

    const app = await miniappDb.createMiniApp(req.uid, req.body.developerName, req.body);
    ok(res, app);
  } catch (e) { logger.error('POST /miniapps:', e); err(res, 500, e.message); }
});

router.put('/miniapps/:id', requireAuth, async (req, res) => {
  try {
    if (req.body.requestedScopes) {
      const badScope = req.body.requestedScopes.find((s) => !VALID_SCOPES.has(s));
      if (badScope) return err(res, 400, `Unknown scope: ${badScope}`);
    }
    const updated = await miniappDb.updateMiniApp(req.params.id, req.uid, req.body);
    if (!updated) return err(res, 403, 'Not authorized or mini-app not found');
    ok(res, updated);
  } catch (e) { err(res, 500, e.message); }
});

router.delete('/miniapps/:id', requireAuth, async (req, res) => {
  try {
    const deleted = await miniappDb.deleteMiniApp(req.params.id, req.uid);
    if (!deleted) return err(res, 403, 'Not authorized or mini-app not found');
    ok(res, { deleted: true });
  } catch (e) { err(res, 500, e.message); }
});

// ─── Review queue (admin) ────────────────────────────────────────────────────

router.get('/miniapps/admin/pending', requireAuth, requireAdmin, async (req, res) => {
  try {
    ok(res, await miniappDb.getPendingReview());
  } catch (e) { err(res, 500, e.message); }
});

router.post('/miniapps/:id/review', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { status, reviewNotes } = req.body;
    const app = await miniappDb.reviewMiniApp(req.params.id, req.uid, { status, reviewNotes });
    if (!app) return err(res, 404, 'Mini-app not found');
    ok(res, app);
  } catch (e) { err(res, 400, e.message); }
});

// ─── Guild installs ──────────────────────────────────────────────────────────

router.get('/guilds/:guildId/miniapps', optionalAuth, async (req, res) => {
  try {
    ok(res, await miniappDb.getGuildMiniApps(req.params.guildId));
  } catch (e) { err(res, 500, e.message); }
});

router.post('/guilds/:guildId/miniapps/:miniAppId/install', requireAuth, async (req, res) => {
  try {
    const { guildId, miniAppId } = req.params;
    const guild = await guildDb.getGuildById(guildId);
    if (!guild) return err(res, 404, 'Guild not found');
    if (guild.createdBy !== req.uid) return err(res, 403, 'Only the guild owner can install apps');

    const install = await miniappDb.installMiniApp(guildId, miniAppId, req.uid, req.body?.scopes);
    ok(res, install);
  } catch (e) {
    err(res, e.message.includes('not found') || e.message.includes('not approved') ? 400 : 500, e.message);
  }
});

router.delete('/guilds/:guildId/miniapps/:miniAppId', requireAuth, async (req, res) => {
  try {
    const { guildId, miniAppId } = req.params;
    const guild = await guildDb.getGuildById(guildId);
    if (!guild) return err(res, 404, 'Guild not found');
    if (guild.createdBy !== req.uid) return err(res, 403, 'Only the guild owner can remove apps');

    const removed = await miniappDb.uninstallMiniApp(guildId, miniAppId);
    ok(res, { removed });
  } catch (e) { err(res, 500, e.message); }
});

// ─── Per-user save data (bridge storage.get / storage.set) ─────────────────

router.get('/miniapps/:id/storage/:key', requireAuth, async (req, res) => {
  try {
    const value = await miniappDb.getStorage(req.params.id, req.uid, req.params.key);
    ok(res, { value });
  } catch (e) { err(res, 500, e.message); }
});

router.put('/miniapps/:id/storage/:key', requireAuth, async (req, res) => {
  try {
    await miniappDb.setStorage(req.params.id, req.uid, req.params.key, req.body?.value ?? null);
    ok(res, { saved: true });
  } catch (e) { err(res, 500, e.message); }
});

export default router;
