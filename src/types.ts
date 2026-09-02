import type { Context } from 'hono';

export interface Env {
  DB: D1Database;
  KV: KVNamespace;
  AI: Ai; // Cloudflare Workers AI (inferensi LLM) — binding [ai] di wrangler.toml

  // Binding metadata versi Worker (Cloudflare) — id unik per deploy.
  CF_VERSION_METADATA?: { id: string; tag?: string; timestamp?: string };

  // Secrets / vars
  MASTER_KEY: string; // base64, 32 byte — kunci enkripsi kredensial
  GRAPHIQL_PASSWORD?: string; // password proteksi konsol GraphiQL
  ENVIRONMENT?: string;
  SNAPSHOT_INTERVAL_MINUTES?: string;
  // Round-robin sync: jumlah account yang disinkron per tick cron (0/kosong = semua).
  // Berguna di Workers Free (batas CPU per-invocation ketat) untuk memecah beban antar-tick.
  SYNC_BATCH_SIZE?: string;
  COINGECKO_API_KEY?: string;
  // Endpoint RPC default (netral provider: Alchemy untuk EVM, TronGrid untuk TRON, JSON-RPC untuk Solana).
  RPC_ETH_URL?: string;
  RPC_BSC_URL?: string;
  RPC_TRON_URL?: string;
  RPC_TRON_API_KEY?: string; // opsional: TronGrid TRON-PRO-API-KEY
  RPC_SOL_URL?: string; // opsional: bila kosong pakai endpoint publik mainnet-beta
  // Proxy HTTP CONNECT untuk bypass geo-block Binance (format: http://user:pass@host:port).
  // Set via: wrangler secret put BINANCE_PROXY_URL
  BINANCE_PROXY_URL?: string;
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
  cspNonce: string;
};

export type AppContext = Context<{ Bindings: Env; Variables: Variables }>;

export type AccountType = 'binance' | 'bybit' | 'tron' | 'eth' | 'bsc' | 'btc' | 'sol' | 'idx';
export type WalletType = 'spot' | 'futures' | 'earn' | 'funding' | 'onchain' | 'stock';

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

/**
 * Hasil pengambilan saldo CEX. Sebuah CEX punya beberapa dompet (spot/futures/funding/earn)
 * yang diambil terpisah, jadi sebagian bisa gagal. `synced` menandai dompet mana yang datanya
 * benar-benar valid — hanya dompet itu yang boleh menimpa saldo lama, sisanya dipertahankan.
 */
export interface CexBalanceFetch {
  balances: NormalizedBalance[];
  synced: WalletType[];
  failures: Array<{ wallet: WalletType; message: string }>;
}

// Kredensial CEX (terenkripsi di kolom enc_credentials)
export interface CexCredentials {
  apiKey: string;
  apiSecret: string;
}

// Kredensial / konfigurasi on-chain (terenkripsi di enc_credentials)
export interface OnchainCredentials {
  rpcUrl?: string; // endpoint RPC (Alchemy/TronGrid/Solana); kalau kosong pakai default dari env
  apiKey?: string; // opsional: TronGrid TRON-PRO-API-KEY
}

// Token yang ditrack untuk account on-chain (disimpan di kolom config, non-rahasia)
export interface TrackedToken {
  contract: string; // EVM/TRON: alamat kontrak. Solana: alamat mint SPL.
  symbol: string;
  decimals: number;
}

export interface OnchainConfig {
  address: string;
  trackNative: boolean;
  tokens: TrackedToken[];
  autoDetect?: boolean; // EVM: deteksi otomatis semua token ERC-20/BEP-20 non-zero
}

// Satu posisi saham IDX (disimpan di kolom config account type 'idx', non-rahasia).
// avgPrice = harga beli rata-rata per LEMBAR dalam IDR (basis modal untuk hitung untung/rugi).
export interface StockPosition {
  ticker: string; // simbol polos tanpa suffix, mis. "BBCA"
  lots: number; // 1 lot = 100 lembar
  avgPrice: number; // IDR per lembar
}

export interface StockConfig {
  positions: StockPosition[];
}
