import { Connection, PublicKey } from "@solana/web3.js";
import { getMetadataAccountDataSerializer } from "@metaplex-foundation/mpl-token-metadata";

const RPC = process.env.SOLANA_RPC || "https://api.devnet.solana.com";
const conn = new Connection(RPC, "confirmed");
const TOKEN_METADATA_PROGRAM_ID = new PublicKey("metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s");

function clean(s?: string) {
  return (s || "").replace(/\0/g, "").trim();
}

export async function verifyTokenGate(wallet: string, mint: string) {
  const owner = new PublicKey(wallet);
  const mintPk = new PublicKey(mint);

  const accounts = await conn.getParsedTokenAccountsByOwner(owner, { mint: mintPk });
  return accounts.value.some((v) => {
    const ui = (v.account.data as any)?.parsed?.info?.tokenAmount?.uiAmount ?? 0;
    return ui > 0;
  });
}

export async function fetchTokenInfo(mint: string): Promise<{ mint: string; name?: string; symbol?: string; decimals?: number }> {
  const mintPk = new PublicKey(mint);

  // decimals (mint account)
  let decimals: number | undefined;
  try {
    const acc = await conn.getParsedAccountInfo(mintPk);
    const info = (acc.value?.data as any)?.parsed?.info;
    decimals = info?.decimals;
  } catch {
    // ignore
  }

  // Metaplex metadata PDA = ['metadata', programId, mint]
  const [metadataPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("metadata"), TOKEN_METADATA_PROGRAM_ID.toBuffer(), mintPk.toBuffer()],
    TOKEN_METADATA_PROGRAM_ID
  );

  try {
    const mdAcc = await conn.getAccountInfo(metadataPda);
    if (!mdAcc?.data) return { mint, decimals };

    const [metadata] = getMetadataAccountDataSerializer().deserialize(mdAcc.data);
    const name = clean(metadata.name) || undefined;
    const symbol = clean(metadata.symbol) || undefined;

    return { mint, name, symbol, decimals };
  } catch {
    return { mint, decimals };
  }
}
