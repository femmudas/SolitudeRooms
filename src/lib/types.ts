export type Message = {
  id: string;
  wallet: string;
  text: string;
  time: string;
};

export type Room = {
  id: string;
  creatorWallet: string;
  tokenMint: string;
  tokenName?: string;
  tokenSymbol?: string;
  roomName: string;
  createdAtISO: string;
  buriedAtISO?: string;
  participants: Set<string>;
  messages: Message[];
  templateIndex: number; // 1..5
};

export type Snapshot = {
  id: string;
  roomId: string;
  roomName: string;
  creatorWallet: string;
  tokenMint: string;
  tokenName?: string;
  tokenSymbol?: string;
  buriedAtISO: string;
  templateIndex: number;
};
