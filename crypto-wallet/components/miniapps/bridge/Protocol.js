// Every native<->web message follows this contract. Mini-apps never get
// raw access to native modules — only this whitelist, checked in MiniAppWebView.
export const BRIDGE_VERSION = '1.0';

export const BRIDGE_METHODS = {
  'wallet.getAddress':   { scope: 'wallet:read' },
  'wallet.signMessage':  { scope: 'wallet:sign', requiresConfirmation: true },
  'wallet.sendTx':       { scope: 'wallet:send', requiresConfirmation: true },
  'guild.getMembers':    { scope: 'guild:read' },
  'guild.getInfo':       { scope: 'guild:read' },
  'chat.sendMessage':    { scope: 'chat:write', requiresConfirmation: false },
  'user.getProfile':     { scope: 'profile:read' },
  'ui.showToast':        { scope: 'ui' },
  'ui.close':            { scope: 'ui' },
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
          id, method, params, bridgeVersion: '1.0'
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