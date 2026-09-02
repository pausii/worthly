import type { CexBalanceFetch, CexCredentials, NormalizedBalance, NormalizedDeposit, WalletType } from '../../types';
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
  relayUrl?: string,
): Promise<T> {
  const full = { ...params, timestamp: Date.now(), recvWindow: RECV_WINDOW };
  const query = buildQuery(full);
  const signature = await hmacSha256Hex(creds.apiSecret, query);

  // Saat relay aktif: ganti host dengan relay, path & query tetap sama.
  // Nginx relay forward ke Binance berdasarkan path prefix (/api/, /sapi/, /fapi/).
  const targetBase = relayUrl ? new URL(relayUrl).origin : base;
  const url = `${targetBase}${path}?${query}&signature=${signature}`;

  const headers: Record<string, string> = { 'X-MBX-APIKEY': creds.apiKey, Accept: 'application/json' };
  if (relayUrl) {
    const r = new URL(relayUrl);
    if (r.username) {
      headers['Authorization'] = `Basic ${btoa(`${decodeURIComponent(r.username)}:${decodeURIComponent(r.password)}`)}`;
    }
  }

  const res = await fetch(url, { method, headers });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`Binance ${path} ${res.status}: ${text.slice(0, 300)}`);
  }
  return JSON.parse(text) as T;
}

export async function getSpotBalances(creds: CexCredentials, proxyUrl?: string): Promise<NormalizedBalance[]> {
  const data = await signedRequest<{ balances: Array<{ asset: string; free: string; locked: string }> }>(
    creds,
    'GET',
    SPOT_BASE,
    '/api/v3/account',
    {},
    proxyUrl,
  );
  return data.balances
    .map((b) => {
      const free = parseFloat(b.free);
      const locked = parseFloat(b.locked);
      return { walletType: 'spot' as const, asset: b.asset, free, locked, total: free + locked };
    })
    .filter((b) => b.total > 0);
}

export async function getFundingBalances(creds: CexCredentials, proxyUrl?: string): Promise<NormalizedBalance[]> {
  const rows = await signedRequest<Array<{ asset: string; free: string; locked: string; freeze: string }>>(
    creds,
    'POST',
    SPOT_BASE,
    '/sapi/v1/asset/get-funding-asset',
    {},
    proxyUrl,
  );
  return (rows ?? [])
    .map((b) => {
      const free = parseFloat(b.free);
      const locked = parseFloat(b.locked ?? '0') + parseFloat(b.freeze ?? '0');
      return { walletType: 'funding' as const, asset: b.asset, free, locked, total: free + locked };
    })
    .filter((b) => b.total > 0);
}

export async function getFuturesBalances(creds: CexCredentials, proxyUrl?: string): Promise<NormalizedBalance[]> {
  // USDⓈ-M futures wallet balance.
  const rows = await signedRequest<Array<{ asset: string; balance: string; availableBalance: string }>>(
    creds,
    'GET',
    FUTURES_BASE,
    '/fapi/v2/balance',
    {},
    proxyUrl,
  );
  return (rows ?? [])
    .map((b) => {
      const total = parseFloat(b.balance);
      const free = parseFloat(b.availableBalance);
      return { walletType: 'futures' as const, asset: b.asset, free, locked: total - free, total };
    })
    .filter((b) => b.total > 0);
}

/**
 * Simple Earn (Flexible + Locked). Sebagian API key tidak punya akses Earn, jadi kegagalan
 * satu kategori ditoleransi. Tapi kalau SEMUA kategori gagal, lempar error — kalau tidak,
 * pemadaman total akan terbaca sebagai "earn kosong" dan menghapus saldo earn yang tersimpan.
 */
