// config/miniappSdkScript.js
// Browser-global build of the mini-app SDK, served as a plain script at
// GET /sdk/miniapp.js — see api/v1/../sdk.routes.js. This is the
// zero-build-step install path: a developer's page just does
//   <script src="https://<this-api>/sdk/miniapp.js"></script>
// and gets `window.TribeSDK`, no bundler/npm required.
//
// Deliberately self-contained (no imports) — it's served as-is, not run
// through a bundler. Keep this in sync by hand with ../../../../miniapp-sdk/
// (the standalone, npm-installable package source — see its README; not the
// same thing as this app's own crypto-wallet/ dependency tree) and with the
// two host-side Protocol.js copies when you add a bridge method.
//
// Named `TribeSDK`, not `MiniApp` — the host app injects the raw bridge
// primitive as `window.MiniApp` before this script (or the developer's own
// code) ever runs; this wraps that, it doesn't replace it.
export const BRIDGE_VERSION = '1.1';

export const MINIAPP_SDK_SCRIPT = `
(function () {
  var BRIDGE_VERSION = '${BRIDGE_VERSION}';

  function callBridge(method, params) {
    if (typeof window === 'undefined' || !window.MiniApp) {
      return Promise.reject(new Error(
        'TribeSDK: window.MiniApp not found. This page must be opened from ' +
        'inside the host app\\'s mini-app WebView, not a regular browser tab.'
      ));
    }
    return window.MiniApp.call(method, params);
  }

  var TribeSDK = {
    BRIDGE_VERSION: BRIDGE_VERSION,
    isHostAvailable: function () {
      return typeof window !== 'undefined' && !!window.MiniApp;
    },
    wallet: {
      getAddress: function () { return callBridge('wallet.getAddress'); },
      signMessage: function (message) { return callBridge('wallet.signMessage', { message: message }); },
      sendTx: function (tx) {
        tx = tx || {};
        return callBridge('wallet.sendTx', { to: tx.to, amount: tx.amount, token: tx.token || 'native' });
      }
    },
    guild: {
      getInfo: function () { return callBridge('guild.getInfo'); },
      getMembers: function () { return callBridge('guild.getMembers'); }
    },
    chat: {
      sendMessage: function (text) { return callBridge('chat.sendMessage', { text: text }); }
    },
    user: {
      getProfile: function () { return callBridge('user.getProfile'); }
    },
    ui: {
      showToast: function (message) { return callBridge('ui.showToast', { message: message }); },
      close: function () { return callBridge('ui.close'); },
      share: function (message, url) { return callBridge('ui.share', { message: message, url: url }); },
      haptic: function (style) { return callBridge('ui.haptic', { style: style || 'light' }); }
    },
    storage: {
      get: function (key) { return callBridge('storage.get', { key: key }); },
      set: function (key, value) { return callBridge('storage.set', { key: key, value: value }); }
    }
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = TribeSDK;
  }
  window.TribeSDK = TribeSDK;
})();
`;
