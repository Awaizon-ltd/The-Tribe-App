// middleware/auth/admin.js
// Minimal admin gate — a comma-separated allowlist of Firebase UIDs in
// ADMIN_UIDS. Good enough for "who can review mini-app submissions" without
// standing up a full roles table; revisit if admin surface area grows.
import { env } from '../../config/env.js';

const adminUids = () =>
  (env.ADMIN_UIDS || '').split(',').map((s) => s.trim()).filter(Boolean);

export function requireAdmin(req, res, next) {
  if (!req.uid) {
    return res.status(401).json({ success: false, error: 'Missing authorization token' });
  }
  if (!adminUids().includes(req.uid)) {
    return res.status(403).json({ success: false, error: 'Admin access required' });
  }
  next();
}
