import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateManifest, MANIFEST_FIELDS, CATEGORIES } from '@tribe/miniapp-sdk/manifest';

const validManifest = () => ({
  name: 'Coin Flip',
  tagline: 'Double or nothing, on-chain.',
  description: 'A simple provably-fair coin flip game.',
  iconUrl: 'https://coinflip.example.com/icon.png',
  category: 'games',
  url: 'https://coinflip.example.com',
  originWhitelist: 'https://coinflip.example.com',
  requestedScopes: ['wallet:read', 'wallet:send', 'storage:read', 'storage:write'],
});

test('a well-formed manifest passes with zero errors', () => {
  const { valid, errors } = validateManifest(validManifest());
  assert.equal(valid, true);
  assert.deepEqual(errors, []);
});

test('missing required fields are each individually reported', () => {
  const { valid, errors } = validateManifest({});
  assert.equal(valid, false);
  for (const field of ['name', 'iconUrl', 'category', 'url', 'originWhitelist']) {
    assert.ok(errors.some((e) => e.includes(field)), `missing ${field} is reported`);
  }
});

test('tagline over 140 chars is rejected', () => {
  const m = { ...validManifest(), tagline: 'x'.repeat(141) };
  const { valid, errors } = validateManifest(m);
  assert.equal(valid, false);
  assert.ok(errors.some((e) => e.includes('tagline')));
});

test('unknown category is rejected, known categories all pass', () => {
  assert.equal(validateManifest({ ...validManifest(), category: 'not-a-real-category' }).valid, false);
  for (const cat of CATEGORIES) {
    assert.equal(validateManifest({ ...validManifest(), category: cat }).valid, true, `category "${cat}" is valid`);
  }
});

test('non-URL url is rejected', () => {
  const { valid, errors } = validateManifest({ ...validManifest(), url: 'not a url' });
  assert.equal(valid, false);
  assert.ok(errors.some((e) => e.toLowerCase().includes('url')));
});

test('http:// url is rejected — mini-apps must be https', () => {
  const { valid, errors } = validateManifest({ ...validManifest(), url: 'http://insecure.example.com', originWhitelist: 'http://insecure.example.com' });
  assert.equal(valid, false);
  assert.ok(errors.some((e) => e.includes('https')));
});

test('originWhitelist that does not match url\'s origin is flagged', () => {
  const { valid, errors } = validateManifest({ ...validManifest(), url: 'https://real-app.example.com', originWhitelist: 'https://someone-else.example.com' });
  assert.equal(valid, false);
  assert.ok(errors.some((e) => e.includes('originWhitelist')));
});

test('originWhitelist with a trailing /* wildcard is accepted', () => {
  const { valid } = validateManifest({ ...validManifest(), url: 'https://real-app.example.com', originWhitelist: 'https://real-app.example.com/*' });
  assert.equal(valid, true);
});

test('unknown scope in requestedScopes is rejected; every real scope is accepted', () => {
  assert.equal(
    validateManifest({ ...validManifest(), requestedScopes: ['wallet:read', 'not:a:real:scope'] }).valid,
    false,
  );
  const { ALL_SCOPES } = MANIFEST_FIELDS.requestedScopes.oneOf ? { ALL_SCOPES: MANIFEST_FIELDS.requestedScopes.oneOf } : {};
  assert.ok(Array.isArray(ALL_SCOPES) && ALL_SCOPES.length > 0);
  assert.equal(validateManifest({ ...validManifest(), requestedScopes: ALL_SCOPES }).valid, true);
});

test('requestedScopes omitted entirely is fine — it is optional, not required', () => {
  const m = validManifest();
  delete m.requestedScopes;
  assert.equal(validateManifest(m).valid, true);
});
