import type { NormalizedBalance, OnchainConfig } from '../../types';

// Solana pakai JSON-RPC resmi (Helius/QuickNode/Alchemy, atau endpoint publik).
// SOL: getBalance (lamports, 9 desimal).
// SPL token (mis. USDT): getTokenAccountsByOwner difilter per-mint, saldo semua token account dijumlahkan.
//
// PENTING: api.mainnet-beta.solana.com MEMBLOKIR IP egress Cloudflare Workers
// ("Your IP or provider is blocked from this endpoint"), jadi tidak dipakai sebagai fallback.
// Endpoint publik di bawah pun rate-limit-nya ketat untuk getTokenAccountsByOwner — hanya
// best-effort. Untuk sync yang andal, set RPC_SOL_URL (mis. Helius free tier) atau isi RPC URL
// per-account lewat UI.
export const SOLANA_PUBLIC_RPCS = [
  'https://solana.leorpc.com/?api_key=FREE',
  'https://solana-rpc.publicnode.com',
  'https://endpoints.omniatech.io/v1/sol/mainnet/public',
];

// Address Solana = pubkey ed25519 (32 byte) di-base58 → 32..44 karakter.
const BASE58_ADDRESS = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

interface RpcResponse<T> {
  result?: T;
  error?: { code: number; message: string };
}

/** Sembunyikan query string (bisa memuat API key) saat endpoint disebut di pesan error. */
function safeHost(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return 'rpc';
  }
}

/**
 * Panggil satu method JSON-RPC. `urls` dicoba berurutan sampai ada yang berhasil —
 * berguna saat memakai endpoint publik yang sering kena rate-limit.
 * Bila semua gagal, lempar error berisi alasan tiap endpoint (bukan diam-diam kosong).
 */
async function rpc<T>(urls: string[], method: string, params: unknown[]): Promise<T> {
  const failures: string[] = [];
  for (const url of urls) {
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
      });
      const text = await res.text();
      if (!res.ok) {
        failures.push(`${safeHost(url)} HTTP ${res.status}: ${text.slice(0, 120)}`);
        continue;
      }
      const data = JSON.parse(text) as RpcResponse<T>;
      if (data.error) {
        failures.push(`${safeHost(url)}: ${data.error.message}`);
        continue;
      }
      return data.result as T;
    } catch (e) {
      failures.push(`${safeHost(url)}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }
  const hint = urls.length > 1 ? ' — set RPC_SOL_URL (mis. Helius) untuk endpoint yang andal' : '';
  throw new Error(`Solana ${method} gagal${hint}. ${failures.join(' | ')}`);
}

function formatUnits(raw: bigint, decimals: number): number {
  if (decimals === 0) return Number(raw);
  const base = 10n ** BigInt(decimals);
  const whole = raw / base;
  const frac = (raw % base).toString().padStart(decimals, '0');
  return parseFloat(`${whole}.${frac}`);
}

interface TokenAccountsResp {
  value?: {
    account?: {
      data?: {
        parsed?: { info?: { tokenAmount?: { amount?: string; decimals?: number } } };
      };
    };
  }[];
}

export async function getSolanaBalances(
  urls: string[],
  config: OnchainConfig,
): Promise<NormalizedBalance[]> {
  const out: NormalizedBalance[] = [];
  const address = config.address;
  if (!BASE58_ADDRESS.test(address)) throw new Error('Address Solana tidak valid (harus base58 32-44 karakter)');

  if (config.trackNative) {
    const acc = await rpc<{ value?: number }>(urls, 'getBalance', [address]);
    const total = formatUnits(BigInt(acc.value ?? 0), 9);
    if (total > 0) out.push({ walletType: 'onchain', asset: 'SOL', free: total, locked: 0, total });
  }

  // Token di Solana dipilih eksplisit lewat UI (tidak ada auto-detect), jadi kegagalan
  // di-propagate — account ditandai `error` dengan sebabnya, bukan tampil ok tapi kosong.
  for (const token of config.tokens ?? []) {
    // Filter per-mint: berlaku untuk SPL Token maupun Token-2022, dan otomatis mencakup
    // beberapa token account (termasuk ATA) untuk mint yang sama.
    let resp: TokenAccountsResp;
    try {
      resp = await rpc<TokenAccountsResp>(urls, 'getTokenAccountsByOwner', [
        address,
        { mint: token.contract },
        { encoding: 'jsonParsed' },
      ]);
    } catch (e) {
      throw new Error(`${token.symbol.toUpperCase()}: ${e instanceof Error ? e.message : String(e)}`);
    }
    let raw = 0n;
    let decimals = token.decimals;
    for (const entry of resp.value ?? []) {
      const amount = entry.account?.data?.parsed?.info?.tokenAmount;
      if (!amount?.amount) continue;
      raw += BigInt(amount.amount);
      if (amount.decimals != null) decimals = amount.decimals; // ikuti desimal on-chain
    }
    const total = formatUnits(raw, decimals);
    if (total > 0)
      out.push({ walletType: 'onchain', asset: token.symbol.toUpperCase(), free: total, locked: 0, total });
  }
  return out;
}
