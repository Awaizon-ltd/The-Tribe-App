// Every mini-app dev's first run is outside the host WebView (plain browser
// dev server, or here, plain Node). Every method must fail loud and clear
// rather than hang or throw something cryptic.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { wallet, guild, chat, user, ui, storage, isHostAvailable } from '@tribe/miniapp-sdk';

test('isHostAvailable() is false with no window', () => {
  assert.equal(typeof window, 'undefined'); // sanity: we really are host-less here
  assert.equal(isHostAvailable(), false);
});

test('isHostAvailable() is also false when window exists but has no MiniApp', () => {
  globalThis.window = {};
  try {
    assert.equal(isHostAvailable(), false);
  } finally {
    delete globalThis.window;
  }
});

const ALL_CALLS = [
  ['wallet.getAddress', () => wallet.getAddress()],
  ['wallet.signMessage', () => wallet.signMessage('hello')],
  ['wallet.sendTx', () => wallet.sendTx({ to: '0xabc', amount: '1' })],
  ['guild.getInfo', () => guild.getInfo()],
  ['guild.getMembers', () => guild.getMembers()],
  ['chat.sendMessage', () => chat.sendMessage('hi')],
  ['user.getProfile', () => user.getProfile()],
  ['ui.showToast', () => ui.showToast('hi')],
  ['ui.close', () => ui.close()],
  ['ui.share', () => ui.share('hi')],
  ['ui.haptic', () => ui.haptic()],
  ['storage.get', () => storage.get('k')],
  ['storage.set', () => storage.set('k', 'v')],
];

for (const [name, call] of ALL_CALLS) {
  test(`${name} rejects with a clear "must run inside host" error, not a hang/crash`, async () => {
    await assert.rejects(call(), (err) => {
      assert.ok(err instanceof Error, 'rejects with a real Error object');
      assert.match(err.message, /window\.MiniApp not found/i);
      return true;
    });
  });
}
