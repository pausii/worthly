import type { CexCredentials, NormalizedBalance, NormalizedDeposit } from '../../types';
import { hmacSha256Hex } from '../../lib/crypto';

const SPOT_BASE = 'https://api.binance.com';
const FUTURES_BASE = 'https://fapi.binance.com';
const RECV_WINDOW = 5000;

function buildQuery(params: Record<string, string | number>): string {
  return Object.entries(params)
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
    .join('&');
}

/** Signed request Binance: HMAC-SHA256 atas seluruh query string. */
async function signedRequest<T>(
  creds: CexCredentials,
  method: 'GET' | 'POST',
  base: string,
  path: string,
  params: Record<string, string | number> = {},
): Promise<T> {
  const full = { ...params, timestamp: Date.now(), recvWindow: RECV_WINDOW };
  const query = buildQuery(full);
  const signature = await hmacSha256Hex(creds.apiSecret, query);
  const url = `${base}${path}?${query}&signature=${signature}`;
  const res = await fetch(url, {
    method,
    headers: { 'X-MBX-APIKEY': creds.apiKey, Accept: 'application/json' },
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`Binance ${path} ${res.status}: ${text.slice(0, 300)}`);
  }
  return JSON.parse(text) as T;
}

export async function getSpotBalances(creds: CexCredentials): Promise<NormalizedBalance[]> {
  const data = await signedRequest<{ balances: Array<{ asset: string; free: string; locked: string }> }>(
    creds,
    'GET',
    SPOT_BASE,
    '/api/v3/account',
  );
  return data.balances
    .map((b) => {
      const free = parseFloat(b.free);
      const locked = parseFloat(b.locked);
      return { walletType: 'spot' as const, asset: b.asset, free, locked, total: free + locked };
    })
    .filter((b) => b.total > 0);
}

export async function getFundingBalances(creds: CexCredentials): Promise<NormalizedBalance[]> {
  const rows = await signedRequest<Array<{ asset: string; free: string; locked: string; freeze: string }>>(
    creds,
    'POST',
    SPOT_BASE,
    '/sapi/v1/asset/get-funding-asset',
  );
  return (rows ?? [])
    .map((b) => {
      const free = parseFloat(b.free);
      const locked = parseFloat(b.locked ?? '0') + parseFloat(b.freeze ?? '0');
      return { walletType: 'funding' as const, asset: b.asset, free, locked, total: free + locked };
    })
    .filter((b) => b.total > 0);
}

export async function getFuturesBalances(creds: CexCredentials): Promise<NormalizedBalance[]> {
  // USDⓈ-M futures wallet balance.
  const rows = await signedRequest<Array<{ asset: string; balance: string; availableBalance: string }>>(
    creds,
    'GET',
    FUTURES_BASE,
    '/fapi/v2/balance',
  );
  return (rows ?? [])
    .map((b) => {
      const total = parseFloat(b.balance);
      const free = parseFloat(b.availableBalance);
      return { walletType: 'futures' as const, asset: b.asset, free, locked: total - free, total };
    })
    .filter((b) => b.total > 0);
}

export async function getEarnBalances(creds: CexCredentials): Promise<NormalizedBalance[]> {
  const out: NormalizedBalance[] = [];
  // Simple Earn — Flexible
  try {
    const flex = await signedRequest<{ rows: Array<{ asset: string; totalAmount: string }> }>(
      creds,
      'GET',
      SPOT_BASE,
      '/sapi/v1/simple-earn/flexible/position',
      { size: 100, current: 1 },
    );
    for (const r of flex.rows ?? []) {
      const total = parseFloat(r.totalAmount);
      if (total > 0) out.push({ walletType: 'earn', asset: r.asset, free: 0, locked: total, total });
    }
  } catch {
    /* abaikan */
  }
  // Simple Earn — Locked
  try {
    const locked = await signedRequest<{ rows: Array<{ asset: string; amount: string }> }>(
      creds,
      'GET',
      SPOT_BASE,
      '/sapi/v1/simple-earn/locked/position',
      { size: 100, current: 1 },
    );
    for (const r of locked.rows ?? []) {
      const total = parseFloat(r.amount);
      if (total > 0) {
        const existing = out.find((x) => x.asset === r.asset);
        if (existing) {
          existing.locked += total;
          existing.total += total;
        } else {
          out.push({ walletType: 'earn', asset: r.asset, free: 0, locked: total, total });
        }
      }
    }
  } catch {
    /* abaikan */
  }
  return out;
}

