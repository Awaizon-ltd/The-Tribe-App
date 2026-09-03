# Tribe Mini-App SDK

Build a mini-app or mini-game that runs inside the Tribe wallet app — in the
global **App Store** tab, and installable into any tribe.

Your app is just a web page. The host app loads it in a sandboxed WebView and
injects a bridge (`window.MiniApp`) your page uses to read wallet/profile data
and request signatures — never raw wallet access. This SDK is a thin,
optional convenience wrapper around that bridge; you can also call
`window.MiniApp.call(method, params)` directly and skip it entirely.

## Install

Two ways to get it, depending on your stack. Both give you the same API.

### Option A — script tag (works today, no build step)

```html
<script src="https://<api-host>/sdk/miniapp.js"></script>
<script>
  const { wallet, ui } = TribeSDK;
  wallet.getAddress().then(addr => console.log(addr));
</script>
```

This is a plain browser global (`window.TribeSDK`) served straight from our
API — no npm, no bundler, works from any web stack.

### Option B — npm package (for a bundler-based project)

This package (`miniapp-sdk/` at the repo root — standalone, not part of the
Tribe app's own `crypto-wallet/` dependency tree) is a real, installable npm
package today via a local path or tarball:

```bash
# From another project in the same checkout
npm install ../nexus-c/miniapp-sdk

# Or package it up and hand the file to anyone
cd miniapp-sdk && npm pack   # → tribe-miniapp-sdk-1.1.0.tgz
npm install /path/to/tribe-miniapp-sdk-1.1.0.tgz
```

```js
import TribeSDK, { wallet, ui, storage } from '@tribe/miniapp-sdk';
```

**Heads up**: `@tribe/miniapp-sdk` is not published to the *public* npm
registry — `npm install @tribe/miniapp-sdk` with no path/tarball won't
resolve to anything until that happens. Ask us for a build if you need one
distributed a different way (private registry, git-install URL) in the
meantime.

## Quick start

```js
// Runs in a normal browser during local dev too — isHostAvailable() lets you
// fall back to a demo mode instead of every call rejecting.
if (!TribeSDK.isHostAvailable()) {
  console.warn('Not running inside Tribe — using demo data');
}

const address = await TribeSDK.wallet.getAddress();

const best = (await TribeSDK.storage.get('high_score')) ?? 0;
if (score > best) await TribeSDK.storage.set('high_score', score);

await TribeSDK.ui.share(`I just scored ${score}!`);
```

(Swap `TribeSDK.wallet` for the named `wallet` import if you're on the npm
package — same methods either way.)

## API

| Namespace | Method | Scope | Confirmation sheet? |
|---|---|---|---|
| `wallet` | `getAddress()` | `wallet:read` | no |
| `wallet` | `signMessage(message)` | `wallet:sign` | **yes** |
| `wallet` | `sendTx({ to, amount, token })` | `wallet:send` | **yes** |
| `tribe` | `getInfo()` | `tribe:read` | no |
| `tribe` | `getMembers()` | `tribe:read` | no |
| `chat` | `sendMessage(text)` | `chat:write` | no |
| `user` | `getProfile()` | `profile:read` | no |
| `ui` | `showToast(message)` | `ui` | no |
| `ui` | `close()` | `ui` | no |
| `ui` | `share(message, url?)` | `ui` | no |
| `ui` | `haptic(style?)` | `ui` | no |
| `storage` | `get(key)` | `storage:read` | no |
| `storage` | `set(key, value)` | `storage:write` | no |

`signMessage`/`sendTx` open a native sheet the host app renders itself, with
your app's name and a plain-English description of the action — **you don't
control that copy**, so it can't be phrased to hide what's actually happening.
The user enters their passcode there; you never see it, and a rejected sheet
resolves your call with an error rather than crashing your page.

Every method rejects with a normal JS `Error` on failure — a scope you weren't
granted, a user rejection, or a host-side error all just reject the promise.

## Scopes and manifest

A tribe only grants the scopes it explicitly approved at install time — which
may be fewer than what you request. Design your app to degrade gracefully
(hide the "sign in with wallet" button, not crash) if a call rejects with a
permission error.

Your manifest (submitted via `POST /miniapps`) declares which scopes you
*want*:

```js
import { validateManifest } from '@tribe/miniapp-sdk/manifest';
// or, without the npm package: copy manifest.schema.js's validateManifest()

const manifest = {
  name: 'Coin Flip',
  tagline: 'Double or nothing, on-chain.',
  iconUrl: 'https://coinflip.example.com/icon.png',
  category: 'games',
  url: 'https://coinflip.example.com',
  originWhitelist: 'https://coinflip.example.com',
  requestedScopes: ['wallet:read', 'wallet:send', 'storage:read', 'storage:write'],
};

const { valid, errors } = validateManifest(manifest);
```

## Publishing

1. Build your page, host it over **https**.
2. Submit your manifest — `POST /v1/miniapps` (Firebase-authenticated).
3. It lands in `pending_review`. A reviewer checks the requested scopes match
   what the app actually does before it goes live — this isn't a rubber
   stamp, since `wallet:send`/`wallet:sign` apps are handling real funds.
4. Once `approved`, it's listed in the public directory and any tribe owner
   can install it.
5. Editing an approved app's manifest (`PUT /v1/miniapps/:id`) sends it back
   to `pending_review` — changes to a live app get the same scrutiny as the
   original submission.

There's no in-app submission form yet — step 2 is a raw API call for now.

## Local development

Nothing under `window.MiniApp` (or `window.TribeSDK`, until you load the
script) exists outside the host WebView. Two ways to develop without
publishing first:

- Check `TribeSDK.isHostAvailable()` and branch to mock data/local storage.
- Load your dev build in the app itself once you have a build URL — no
  install/review needed to just *preview* it if you're testing in your own
  tribe (ask an admin for a review-sandbox build if this isn't wired up yet).
