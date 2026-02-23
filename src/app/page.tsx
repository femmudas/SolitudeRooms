"use client";

import React, { useEffect, useRef, useState } from "react";
import io from "socket.io-client";
import { useWallet } from "@solana/wallet-adapter-react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";

const socket = io(); // same origin

type Screen = "wallet" | "token" | "setup" | "chat" | "buried";

export default function Page() {
  const { publicKey } = useWallet();
  const wallet = publicKey?.toBase58() || "";

  const [screen, setScreen] = useState<Screen>("wallet");

  const [tokenMint, setTokenMint] = useState("");
  const [roomName, setRoomName] = useState("");
  const [roomId, setRoomId] = useState<string | null>(null);

  const [messages, setMessages] = useState<{ id: string; wallet: string; text: string; time: string }[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [participants, setParticipants] = useState(1);

  const [snapshotId, setSnapshotId] = useState<string | null>(null);

  // Token info
  const [tokenName, setTokenName] = useState<string>("—");
  const [tokenSymbol, setTokenSymbol] = useState<string>("—");
  const [tokenDecimals, setTokenDecimals] = useState<number | null>(null);
  const [isLoadingTokenInfo, setIsLoadingTokenInfo] = useState(false);
  const [tokenStatus, setTokenStatus] = useState<"idle" | "loading" | "found" | "partial" | "not_found">("idle");

  // Verify
  const [isVerifying, setIsVerifying] = useState(false);
  const [verifyError, setVerifyError] = useState<string | null>(null);
  const [cooldownUntil, setCooldownUntil] = useState<number>(0);
  const cooldownActive = Date.now() < cooldownUntil;

  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    socket.on("chat:new", (msg) => setMessages((p) => [...p, msg]));
    socket.on("room:presence", (p) => setParticipants(p.count || 0));
    socket.on("room:buried", (snap) => {
      setSnapshotId(snap.id);
      setScreen("buried");
    });

    return () => {
      socket.off("chat:new");
      socket.off("room:presence");
      socket.off("room:buried");
    };
  }, []);

  // Auto-scan token info (debounced)
  useEffect(() => {
    const m = tokenMint.trim();

    setTokenName("—");
    setTokenSymbol("—");
    setTokenDecimals(null);

    if (m.length < 32) {
      setTokenStatus("idle");
      return;
    }

    setTokenStatus("loading");

    const t = setTimeout(async () => {
      try {
        setIsLoadingTokenInfo(true);
        const r = await fetch(`/api/token/${m}`);
        const j = await r.json();

        if (j?.ok) {
          const name = j.name || "";
          const symbol = j.symbol || "";
          const decimals = typeof j.decimals === "number" ? j.decimals : null;

          setTokenName(name ? name : "Unknown");
          setTokenSymbol(symbol ? symbol : "TOKEN");
          setTokenDecimals(decimals);

          if (name || symbol) setTokenStatus("found");
          else if (decimals !== null) setTokenStatus("partial");
          else setTokenStatus("not_found");
        } else {
          setTokenStatus("not_found");
        }
      } catch {
        setTokenStatus("not_found");
      } finally {
        setIsLoadingTokenInfo(false);
      }
    }, 450);

    return () => clearTimeout(t);
  }, [tokenMint]);

  const verifyHoldings = async () => {
    if (!wallet) return alert("Connect wallet first");
    const m = tokenMint.trim();
    if (!m || m.length < 32) return alert("Paste a valid mint");

    if (cooldownActive) return;
    setCooldownUntil(Date.now() + 2000);

    setIsVerifying(true);
    setVerifyError(null);

    try {
      const r = await fetch("/api/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ wallet, mint: m })
      });

      const j = await r.json();
      if (!j.ok) throw new Error(j.error || "verify_failed");

      if (j.allowed) {
        setScreen("setup");
      } else {
        setVerifyError("ACCESS_DENIED: INSUFFICIENT_HOLDINGS");
      }
    } catch (e: any) {
      setVerifyError(e?.message || "verify_failed");
    } finally {
      setIsVerifying(false);
    }
  };

  const createRoom = async () => {
    if (!wallet) return alert("Connect wallet first");
    const m = tokenMint.trim();
    if (!m || m.length < 32) return alert("Paste a valid mint");
    if (!roomName.trim()) return alert("Enter a room name");

    socket.emit("room:create", { creatorWallet: wallet, tokenMint: m, roomName: roomName.trim() }, (resp: any) => {
      if (!resp?.ok) return alert(resp?.error || "create_failed");
      setRoomId(resp.roomId);
      setScreen("chat");
      socket.emit("room:join", { roomId: resp.roomId, wallet }, () => {});
    });
  };

  const sendMessage = () => {
    if (!wallet) return alert("Connect wallet first");
    if (!roomId) return;
    const text = inputValue.trim();
    if (!text) return;
    socket.emit("chat:send", { roomId, wallet, text }, (resp: any) => {
      if (!resp?.ok) alert(resp?.error || "send_failed");
    });
    setInputValue("");
  };

  const bury = () => {
    if (!wallet) return alert("Connect wallet first");
    if (!roomId) return;
    socket.emit("room:bury", { roomId, wallet }, (resp: any) => {
      if (!resp?.ok) alert(resp?.error || "bury_failed");
    });
  };

  return (
    <div className="min-h-screen bg-black text-green-400 p-6 font-mono">
      <div className="max-w-5xl mx-auto">

        {screen === "wallet" && (
          <div className="space-y-6 text-center mt-24">
            <h1 className="text-6xl font-bold">SOLITUDEROOMS</h1>
            <p className="text-green-600">DRiP-ready ephemeral rooms on Solana (Devnet)</p>

            <div className="border border-green-500/40 p-4 inline-block">
              <div className="text-xs text-green-600 mb-2">CONNECT WALLET</div>
              <div className="flex justify-center">
                <WalletMultiButton />
              </div>

              {wallet && (
                <div className="text-xs text-green-600 mt-3">
                  CONNECTED: <span className="text-green-300">{wallet.slice(0, 4)}...{wallet.slice(-4)}</span>
                </div>
              )}
            </div>

            <button
              onClick={() => setScreen("token")}
              disabled={!wallet}
              className="border border-green-400 px-6 py-3 hover:bg-green-400 hover:text-black transition disabled:opacity-40 disabled:cursor-not-allowed"
            >
              CONTINUE
            </button>
          </div>
        )}

        {screen === "token" && (
          <div className="space-y-6 mt-16">
            <h2 className="text-3xl font-bold">PASTE TOKEN MINT (DEVNET)</h2>

            <div className="border border-green-500/40 p-4">
              <div className="text-green-600 text-xs mb-2">TOKEN MINT</div>
              <input
                value={tokenMint}
                onChange={(e) => setTokenMint(e.target.value)}
                className="w-full bg-transparent outline-none"
                placeholder="So11111111111111111111111111111111111111112"
              />
            </div>

            <div className="border border-green-500/40 p-3">
              {tokenStatus === "idle" && <div className="text-green-600 text-sm">PASTE A TOKEN MINT TO SCAN METADATA</div>}
              {tokenStatus === "loading" && <div className="text-green-600 text-sm">SCANNING TOKEN METADATA...</div>}
              {tokenStatus === "found" && <div className="text-green-300 text-sm font-bold">TOKEN DETECTED ✓</div>}
              {tokenStatus === "partial" && <div className="text-yellow-300 text-sm font-bold">PARTIAL TOKEN INFO (NO METADATA)</div>}
              {tokenStatus === "not_found" && <div className="text-red-400 text-sm font-bold">NO METADATA FOUND (DEVNET)</div>}
            </div>

            <div className="border border-green-500/40 p-4">
              <div className="text-green-600 text-xs mb-2">TOKEN INFO (auto)</div>

              {isLoadingTokenInfo ? (
                <div className="text-green-600 text-sm">Scanning metadata...</div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
                  <div>
                    <div className="text-green-600 text-xs">NAME</div>
                    <div className="text-green-300 font-bold">{tokenName}</div>
                  </div>
                  <div>
                    <div className="text-green-600 text-xs">SYMBOL</div>
                    <div className="text-green-300 font-bold">${tokenSymbol}</div>
                  </div>
                  <div>
                    <div className="text-green-600 text-xs">DECIMALS</div>
                    <div className="text-green-300 font-bold">{tokenDecimals ?? "—"}</div>
                  </div>
                </div>
              )}
            </div>

            <button
              onClick={verifyHoldings}
              className="border border-green-400 px-6 py-3 hover:bg-green-400 hover:text-black transition disabled:opacity-40 disabled:cursor-not-allowed"
              disabled={!wallet || isVerifying || cooldownActive || tokenStatus === "loading"}
            >
              {isVerifying ? "VERIFYING..." : tokenStatus === "loading" ? "WAIT..." : cooldownActive ? "COOLDOWN..." : "VERIFY HOLDINGS"}
            </button>

            {verifyError && <div className="text-red-500 text-sm">{verifyError}</div>}
          </div>
        )}

        {screen === "setup" && (
          <div className="space-y-6 mt-16">
            <h2 className="text-3xl font-bold">CREATE ROOM</h2>

            <div className="border border-green-500/40 p-4">
              <div className="text-green-600 text-xs mb-2">ROOM NAME</div>
              <input
                value={roomName}
                onChange={(e) => setRoomName(e.target.value)}
                className="w-full bg-transparent outline-none"
                placeholder="e.g. CATACOMB-01"
              />
            </div>

            <div className="text-xs text-green-600">
              • Free room (no fee) • RAM-only chat • Burial exports DRiP pack
            </div>

            <button
              onClick={createRoom}
              className="border border-green-400 px-6 py-3 hover:bg-green-400 hover:text-black transition"
            >
              CREATE
            </button>
          </div>
        )}

        {screen === "chat" && (
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 mt-6">
            <div className="lg:col-span-3 border border-green-500/40 p-4">
              <div className="flex items-center justify-between">
                <div className="text-xs text-green-600">ROOM: {roomId}</div>
                <div className="text-xs text-green-600">SOULS: {participants}</div>
              </div>
              <div className="mt-4 h-[420px] border border-green-500/20 flex items-center justify-center text-green-600">
                (Market panel placeholder)
              </div>
            </div>

            <div className="lg:col-span-2 flex flex-col">
              <div className="border border-green-500/40 p-3 flex items-center justify-between">
                <div className="text-xs text-green-600">Ephemeral terminal chat</div>
                <button
                  onClick={bury}
                  className="border border-red-500 text-red-400 px-3 py-1 hover:bg-red-500 hover:text-black transition text-xs"
                >
                  BURY (creator)
                </button>
              </div>

              <div className="border border-green-500/20 p-3 mt-3 h-[420px] overflow-y-auto space-y-2">
                {messages.map((m) => (
                  <div key={m.id} className="text-sm">
                    <span className="text-green-600 text-xs">[{m.time}] </span>
                    <span className="text-green-300">{m.wallet.slice(0,4)}...{m.wallet.slice(-4)}: </span>
                    <span>{m.text}</span>
                  </div>
                ))}
                <div ref={messagesEndRef} />
              </div>

              <div className="mt-3 flex gap-2">
                <input
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") sendMessage(); }}
                  className="flex-1 bg-transparent border border-green-500/40 p-2 outline-none"
                  placeholder="type..."
                />
                <button
                  onClick={sendMessage}
                  className="border border-green-400 px-4 hover:bg-green-400 hover:text-black transition"
                >
                  SEND
                </button>
              </div>
            </div>
          </div>
        )}

        {screen === "buried" && (
          <div className="mt-16 space-y-6 text-center">
            <h2 className="text-5xl font-bold text-red-500">ROOM BURIED</h2>
            <p className="text-green-600">All chat data wiped from RAM. Only the Drop remains.</p>

            <div className="border border-green-500/40 p-6 max-w-2xl mx-auto space-y-4 text-left">
              <div className="text-green-400 font-bold">DRiP EXPORT PACK</div>
              <div className="text-xs text-green-600">
                Zip contains: memory_stone.png + metadata.json + README.txt
              </div>

              <div className="flex gap-3 flex-wrap">
                <a
                  href={snapshotId ? `/api/drip/pack/${snapshotId}` : "#"}
                  className="border border-green-400 px-5 py-2 hover:bg-green-400 hover:text-black transition"
                >
                  DOWNLOAD PACK (.zip)
                </a>

                <a
                  href={process.env.NEXT_PUBLIC_DRIP_STUDIO_URL || "https://drip.haus/"}
                  target="_blank"
                  className="border border-green-500/40 px-5 py-2 hover:bg-green-400 hover:text-black transition"
                  rel="noreferrer"
                >
                  OPEN DRiP
                </a>
              </div>
            </div>

            <button
              onClick={() => { setMessages([]); setRoomId(null); setSnapshotId(null); setScreen("token"); }}
              className="border border-green-400 px-6 py-3 hover:bg-green-400 hover:text-black transition"
            >
              NEW ROOM
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