export async function getAllBalances(creds: CexCredentials): Promise<NormalizedBalance[]> {
  const results = await Promise.allSettled([
    getSpotBalances(creds),
    getFuturesBalances(creds),
    getFundingBalances(creds),
    getEarnBalances(creds),
  ]);
  const out: NormalizedBalance[] = [];
  for (const r of results) if (r.status === 'fulfilled') out.push(...r.value);
  // Lempar error hanya bila SEMUA gagal (kemungkinan kredensial salah).
  if (out.length === 0 && results.every((r) => r.status === 'rejected')) {
    const first = results.find((r) => r.status === 'rejected') as PromiseRejectedResult | undefined;
    throw new Error(first?.reason?.message ?? 'Semua endpoint Binance gagal');
  }
  // Hindari double-count: posisi Simple Earn muncul lagi di spot sebagai "LD"+aset
  // (token Flexible Savings). Buang entri spot LDx bila underlying-nya sudah ada di earn.
  const earnAssets = new Set(out.filter((b) => b.walletType === 'earn').map((b) => b.asset.toUpperCase()));
  return out.filter(
    (b) =>
      !(
        b.walletType === 'spot' &&
        b.asset.toUpperCase().startsWith('LD') &&
        earnAssets.has(b.asset.toUpperCase().slice(2))
      ),
  );
}

interface BinanceDepositRow {
  amount: string;
  coin: string;
  network: string;
  status: number;
  address: string;
  txId: string;
  insertTime: number;
}

const DEPOSIT_STATUS: Record<number, string> = { 0: 'pending', 6: 'credited', 1: 'success' };
const DEPOSIT_PAGE_LIMIT = 1000; // maksimum Binance per halaman
const MAX_PAGES_PER_WINDOW = 20; // pengaman: 20k deposit / 90 hari sudah jauh lebih dari cukup

function normalizeDeposit(r: BinanceDepositRow): NormalizedDeposit {
  return {
    txId: r.txId || `${r.coin}-${r.insertTime}-${r.amount}`,
    asset: r.coin,
    amount: parseFloat(r.amount),
    network: r.network,
    address: r.address,
    status: DEPOSIT_STATUS[r.status] ?? String(r.status),
    ts: r.insertTime,
    raw: r,
  };
}

/** Riwayat deposit. `startTime` epoch ms (opsional). Tanpa startTime → 90 hari terakhir. */
export async function getDepositHistory(
  creds: CexCredentials,
  startTime?: number,
): Promise<NormalizedDeposit[]> {
  const params: Record<string, string | number> = { limit: DEPOSIT_PAGE_LIMIT };
  if (startTime) params.startTime = startTime;
  const rows = await signedRequest<BinanceDepositRow[]>(
    creds,
    'GET',
    SPOT_BASE,
    '/sapi/v1/capital/deposit/hisrec',
    params,
  );
  return (rows ?? []).map(normalizeDeposit);
}

/**
 * Riwayat deposit dalam satu jendela [startTime, endTime] (Binance membatasi <= 90 hari),
 * dengan paginasi `offset` sampai halaman terakhir. Dipakai untuk backfill full history.
 */
export async function getDepositHistoryRange(
  creds: CexCredentials,
  startTime: number,
  endTime: number,
): Promise<NormalizedDeposit[]> {
  const out: NormalizedDeposit[] = [];
  for (let page = 0; page < MAX_PAGES_PER_WINDOW; page++) {
    const rows = await signedRequest<BinanceDepositRow[]>(
      creds,
      'GET',
      SPOT_BASE,
      '/sapi/v1/capital/deposit/hisrec',
      { startTime, endTime, offset: page * DEPOSIT_PAGE_LIMIT, limit: DEPOSIT_PAGE_LIMIT },
    );
    const batch = (rows ?? []).map(normalizeDeposit);
    out.push(...batch);
    if (batch.length < DEPOSIT_PAGE_LIMIT) break; // halaman terakhir
  }
  return out;
}
