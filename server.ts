import "dotenv/config";
import http from "http";
import express from "express";
import cors from "cors";
import { Server as IOServer } from "socket.io";
import next from "next";
import archiver from "archiver";
import { z } from "zod";

import { store } from "./src/lib/store.js";
import { fetchTokenInfo, verifyTokenGate } from "./src/lib/solana.js";
import { renderStonePng } from "./src/lib/stone.js";

const dev = process.env.NODE_ENV !== "production";
const port = Number(process.env.PORT || 3000);

const app = next({ dev, dir: "." });
const handle = app.getRequestHandler();

await app.prepare();

const ex = express();
ex.use(cors());
ex.use(express.json({ limit: "2mb" }));

ex.get("/api/token/:mint", async (req, res) => {
  try {
    const mint = z.string().min(32).parse(req.params.mint);
    const info = await fetchTokenInfo(mint);
    res.json({ ok: true, ...info });
  } catch (e: any) {
    res.status(400).json({ ok: false, error: e?.message ?? "bad_request" });
  }
});

ex.post("/api/verify", async (req, res) => {
  try {
    const body = z.object({
      wallet: z.string().min(32),
      mint: z.string().min(32)
    }).parse(req.body);

    const allowed = await verifyTokenGate(body.wallet, body.mint);
    res.json({ ok: true, allowed });
  } catch (e: any) {
    res.status(400).json({ ok: false, error: e?.message ?? "bad_request" });
  }
});

// DRiP Export Pack (.zip): memory_stone.png + metadata.json + README.txt
ex.get("/api/drip/pack/:snapshotId", async (req, res) => {
  try {
    const snapshotId = z.string().min(1).parse(req.params.snapshotId);
    const snap = store.getSnapshot(snapshotId);
    if (!snap) return res.status(404).send("snapshot_not_found");

    const png = await renderStonePng({
      templateIndex: snap.templateIndex,
      roomName: snap.roomName,
      tokenName: snap.tokenName,
      tokenSymbol: snap.tokenSymbol,
      tokenMint: snap.tokenMint,
      buriedAtISO: snap.buriedAtISO
    });

    res.setHeader("Content-Type", "application/zip");
    res.setHeader("Content-Disposition", `attachment; filename="solitude-drip-pack-${snapshotId}.zip"`);

    const archive = archiver("zip", { zlib: { level: 9 } });
    archive.on("error", err => { throw err; });
    archive.pipe(res);

    archive.append(png, { name: "memory_stone.png" });
    archive.append(
      JSON.stringify({
        name: `SolitudeRooms • ${snap.roomName}`,
        description: `Ephemeral room snapshot. Chat was erased. Mint: ${snap.tokenMint}`,
        attributes: [
          { trait_type: "room", value: snap.roomName },
          { trait_type: "token", value: snap.tokenSymbol || snap.tokenName || "UNKNOWN" },
          { trait_type: "mint", value: snap.tokenMint },
          { trait_type: "buried_at", value: snap.buriedAtISO }
        ]
      }, null, 2),
      { name: "metadata.json" }
    );

    archive.append(
`DRiP Studio Quick Steps
1) Open DRiP
2) Create a collectible
3) Upload memory_stone.png
4) Copy fields from metadata.json (name/description/attributes)
5) Publish when ready
`,
      { name: "README.txt" }
    );

    await archive.finalize();
  } catch (e: any) {
    res.status(400).send(e?.message ?? "bad_request");
  }
});

ex.all("*", (req, res) => handle(req, res));

const server = http.createServer(ex);
const io = new IOServer(server, { cors: { origin: "*" } });

io.on("connection", (socket) => {
  socket.on("room:create", async (payload, cb) => {
    try {
      const data = z.object({
        creatorWallet: z.string().min(32),
        tokenMint: z.string().min(32),
        roomName: z.string().min(1).max(32)
      }).parse(payload);

      const token = await fetchTokenInfo(data.tokenMint);
      const room = store.createRoom({
        creatorWallet: data.creatorWallet,
        tokenMint: data.tokenMint,
        tokenName: token.name,
        tokenSymbol: token.symbol,
        roomName: data.roomName
      });

      cb?.({ ok: true, roomId: room.id, token });
    } catch (e: any) {
      cb?.({ ok: false, error: e?.message ?? "create_failed" });
    }
  });

  socket.on("room:join", (payload, cb) => {
    try {
      const data = z.object({
        roomId: z.string().min(1),
        wallet: z.string().min(32)
      }).parse(payload);

      const room = store.joinRoom(data.roomId, data.wallet);
      socket.join(room.id);
      io.to(room.id).emit("room:presence", store.getPresence(room.id));
      cb?.({ ok: true, room: store.publicRoom(room.id) });
    } catch (e: any) {
      cb?.({ ok: false, error: e?.message ?? "join_failed" });
    }
  });

  socket.on("chat:send", (payload, cb) => {
    try {
      const data = z.object({
        roomId: z.string().min(1),
        wallet: z.string().min(32),
        text: z.string().min(1).max(1000)
      }).parse(payload);

      const msg = store.addMessage(data.roomId, data.wallet, data.text);
      io.to(data.roomId).emit("chat:new", msg);
      cb?.({ ok: true });
    } catch (e: any) {
      cb?.({ ok: false, error: e?.message ?? "send_failed" });
    }
  });

  socket.on("room:bury", (payload, cb) => {
    try {
      const data = z.object({
        roomId: z.string().min(1),
        wallet: z.string().min(32)
      }).parse(payload);

      const snap = store.buryRoom(data.roomId, data.wallet);
      io.to(data.roomId).emit("room:buried", snap);
      cb?.({ ok: true, snapshot: snap });
    } catch (e: any) {
      cb?.({ ok: false, error: e?.message ?? "bury_failed" });
    }
  });
});

server.listen(port, () => {
  console.log(`> http://localhost:${port}`);
});
