// miniapp/bridge/Protocol.js
// Every native→web and web→native message follows this shape.
// Mini-apps NEVER get raw access to native modules — only this whitelist.
//
// This file is the SDK's canonical copy. Two other copies exist and must be
// kept in sync by hand (three separate projects, so no literal shared import):
//   - crypto-wallet/components/miniapps/bridge/Protocol.js (host app runtime)
//   - backend/src/config/miniappScopes.js (submission validation)

export const BRIDGE_VERSION = '1.1';

// Methods a mini-app can call. Each maps to a permission scope — the scopes
// a tribe owner actually grants at install time (a subset of what the app
// requests in its manifest) are what MiniApp.call() is allowed to use.
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

// All scope strings a manifest's `requestedScopes` may contain.
export const ALL_SCOPES = Array.from(new Set(Object.values(BRIDGE_METHODS).map((m) => m.scope)));

// Injected into the WebView before content loads. Defines window.MiniApp —
// the raw call() primitive. The published SDK (miniapp/index.js) wraps this
// in a friendlier typed-feeling API; mini-apps can also use window.MiniApp
// directly without the SDK if they'd rather not add the dependency.
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
