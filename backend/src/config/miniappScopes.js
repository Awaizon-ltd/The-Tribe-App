// config/miniappScopes.js
// Backend's copy of the bridge method whitelist — kept in sync by hand with
// miniapp-sdk/bridge/Protocol.js at the repo root (the standalone,
// npm-installable SDK's canonical copy) and
// crypto-wallet/components/miniapps/bridge/Protocol.js (the host app's
// runtime copy). Three separate projects, so it can't be a literal shared
// import; if you add a method, add it in all three places.
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
