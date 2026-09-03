// The bridge protocol exists as FOUR hand-maintained copies (three separate
// npm projects, one raw script string — none can literally share a module):
//   1. miniapp-sdk/bridge/Protocol.js           (this package, canonical)
//   2. crypto-wallet/components/miniapps/bridge/Protocol.js (host runtime)
//   3. backend/src/config/miniappScopes.js       (submission validation)
//   4. backend/src/config/miniappSdkScript.js    (the /sdk/miniapp.js build)
// "Keep this in sync by hand" is exactly the kind of instruction that quietly
// stops being true. This test catches drift instead of hoping nobody forgets.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';

import { BRIDGE_METHODS as sdkMethods, BRIDGE_VERSION as sdkVersion } from '@tribe/miniapp-sdk';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '../../');

// Windows needs a real file:// URL for dynamic import() — a bare "D:\..."
// path throws ERR_UNSUPPORTED_ESM_URL_SCHEME.
const importPath = (relPath) => pathToFileURL(path.join(repoRoot, relPath)).href;

const { BRIDGE_METHODS: hostMethods, BRIDGE_VERSION: hostVersion } =
  await import(importPath('crypto-wallet/components/miniapps/bridge/Protocol.js'));

const { BRIDGE_METHODS: backendMethods } =
  await import(importPath('backend/src/config/miniappScopes.js'));

// Import the *real*, engine-evaluated MINIAPP_SDK_SCRIPT — not a regex
// scrape of the file's raw source text, which would still contain the
// template literal's own escape sequences (e.g. \\' for a literal \' in the
// generated script) unresolved, and produce exactly the kind of subtly
// wrong string that's easy to eval into a confusing syntax error instead of
// catching the drift this test exists to catch.
const { MINIAPP_SDK_SCRIPT: scriptBody } =
  await import(importPath('backend/src/config/miniappSdkScript.js'));

test('host app runtime copy matches the SDK\'s method whitelist exactly', () => {
  assert.deepEqual(hostMethods, sdkMethods);
});

test('host app runtime copy is on the same BRIDGE_VERSION as the SDK', () => {
  assert.equal(hostVersion, sdkVersion);
});

test('backend submission-validation copy matches the SDK\'s method whitelist exactly', () => {
  assert.deepEqual(backendMethods, sdkMethods);
});

// The browser-global build (served at /sdk/miniapp.js) isn't structured data
// — it's a script string with each method hand-written as a function. Can't
// diff it directly, so: evaluate it in a sandboxed window, and confirm it
// implements the exact same set of calls (namespace.method → bridge method
// name) as the real SDK, by driving both through a mock bridge and diffing
// what each one actually sent.
test('browser-global script body imported successfully and is non-trivial', () => {
  assert.ok(scriptBody && scriptBody.length > 200, 'MINIAPP_SDK_SCRIPT is a real, non-trivial script string');
});

function evalTribeSDK() {
  const calls = [];
  const sandbox = {
    window: { MiniApp: { call: (method, params) => { calls.push({ method, params }); return Promise.resolve(null); } } },
    module: { exports: {} },
  };
  vm.createContext(sandbox);
  vm.runInContext(scriptBody, sandbox);
  return { TribeSDK: sandbox.window.TribeSDK, calls };
}

test('evaluated browser-global script sets window.TribeSDK with all six namespaces', () => {
  const { TribeSDK } = evalTribeSDK();
  assert.ok(TribeSDK, 'window.TribeSDK was set by the script');
  for (const ns of ['wallet', 'guild', 'chat', 'user', 'ui', 'storage']) {
    assert.ok(TribeSDK[ns], `TribeSDK.${ns} exists`);
  }
});

test('browser-global script reports the same BRIDGE_VERSION as the SDK', () => {
  const { TribeSDK } = evalTribeSDK();
  assert.equal(TribeSDK.BRIDGE_VERSION, sdkVersion);
});

test('browser-global script calls the identical bridge method name for every one of the 13 methods', async () => {
  const { TribeSDK, calls } = evalTribeSDK();

  await TribeSDK.wallet.getAddress();
  await TribeSDK.wallet.signMessage('m');
  await TribeSDK.wallet.sendTx({ to: '0xabc', amount: '1' });
  await TribeSDK.guild.getInfo();
  await TribeSDK.guild.getMembers();
  await TribeSDK.chat.sendMessage('hi');
  await TribeSDK.user.getProfile();
  await TribeSDK.ui.showToast('hi');
  await TribeSDK.ui.close();
  await TribeSDK.ui.share('hi');
  await TribeSDK.ui.haptic();
  await TribeSDK.storage.get('k');
  await TribeSDK.storage.set('k', 'v');

  const calledMethods = calls.map((c) => c.method).sort();
  const expectedMethods = Object.keys(sdkMethods).sort();
  assert.deepEqual(calledMethods, expectedMethods);
});

test('browser-global script\'s wallet.sendTx defaults token to "native", same as the SDK', async () => {
  const { TribeSDK, calls } = evalTribeSDK();
  await TribeSDK.wallet.sendTx({ to: '0xabc', amount: '1' });
  assert.equal(calls[0].params.token, 'native');
});
