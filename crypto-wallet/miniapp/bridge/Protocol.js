// miniapps/bridge/protocol.js
// Every native→web and web→native message follows this shape.
// Mini-apps NEVER get raw access to native modules — only this whitelist.

export const BRIDGE_VERSION = '1.0';

// Methods a mini-app can call. Each maps to a permission scope.
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