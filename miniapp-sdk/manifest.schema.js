// miniapp/manifest.schema.js
// The manifest is what you submit (via POST /miniapps) to list a mini-app.
// It's also the source of truth the App Store screen renders from — name,
// icon, tagline, and requestedScopes all show up there verbatim, so treat
// them as user-facing copy, not internal metadata.
import { ALL_SCOPES } from './bridge/Protocol.js';

export const CATEGORIES = ['games', 'utilities', 'finance', 'social'];

export const MANIFEST_FIELDS = {
  name:            { type: 'string', required: true, maxLength: 100 },
  tagline:         { type: 'string', maxLength: 140 },        // one line, shown on cards
  description:     { type: 'string', maxLength: 2000 },       // shown on the app's detail view
  iconUrl:         { type: 'string', required: true },        // square, ≥256px recommended
  bannerUrl:       { type: 'string' },                        // shown for featured placement
  category:        { type: 'string', required: true, oneOf: CATEGORIES },
  url:             { type: 'string', required: true },        // entry point loaded in the WebView
  originWhitelist: { type: 'string', required: true },        // must match `url`'s origin exactly
  requestedScopes: { type: 'array', items: 'string', oneOf: ALL_SCOPES },
  manifestVersion: { type: 'string', default: '1.0.0' },
  sdkVersion:      { type: 'string' },                        // BRIDGE_VERSION you built against
};

const isUrl = (s) => { try { new URL(s); return true; } catch { return false; } };

/**
 * Validates a manifest object before you submit it. Same rules the backend
 * re-checks server-side — this just lets you fail fast in your own tooling.
 * @returns {{ valid: boolean, errors: string[] }}
 */
export function validateManifest(manifest) {
  const errors = [];
  const m = manifest || {};

  for (const [field, rules] of Object.entries(MANIFEST_FIELDS)) {
    const value = m[field];
    if (rules.required && (value === undefined || value === null || value === '')) {
      errors.push(`${field} is required`);
      continue;
    }
    if (value === undefined || value === null) continue;

    if (rules.type === 'string' && typeof value !== 'string') {
      errors.push(`${field} must be a string`);
    } else if (rules.type === 'array' && !Array.isArray(value)) {
      errors.push(`${field} must be an array`);
    }
    if (rules.maxLength && typeof value === 'string' && value.length > rules.maxLength) {
      errors.push(`${field} must be ${rules.maxLength} characters or fewer`);
    }
    if (rules.oneOf && rules.type !== 'array' && !rules.oneOf.includes(value)) {
      errors.push(`${field} must be one of: ${rules.oneOf.join(', ')}`);
    }
    if (rules.oneOf && rules.type === 'array' && Array.isArray(value)) {
      const bad = value.filter((v) => !rules.oneOf.includes(v));
      if (bad.length) errors.push(`${field} contains unknown value(s): ${bad.join(', ')}`);
    }
  }

  if (m.url && !isUrl(m.url)) errors.push('url must be a valid absolute URL (https://...)');
  if (m.url && isUrl(m.url) && new URL(m.url).protocol !== 'https:') {
    errors.push('url must use https — mini-apps cannot load over plain http');
  }
  if (m.url && m.originWhitelist && isUrl(m.url)) {
    const urlOrigin = new URL(m.url).origin;
    if (m.originWhitelist !== urlOrigin && m.originWhitelist !== `${urlOrigin}/*`) {
      errors.push(`originWhitelist ("${m.originWhitelist}") should match url's origin ("${urlOrigin}")`);
    }
  }

  return { valid: errors.length === 0, errors };
}