export async function getEarnBalances(creds: CexCredentials, proxyUrl?: string): Promise<NormalizedBalance[]> {
  const out: NormalizedBalance[] = [];
  const errors: string[] = [];
  // Simple Earn — Flexible
  try {
    const flex = await signedRequest<{ rows: Array<{ asset: string; totalAmount: string }> }>(
      creds,
      'GET',
      SPOT_BASE,
      '/sapi/v1/simple-earn/flexible/position',
      { size: 100, current: 1 },
      proxyUrl,
    );
    for (const r of flex.rows ?? []) {
      const total = parseFloat(r.totalAmount);
      if (total > 0) out.push({ walletType: 'earn', asset: r.asset, free: 0, locked: total, total });
    }
  } catch (e) {
    errors.push(e instanceof Error ? e.message : String(e));
  }
  // Simple Earn — Locked
  try {
    const locked = await signedRequest<{ rows: Array<{ asset: string; amount: string }> }>(
      creds,
      'GET',
      SPOT_BASE,
      '/sapi/v1/simple-earn/locked/position',
      { size: 100, current: 1 },
      proxyUrl,
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
  } catch (e) {
    errors.push(e instanceof Error ? e.message : String(e));
  }
  if (errors.length === 2) throw new Error(`Simple Earn gagal — ${errors.join(' | ')}`);
  return out;
}

/**
 * Hindari double-count: posisi Simple Earn muncul lagi di spot sebagai "LD"+aset
 * (token Flexible Savings). Buang entri spot LDx bila underlying-nya sudah dihitung di earn.
 * `earnAssets` dipasok pemanggil karena dompet earn bisa saja gagal diambil pada siklus ini —
 * yang dipakai lalu adalah aset earn yang tersimpan sebelumnya.
 */
export function dropEarnDuplicates(
  balances: NormalizedBalance[],
  earnAssets: Set<string>,
): NormalizedBalance[] {
  return balances.filter(
    (b) =>
      !(
        b.walletType === 'spot' &&
        b.asset.toUpperCase().startsWith('LD') &&
        earnAssets.has(b.asset.toUpperCase().slice(2))
      ),
  );
}

/**
 * Ambil saldo semua dompet. Tiap dompet dilaporkan berhasil/gagal secara terpisah supaya
 * kegagalan sebagian (mis. 451 geo, rate-limit, izin API key kurang) tidak menghapus saldo
 * dompet lain — pemanggil hanya menimpa dompet yang ada di `synced`.
 */
export async function getAllBalances(creds: CexCredentials, proxyUrl?: string): Promise<CexBalanceFetch> {
  const sources: Array<[WalletType, Promise<NormalizedBalance[]>]> = [
    ['spot', getSpotBalances(creds, proxyUrl)],
    ['futures', getFuturesBalances(creds, proxyUrl)],
    ['funding', getFundingBalances(creds, proxyUrl)],
    ['earn', getEarnBalances(creds, proxyUrl)],
  ];
  const results = await Promise.allSettled(sources.map(([, p]) => p));

  const balances: NormalizedBalance[] = [];
  const synced: WalletType[] = [];
  const failures: CexBalanceFetch['failures'] = [];
  results.forEach((r, i) => {
    const wallet = sources[i][0];
    if (r.status === 'fulfilled') {
      balances.push(...r.value);
      synced.push(wallet);
    } else {
      failures.push({ wallet, message: r.reason instanceof Error ? r.reason.message : String(r.reason) });
    }
  });
  if (!synced.length)
    throw new Error(`Semua endpoint Binance gagal — ${failures.map((f) => `${f.wallet}: ${f.message}`).join(' | ')}`);
  return { balances, synced, failures };
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
  proxyUrl?: string,
): Promise<NormalizedDeposit[]> {
  const params: Record<string, string | number> = { limit: DEPOSIT_PAGE_LIMIT };
  if (startTime) params.startTime = startTime;
  const rows = await signedRequest<BinanceDepositRow[]>(
    creds,
    'GET',
    SPOT_BASE,
    '/sapi/v1/capital/deposit/hisrec',
    params,
    proxyUrl,
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
  proxyUrl?: string,
): Promise<NormalizedDeposit[]> {
  const out: NormalizedDeposit[] = [];
  for (let page = 0; page < MAX_PAGES_PER_WINDOW; page++) {
    const rows = await signedRequest<BinanceDepositRow[]>(
      creds,
      'GET',
      SPOT_BASE,
      '/sapi/v1/capital/deposit/hisrec',
      { startTime, endTime, offset: page * DEPOSIT_PAGE_LIMIT, limit: DEPOSIT_PAGE_LIMIT },
      proxyUrl,
    );
    const batch = (rows ?? []).map(normalizeDeposit);
    out.push(...batch);
    if (batch.length < DEPOSIT_PAGE_LIMIT) break; // halaman terakhir
  }
  return out;
}
