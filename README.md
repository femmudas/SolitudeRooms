# SolitudeRooms (Devnet) — DRiP Export + Ephemeral Rooms

SolitudeRooms is a token-gated, ephemeral terminal-style room chat for Solana (Devnet). Rooms store chat messages only in RAM.
When the room is buried, all messages are wiped and a DRiP-ready "memory stone" pack is generated for download.

## Features
- Solana wallet login (Phantom / Solflare / Backpack)
- Token-gated access (holdings > 0)
- RAM-only chat (no database)
- Creator-only burial
- Random pixel-art gravestone template overlay via Canvas
- DRiP export pack (.zip): `memory_stone.png` + `metadata.json` + `README.txt`

## Tech
- Next.js (App Router) + Tailwind
- Express + Socket.io (single server)
- Solana web3.js
- Metaplex Token Metadata PDA read (name/symbol if available)
- Canvas image rendering
- Helius Devnet RPC (recommended)

## Quick Start
1) Copy env
```bash
cp .env.example .env
```

2) Install & run
```bash
npm install
npm run dev
```

Open:
http://localhost:3000

## Demo Flow
1) Connect wallet (Devnet)
2) Paste token mint (CA)
3) Verify holdings (> 0)
4) Create room (free)
5) Chat
6) Bury (creator-only)
7) Download DRiP export pack (.zip)
8) Open DRiP and create a collectible from the pack
