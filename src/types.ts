import type { Context } from 'hono';

export interface Env {
  DB: D1Database;
  KV: KVNamespace;

  // Secrets / vars
  MASTER_KEY: string; // base64, 32 byte — kunci enkripsi kredensial
  ENVIRONMENT?: string;
  SNAPSHOT_INTERVAL_MINUTES?: string;
  COINGECKO_API_KEY?: string;
  QUICKNODE_ETH_URL?: string;
  QUICKNODE_BSC_URL?: string;
  QUICKNODE_TRON_URL?: string;
}

export interface SessionData {
  userId: number;
  username: string;
  csrf: string;
  createdAt: number;
  ip?: string;
  ua?: string;
}

// Variabel context Hono
export type Variables = {
  session: SessionData;
  sid: string;
};

export type AppContext = Context<{ Bindings: Env; Variables: Variables }>;

export type AccountType = 'binance' | 'bybit' | 'tron' | 'eth' | 'bsc';
export type WalletType = 'spot' | 'futures' | 'earn' | 'funding' | 'onchain';

export interface NormalizedBalance {
  walletType: WalletType;
  asset: string;
  free: number;
  locked: number;
  total: number;
}

export interface NormalizedDeposit {
  txId: string;
  asset: string;
  amount: number;
  network?: string;
  address?: string;
  status?: string;
  ts: number;
  raw?: unknown;
}

// Kredensial CEX (terenkripsi di kolom enc_credentials)
export interface CexCredentials {
  apiKey: string;
  apiSecret: string;
}

// Kredensial / konfigurasi on-chain (terenkripsi di enc_credentials)
export interface OnchainCredentials {
  rpcUrl?: string; // endpoint QuickNode; kalau kosong pakai default dari env
}

// Token yang ditrack untuk account on-chain (disimpan di kolom config, non-rahasia)
export interface TrackedToken {
  contract: string;
  symbol: string;
  decimals: number;
}

export interface OnchainConfig {
  address: string;
  trackNative: boolean;
  tokens: TrackedToken[];
}
