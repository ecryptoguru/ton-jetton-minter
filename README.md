# TON Jetton Minter DApp


This repository contains:
- Tolk smart contracts: Jetton Minter and Jetton Wallet
- Blueprint CLI configuration for build/test/deploy
- Sandbox test scaffold
- Frontend dApp (Next.js 14, App Router) using TON Connect
- Small Express backend endpoint to build mint payloads


## Quick start
1. Install root dev deps: `npm install` (root uses blueprint tools where applicable)
2. Build contracts: `npx blueprint build`
3. Start backend (in `backend/`): `NODE_ENV=development MINTER_ADDRESS=<minter_address> node server.js`
4. Start frontend (in `frontend/nextjs-app`): `npm install` then `npm run dev`
5. Use the dApp UI, connect wallet, and test mint flows (Testnet)


## Environment
- `DEPLOYER_MNEMONIC`: deployer wallet mnemonic for blueprint deploy.
- `MINTER_OWNER_ADDRESS`: optional owner address for the minter constructor.
- `MINTER_ADDRESS`: set after deploy to let backend compute wallet addresses.


## Notes
- Run Sandbox tests and measure gas before pushing to Testnet/Mainnet.
- Validate ABI alignment between minter and wallet.