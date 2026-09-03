// The real wallet/guild/etc. behavior only exists inside the host app's
// WebView — can't stand that up here. What we *can* fully verify in
// isolation: every SDK method calls window.MiniApp.call() with exactly the
// bridge method name and params shape the protocol defines, and correctly
// resolves/rejects based on what the bridge returns. That's the SDK's whole
// job — a thin, correct wrapper — so this is a genuine full-coverage test
// of its actual logic, not a stand-in for one.
import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { wallet, guild, chat, user, ui, storage } from '@tribe/miniapp-sdk';

let calls;

beforeEach(() => {
  calls = [];
  globalThis.window = {
    MiniApp: {
      call(method, params) {
        calls.push({ method, params });
        const mock = MOCK_RESPONSES[method];
        if (mock?.reject) return Promise.reject(new Error(mock.reject));
        return Promise.resolve(mock?.resolve ?? null);
      },
    },
  };
});

afterEach(() => {
  delete globalThis.window;
});

const MOCK_RESPONSES = {
  'wallet.getAddress': { resolve: '0x1234567890123456789012345678901234567890' },
  'wallet.signMessage': { resolve: '0xsignature' },
  'wallet.sendTx': { resolve: { hash: '0xdeadbeef' } },
  'guild.getInfo': { resolve: { id: 'g1', name: 'Test Guild' } },
  'guild.getMembers': { resolve: [{ id: 'u1' }, { id: 'u2' }] },
  'chat.sendMessage': { resolve: { id: 'm1' } },
  'user.getProfile': { resolve: { username: 'tester' } },
  'ui.showToast': { resolve: true },
  'ui.close': { resolve: true },
  'ui.share': { resolve: { action: 'sharedAction' } },
  'ui.haptic': { resolve: true },
  'storage.get': { resolve: 42 },
  'storage.set': { resolve: true },
};

// ─── Each call hits the right bridge method with the right params ──────────

test('wallet.getAddress() → MiniApp.call("wallet.getAddress", undefined)', async () => {
  const result = await wallet.getAddress();
  assert.deepEqual(calls, [{ method: 'wallet.getAddress', params: undefined }]);
  assert.equal(result, '0x1234567890123456789012345678901234567890');
});

test('wallet.signMessage(msg) → params: { message }', async () => {
  const result = await wallet.signMessage('sign this');
  assert.deepEqual(calls, [{ method: 'wallet.signMessage', params: { message: 'sign this' } }]);
  assert.equal(result, '0xsignature');
});

test('wallet.sendTx({to, amount}) → token defaults to "native"', async () => {
  const result = await wallet.sendTx({ to: '0xabc', amount: '1.5' });
  assert.deepEqual(calls, [{ method: 'wallet.sendTx', params: { to: '0xabc', amount: '1.5', token: 'native' } }]);
  assert.deepEqual(result, { hash: '0xdeadbeef' });
});

test('wallet.sendTx respects an explicit token param', async () => {
  await wallet.sendTx({ to: '0xabc', amount: '1', token: 'usdc' });
  assert.equal(calls[0].params.token, 'usdc');
});

test('guild.getInfo() → no params', async () => {
  const result = await guild.getInfo();
  assert.deepEqual(calls, [{ method: 'guild.getInfo', params: undefined }]);
  assert.deepEqual(result, { id: 'g1', name: 'Test Guild' });
});

test('guild.getMembers() → no params', async () => {
  const result = await guild.getMembers();
  assert.deepEqual(calls, [{ method: 'guild.getMembers', params: undefined }]);
  assert.equal(result.length, 2);
});

test('chat.sendMessage(text) → params: { text }', async () => {
  await chat.sendMessage('gm');
  assert.deepEqual(calls, [{ method: 'chat.sendMessage', params: { text: 'gm' } }]);
});

test('user.getProfile() → no params', async () => {
  const result = await user.getProfile();
  assert.deepEqual(calls, [{ method: 'user.getProfile', params: undefined }]);
  assert.deepEqual(result, { username: 'tester' });
});

test('ui.showToast(message) → params: { message }', async () => {
  await ui.showToast('done');
  assert.deepEqual(calls, [{ method: 'ui.showToast', params: { message: 'done' } }]);
});

test('ui.close() → no params', async () => {
  await ui.close();
  assert.deepEqual(calls, [{ method: 'ui.close', params: undefined }]);
});

test('ui.share(message, url) → both params passed through', async () => {
  const result = await ui.share('check this out', 'https://example.com');
  assert.deepEqual(calls, [{ method: 'ui.share', params: { message: 'check this out', url: 'https://example.com' } }]);
  assert.deepEqual(result, { action: 'sharedAction' });
});

test('ui.share(message) with no url → url is undefined, not a crash', async () => {
  await ui.share('no link here');
  assert.deepEqual(calls, [{ method: 'ui.share', params: { message: 'no link here', url: undefined } }]);
});

test('ui.haptic() with no arg defaults to "light"', async () => {
  await ui.haptic();
  assert.deepEqual(calls, [{ method: 'ui.haptic', params: { style: 'light' } }]);
});

test('ui.haptic(style) passes the requested style through', async () => {
  await ui.haptic('success');
  assert.deepEqual(calls, [{ method: 'ui.haptic', params: { style: 'success' } }]);
});

test('storage.get(key) → params: { key }', async () => {
  const result = await storage.get('high_score');
  assert.deepEqual(calls, [{ method: 'storage.get', params: { key: 'high_score' } }]);
  assert.equal(result, 42);
});

test('storage.set(key, value) → params: { key, value }, value can be any JSON shape', async () => {
  await storage.set('progress', { level: 3, coins: 100 });
  assert.deepEqual(calls, [{ method: 'storage.set', params: { key: 'progress', value: { level: 3, coins: 100 } } }]);
});

// ─── Rejection propagation ──────────────────────────────────────────────────

test('a bridge rejection (e.g. permission denied) propagates as a real rejected promise', async () => {
  globalThis.window.MiniApp.call = (method) => Promise.reject(new Error(`Permission denied: wallet:sign`));
  await assert.rejects(wallet.signMessage('x'), /Permission denied: wallet:sign/);
});

test('a user-rejected confirmation sheet propagates cleanly, not as an uncaught throw', async () => {
  globalThis.window.MiniApp.call = () => Promise.reject(new Error('User rejected'));
  await assert.rejects(wallet.sendTx({ to: '0xabc', amount: '1' }), /User rejected/);
});
