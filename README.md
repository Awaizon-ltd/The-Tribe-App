# Tribe

**A social crypto wallet where communities ("tribes") hold assets, govern together and run their own mini-apps.**

Tribe combines a self-custodial multichain wallet with community features: tribes, chat, posts, DAO governance and an in-app store of mini-apps and games. This monorepo contains the mobile app, the backend, the smart contracts, the mini-app SDK and the marketing website.

## Repository layout

| Folder | What it is | Stack |
|---|---|---|
| [`crypto-wallet/`](crypto-wallet) | The **Tribe mobile app** (iOS and Android) | Expo, React Native, ethers, Firebase |
| [`backend/`](backend) | API and multichain DAO indexer | Node.js, Express, PostgreSQL, MongoDB, Redis, BullMQ |
| [`contracts/`](contracts) | DAO smart contracts (`DAOFactory`, `DelegatedDAO`) | Solidity |
| [`miniapp-sdk/`](miniapp-sdk) | `@tribe/miniapp-sdk`, for building mini-apps that run inside Tribe ([docs](miniapp-sdk/README.md)) | JavaScript |
| [`miniapp-sdk-test-app/`](miniapp-sdk-test-app) | A standalone consumer app that checks the SDK installs and works from npm | Node test runner |
| [`website/`](website) | Marketing website | React, Vite, Tailwind CSS |

## App features

**Wallet**
- Create or import a wallet with a recovery phrase, protected by a passcode and biometrics
- Send, receive and swap tokens (0x and LI.FI), import tokens, and view transaction history
- NFTs: view, send and mint
- Market data and token details
- A built-in dApp browser

**Tribes**
- Create, search, join and invite members to tribes
- Tribe chat, posts, an activity feed and live support chat
- **Governance:** launch a DAO for your tribe, create proposals and vote
- **Tribe apps:** install mini-apps and games from the in-app App Store

**Account**
- Email or Google sign-in, profile setup and referrals

## Backend

- REST API for tokens, NFTs, swaps (0x and LI.FI), prices (CoinGecko), feeds and mini-app scopes
- A multichain DAO indexer: BullMQ workers sync on-chain DAO events into PostgreSQL
- Caching with Redis and node-cache; MongoDB for NFTs and social data
- Hardening: `helmet`, `hpp`, rate limiting and slow-down, request sanitisation, validation and request IDs
- Wallet key material wrapped with a server-side key-encryption pepper (`WALLET_KEK_PEPPER`)

## Getting started

### Backend

```bash
cd backend
npm install
# create backend/.env (see below)
npm run migrate          # create PostgreSQL tables
npm run dev              # or: npm start
npm run sync             # run the DAO indexer sync
```

| Variable group | Variables |
|---|---|
| Server | `PORT`, `NODE_ENV`, `CLUSTER_WORKERS`, `CACHE_TTL` |
| PostgreSQL | `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD`, `DB_POOL_MAX` |
| MongoDB / Redis | `MONGODB_URI`, `MONGODB_DB_NAME`, `REDIS_URL` |
| Chain / swaps | `RPC_URL`, `ZERO_EX_API_KEY`, `FEE_WALLET` |
| Firebase | `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY` |
| Security | `WALLET_KEK_PEPPER` |

### Mobile app

```bash
cd crypto-wallet
npm install
cp .env.example .env      # EXPO_PUBLIC_API_URL + Google OAuth client IDs
npx expo start
```

### Website

```bash
cd website
npm install
npm run dev
```

### Mini-app SDK

See the [SDK README](miniapp-sdk/README.md) for building a mini-app. To run its integration checks:

```bash
cd miniapp-sdk-test-app && npm install && npm test
```

## Smart contracts

`contracts/DAOFactory.sol` deploys per-tribe `DelegatedDAO` governance contracts. Deployment settings are in `contracts/Settings.json`, and the ABIs used by the app and backend are in `crypto-wallet/abi/` and `backend/src/abi/`.
