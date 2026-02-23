import path from "path";
import { createCanvas, loadImage } from "canvas";

export async function renderStonePng(input: {
  templateIndex: number; // 1..5
  roomName: string;
  tokenName?: string;
  tokenSymbol?: string;
  tokenMint: string;
  buriedAtISO: string;
}) {
  const W = 400, H = 600;
  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext("2d");

  const imgPath = path.join(process.cwd(), "public", "assets", "stones", `stone_${input.templateIndex}.png`);
  const bg = await loadImage(imgPath);
  ctx.drawImage(bg, 0, 0, W, H);

  // Text overlay
  ctx.fillStyle = "#00FF41";
  ctx.font = "bold 20px monospace";
  const title = input.tokenSymbol ? `$${input.tokenSymbol}` : (input.tokenName ?? "UNKNOWN");
  ctx.fillText(title, 22, 58);

  ctx.font = "16px monospace";
  ctx.fillText(`ROOM: ${input.roomName}`, 22, 92);

  ctx.font = "12px monospace";
  ctx.fillText(`MINT: ${input.tokenMint.slice(0, 6)}...${input.tokenMint.slice(-6)}`, 22, 120);

  ctx.font = "12px monospace";
  ctx.fillText(`BURIED: ${new Date(input.buriedAtISO).toUTCString()}`, 22, 146);

  ctx.font = "bold 52px monospace";
  ctx.fillText("R.I.P.", 112, 360);

  return canvas.toBuffer("image/png");
}
