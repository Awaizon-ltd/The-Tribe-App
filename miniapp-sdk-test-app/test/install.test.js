// Verifies the package that a real `npm install @tribe/miniapp-sdk` (via the
// local file: dependency in this test app's package.json — same mechanism a
// tarball or, eventually, the public registry install would use) actually
// resolves to, and that its exported surface matches the documented API.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import TribeSDK, {
  wallet, guild, chat, user, ui, storage,
  isHostAvailable, BRIDGE_VERSION, BRIDGE_METHODS, ALL_SCOPES,
} from '@tribe/miniapp-sdk';

test('package resolves via node_modules (real npm install, not a relative hack)', async () => {
  const mod = await import('@tribe/miniapp-sdk');
  assert.ok(mod.default, 'default export exists');
});

test('default export exposes all six namespaces + isHostAvailable + BRIDGE_VERSION', () => {
  for (const key of ['wallet', 'guild', 'chat', 'user', 'ui', 'storage', 'isHostAvailable', 'BRIDGE_VERSION']) {
    assert.ok(key in TribeSDK, `TribeSDK.${key} exists`);
  }
});

test('named exports match the default export namespaces (no drift between the two)', () => {
  assert.equal(TribeSDK.wallet, wallet);
  assert.equal(TribeSDK.guild, guild);
  assert.equal(TribeSDK.chat, chat);
  assert.equal(TribeSDK.user, user);
  assert.equal(TribeSDK.ui, ui);
  assert.equal(TribeSDK.storage, storage);
  assert.equal(TribeSDK.isHostAvailable, isHostAvailable);
  assert.equal(TribeSDK.BRIDGE_VERSION, BRIDGE_VERSION);
});

test('every documented method exists and is callable', () => {
  const expected = {
    wallet: ['getAddress', 'signMessage', 'sendTx'],
    guild: ['getInfo', 'getMembers'],
    chat: ['sendMessage'],
    user: ['getProfile'],
    ui: ['showToast', 'close', 'share', 'haptic'],
    storage: ['get', 'set'],
  };
  const namespaces = { wallet, guild, chat, user, ui, storage };
  for (const [ns, methods] of Object.entries(expected)) {
    for (const method of methods) {
      assert.equal(typeof namespaces[ns][method], 'function', `${ns}.${method} is a function`);
    }
  }
});

test('BRIDGE_METHODS whitelist has exactly the 13 documented methods, no more no less', () => {
  const documented = [
    'wallet.getAddress', 'wallet.signMessage', 'wallet.sendTx',
    'guild.getMembers', 'guild.getInfo',
    'chat.sendMessage', 'user.getProfile',
    'ui.showToast', 'ui.close', 'ui.share', 'ui.haptic',
    'storage.get', 'storage.set',
  ];
  assert.deepEqual(Object.keys(BRIDGE_METHODS).sort(), documented.sort());
});

test('signMessage and sendTx are the only methods flagged requiresConfirmation', () => {
  const flagged = Object.entries(BRIDGE_METHODS)
    .filter(([, def]) => def.requiresConfirmation)
    .map(([name]) => name)
    .sort();
  assert.deepEqual(flagged, ['wallet.sendTx', 'wallet.signMessage']);
});

test('ALL_SCOPES is derived correctly from BRIDGE_METHODS (no orphan/missing scopes)', () => {
  const fromMethods = new Set(Object.values(BRIDGE_METHODS).map((m) => m.scope));
  assert.deepEqual(new Set(ALL_SCOPES), fromMethods);
});

test('BRIDGE_VERSION is a non-empty semver-ish string', () => {
  assert.match(BRIDGE_VERSION, /^\d+\.\d+$/);
});
