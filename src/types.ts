import type { Context } from 'hono';

export interface Env {
  DB: D1Database;
  KV: KVNamespace;
  AI: Ai; // Cloudflare Workers AI (inferensi LLM) — binding [ai] di wrangler.toml
  // Cloudflare Queues — producer job sinkronisasi per account. Opsional: tanpa binding ini
  // (mis. wrangler.toml tanpa blok [[queues.producers]]) cron kembali ke sync inline round-robin.
  SYNC_QUEUE?: Queue<SyncJob>;

  // Binding metadata versi Worker (Cloudflare) — id unik per deploy.
  CF_VERSION_METADATA?: { id: string; tag?: string; timestamp?: string };

  // Secrets / vars
  MASTER_KEY: string; // base64, 32 byte — kunci enkripsi kredensial
  GRAPHIQL_PASSWORD?: string; // password proteksi konsol GraphiQL
  ENVIRONMENT?: string;
  SNAPSHOT_INTERVAL_MINUTES?: string;
  // Round-robin sync: jumlah account yang disinkron per tick cron (0/kosong = semua).
  // Hanya dipakai pada jalur fallback tanpa Queues (Workers Free: batas CPU per-invocation ketat).
  SYNC_BATCH_SIZE?: string;
  // Jeda retry pertama job sync yang gagal (detik); dilipatgandakan tiap percobaan. Default 60.
  SYNC_RETRY_BASE_SECONDS?: string;
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

/** Pesan di queue `wallet-sync`: satu job = sinkron satu account. */
export interface SyncJob {
  kind: 'sync';
  accountId: number;
  reason: 'cron' | 'manual';
  enqueuedAt: number;
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
// defi = posisi di protokol DeFi (mis. aToken Aave) yang nilainya 1:1 dengan aset dasarnya.
export type WalletType = 'spot' | 'futures' | 'earn' | 'funding' | 'onchain' | 'stock' | 'defi';

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
  symbol: string; // nama tampilan di UI (mis. aEthUSDT)
  decimals: number;
  priceAs?: string; // simbol untuk harga & penyimpanan saldo (mis. USDT untuk aEthUSDT); default = symbol
  wallet?: WalletType; // dompet penyimpanan (mis. 'defi' untuk aToken Aave); default 'onchain'
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

// Jenis aset tetap (tabel fixed_assets). Tidak punya harga pasar otomatis; nilai ditaksir manual.
export type FixedAssetKind = 'property' | 'vehicle' | 'gold' | 'other';
export const FIXED_ASSET_KINDS: readonly FixedAssetKind[] = ['property', 'vehicle', 'gold', 'other'];
