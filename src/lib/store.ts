import crypto from "crypto";
import type { Message, Room, Snapshot } from "./types.js";

function nowISO() { return new Date().toISOString(); }
function shortId() { return crypto.randomBytes(8).toString("hex"); }

class Store {
  private rooms = new Map<string, Room>();
  private snapshots = new Map<string, Snapshot>();

  createRoom(input: {
    creatorWallet: string;
    tokenMint: string;
    tokenName?: string;
    tokenSymbol?: string;
    roomName: string;
  }): Room {
    const id = shortId();
    const room: Room = {
      id,
      creatorWallet: input.creatorWallet,
      tokenMint: input.tokenMint,
      tokenName: input.tokenName,
      tokenSymbol: input.tokenSymbol,
      roomName: input.roomName,
      createdAtISO: nowISO(),
      participants: new Set([input.creatorWallet]),
      messages: [],
      templateIndex: (Math.floor(Math.random() * 5) + 1)
    };
    this.rooms.set(id, room);
    return room;
  }

  joinRoom(roomId: string, wallet: string): Room {
    const r = this.rooms.get(roomId);
    if (!r) throw new Error("room_not_found");
    if (r.buriedAtISO) throw new Error("room_buried");
    r.participants.add(wallet);
    return r;
  }

  addMessage(roomId: string, wallet: string, text: string): Message {
    const r = this.rooms.get(roomId);
    if (!r) throw new Error("room_not_found");
    if (r.buriedAtISO) throw new Error("room_buried");

    const msg: Message = {
      id: shortId(),
      wallet,
      text,
      time: new Date().toLocaleTimeString("en-US", { hour12: false })
    };
    r.messages.push(msg);
    return msg;
  }

  buryRoom(roomId: string, wallet: string): Snapshot {
    const r = this.rooms.get(roomId);
    if (!r) throw new Error("room_not_found");
    if (r.creatorWallet !== wallet) throw new Error("only_creator_can_bury");
    if (r.buriedAtISO) throw new Error("already_buried");

    r.buriedAtISO = nowISO();

    const snap: Snapshot = {
      id: shortId(),
      roomId: r.id,
      roomName: r.roomName,
      creatorWallet: r.creatorWallet,
      tokenMint: r.tokenMint,
      tokenName: r.tokenName,
      tokenSymbol: r.tokenSymbol,
      buriedAtISO: r.buriedAtISO,
      templateIndex: r.templateIndex
    };

    this.snapshots.set(snap.id, snap);

    // RAM wipe
    r.messages = [];
    r.participants = new Set();
    return snap;
  }

  getSnapshot(id: string) {
    return this.snapshots.get(id);
  }

  getPresence(roomId: string) {
    const r = this.rooms.get(roomId);
    if (!r) return { count: 0 };
    return { count: r.participants.size };
  }

  publicRoom(roomId: string) {
    const r = this.rooms.get(roomId);
    if (!r) throw new Error("room_not_found");
    return {
      id: r.id,
      roomName: r.roomName,
      tokenMint: r.tokenMint,
      tokenName: r.tokenName,
      tokenSymbol: r.tokenSymbol,
      creatorWallet: r.creatorWallet,
      templateIndex: r.templateIndex
    };
  }
}

export const store = new Store();
