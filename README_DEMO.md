# Demo Setup (Helius Devnet + Metadata Token)

## 1) Environment
Create `.env`:

SOLANA_RPC=https://devnet.helius-rpc.com/?api-key=YOUR_HELIUS_API_KEY
NEXT_PUBLIC_SOLANA_RPC=https://devnet.helius-rpc.com/?api-key=YOUR_HELIUS_API_KEY
NEXT_PUBLIC_DRIP_STUDIO_URL=https://drip.haus/

## 2) Run
npm install
npm run dev

## 3) Create a demo token with metadata (recommended)
Install Metaplex CLI:
npm i -g @metaplex-foundation/cli

Use devnet:
solana config set --url devnet
solana airdrop 2

Create token + metadata:
mplx toolbox token create \
  --name "Solitude Demo Token" \
  --symbol "SOLI" \
  --description "Demo token for SolitudeRooms token-gated ephemeral rooms (devnet)" \
  --image ./logo.png \
  --decimals 6 \
  --mint-amount 1000000 \
  --rpc "https://devnet.helius-rpc.com/?api-key=YOUR_HELIUS_API_KEY"
