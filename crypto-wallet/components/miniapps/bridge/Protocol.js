// Every native<->web message follows this contract. Mini-apps never get
// raw access to native modules — only this whitelist, checked in MiniAppWebView.
//
// Canonical copy: miniapp-sdk/bridge/Protocol.js at the repo root (the
// standalone, npm-installable SDK package — separate from this app's own
// dependency tree). Keep this one in sync by hand when adding a method.
export const BRIDGE_VERSION = '1.1';

export const BRIDGE_METHODS = {
  'wallet.getAddress':  { scope: 'wallet:read' },
  'wallet.signMessage': { scope: 'wallet:sign',  requiresConfirmation: true },
  'wallet.sendTx':       { scope: 'wallet:send',  requiresConfirmation: true },
  'tribe.getMembers':   { scope: 'tribe:read' },
  'tribe.getInfo':      { scope: 'tribe:read' },
  'chat.sendMessage':   { scope: 'chat:write' },
  'user.getProfile':    { scope: 'profile:read' },
  'ui.showToast':       { scope: 'ui' },
  'ui.close':           { scope: 'ui' },
  'ui.share':           { scope: 'ui' },
  'ui.haptic':          { scope: 'ui' },
  'storage.get':        { scope: 'storage:read' },
  'storage.set':        { scope: 'storage:write' },
};

export const MINI_APP_SDK_SOURCE = `
(function() {
  let requestId = 0;
  const pending = {};

  window.MiniApp = {
    call(method, params) {
      return new Promise((resolve, reject) => {
        const id = ++requestId;
        pending[id] = { resolve, reject };
        window.ReactNativeWebView.postMessage(JSON.stringify({
          id, method, params, bridgeVersion: '${BRIDGE_VERSION}'
        }));
      });
    }
  };

  window.__onBridgeResponse = function(id, error, result) {
    const p = pending[id];
    if (!p) return;
    delete pending[id];
    error ? p.reject(new Error(error)) : p.resolve(result);
  };
})();
true;
`;
