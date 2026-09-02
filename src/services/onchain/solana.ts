import type { NormalizedBalance, OnchainConfig } from '../../types';

// Solana pakai JSON-RPC resmi (https://api.mainnet-beta.solana.com atau Helius/QuickNode/Alchemy).
// SOL: getBalance (lamports, 9 desimal).
// SPL token (mis. USDT): getTokenAccountsByOwner difilter per-mint, saldo semua token account dijumlahkan.

/** Endpoint publik Solana Foundation — dipakai bila RPC_SOL_URL / rpcUrl per-account kosong. */
export const SOLANA_DEFAULT_RPC = 'https://api.mainnet-beta.solana.com';

const LAMPORTS = 1_000_000_000n; // 1 SOL = 1e9 lamport

// Address Solana = pubkey ed25519 (32 byte) di-base58 → 32..44 karakter.
const BASE58_ADDRESS = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

interface RpcResponse<T> {
  result?: T;
  error?: { code: number; message: string };
}

async function rpc<T>(url: string, method: string, params: unknown[]): Promise<T> {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
  });
  if (!res.ok) throw new Error(`Solana ${method} ${res.status}`);
  const data = (await res.json()) as RpcResponse<T>;
  if (data.error) throw new Error(`Solana ${method}: ${data.error.message}`);
  return data.result as T;
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
  url: string,
  config: OnchainConfig,
): Promise<NormalizedBalance[]> {
  const out: NormalizedBalance[] = [];
  const address = config.address;
  if (!BASE58_ADDRESS.test(address)) throw new Error('Address Solana tidak valid (harus base58 32-44 karakter)');

  if (config.trackNative) {
    const acc = await rpc<{ value?: number }>(url, 'getBalance', [address]);
    const total = formatUnits(BigInt(acc.value ?? 0), 9);
    if (total > 0) out.push({ walletType: 'onchain', asset: 'SOL', free: total, locked: 0, total });
  }

  for (const token of config.tokens ?? []) {
    try {
      // Filter per-mint: berlaku untuk SPL Token maupun Token-2022, dan otomatis mencakup
      // beberapa token account (termasuk ATA) untuk mint yang sama.
      const resp = await rpc<TokenAccountsResp>(url, 'getTokenAccountsByOwner', [
        address,
        { mint: token.contract },
        { encoding: 'jsonParsed' },
      ]);
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
    } catch {
      // token bermasalah — lanjut ke token berikutnya
    }
  }
  return out;
}
