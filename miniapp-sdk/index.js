// miniapp/index.js
// @tribe/miniapp-sdk — the client library mini-app developers use inside
// their own web page. It talks to the host app through window.MiniApp,
// which the host injects before your page loads (see bridge/Protocol.js
// for the wire format, if you'd rather skip this package and call
// window.MiniApp.call(...) directly — it's a thin, optional convenience
// layer, not a requirement).
import { BRIDGE_VERSION, BRIDGE_METHODS, ALL_SCOPES } from './bridge/Protocol.js';

function callBridge(method, params) {
  if (typeof window === 'undefined' || !window.MiniApp) {
    return Promise.reject(new Error(
      `MiniApp SDK: window.MiniApp not found. This page must run inside the ` +
      `host app's mini-app WebView — open it from the app, not a regular browser.`,
    ));
  }
  return window.MiniApp.call(method, params);
}

// ─── wallet ─────────────────────────────────────────────────────────────────
// wallet.signMessage / wallet.sendTx show the user a native confirmation
// sheet with your app's name and the action's plain-English details — you
// cannot skip or customize that sheet, by design.
export const wallet = {
  getAddress: () => callBridge('wallet.getAddress'),
  signMessage: (message) => callBridge('wallet.signMessage', { message }),
  /** @param {{to: string, amount: string|number, token?: 'native'}} tx */
  sendTx: ({ to, amount, token = 'native' }) => callBridge('wallet.sendTx', { to, amount, token }),
};

// ─── tribe ──────────────────────────────────────────────────────────────────
// Only populated when your app was opened from inside a tribe — check
// tribe.getInfo() for null if your app also runs standalone from the
// global App Store tab.
export const tribe = {
  getInfo: () => callBridge('tribe.getInfo'),
  getMembers: () => callBridge('tribe.getMembers'),
};

// ─── chat ───────────────────────────────────────────────────────────────────
export const chat = {
  sendMessage: (text) => callBridge('chat.sendMessage', { text }),
};

// ─── user ───────────────────────────────────────────────────────────────────
export const user = {
  getProfile: () => callBridge('user.getProfile'),
};

// ─── ui ─────────────────────────────────────────────────────────────────────
export const ui = {
  showToast: (message) => callBridge('ui.showToast', { message }),
  /** Closes your mini-app and returns to the app store / tribe. */
  close: () => callBridge('ui.close'),
  /** @param {string} message @param {string} [url] */
  share: (message, url) => callBridge('ui.share', { message, url }),
  /** @param {'light'|'medium'|'heavy'|'success'|'warning'|'error'} [style] */
  haptic: (style = 'light') => callBridge('ui.haptic', { style }),
};

// ─── storage ────────────────────────────────────────────────────────────────
// Per-user, per-app key/value store — a good fit for a high score, save
// slot, or settings. Not tribe-scoped: the same player's data follows them
// into every tribe that installs your app, and into the global App Store
// listing if it's there too.
export const storage = {
  get: (key) => callBridge('storage.get', { key }),
  set: (key, value) => callBridge('storage.set', { key, value }),
};

/** True once the host bridge is ready — use to gate rendering, or to fall
 *  back to a "preview mode" (e.g. a demo/local-storage save) when someone
 *  opens your URL directly in a normal browser during development. */
export const isHostAvailable = () => typeof window !== 'undefined' && !!window.MiniApp;

export { BRIDGE_VERSION, BRIDGE_METHODS, ALL_SCOPES };

// Named TribeSDK (not MiniApp) to match the zero-build-step script-tag
// build (window.TribeSDK, served from /sdk/miniapp.js) — the host app
// injects the raw bridge primitive as window.MiniApp before either ever
// runs, so this wraps that rather than colliding with it.
const TribeSDK = { wallet, tribe, chat, user, ui, storage, isHostAvailable, BRIDGE_VERSION };
export default TribeSDK;
