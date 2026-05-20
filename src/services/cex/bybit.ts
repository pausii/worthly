import type { CexCredentials, NormalizedBalance, NormalizedDeposit, WalletType } from '../../types';
import { hmacSha256Hex } from '../../lib/crypto';

const BASE = 'https://api.bybit.com';
const RECV_WINDOW = '5000';

function buildQuery(params: Record<string, string | number>): string {
  return Object.entries(params)
    .filter(([, v]) => v !== undefined && v !== '')
    .map(([k, v]) => `${k}=${v}`)
    .join('&');
}

/**
 * Signed request Bybit V5.
 * GET : sign = HMAC(timestamp + apiKey + recvWindow + queryString)
 * POST: sign = HMAC(timestamp + apiKey + recvWindow + rawJsonBody)
 */
async function signedRequest<T>(
  creds: CexCredentials,
  method: 'GET' | 'POST',
  path: string,
  params: Record<string, string | number> = {},
): Promise<T> {
  const timestamp = Date.now().toString();
  let url = `${BASE}${path}`;
  let body: string | undefined;
  let payload: string;

  if (method === 'GET') {
    const qs = buildQuery(params);
    if (qs) url += `?${qs}`;
    payload = timestamp + creds.apiKey + RECV_WINDOW + qs;
  } else {
    body = JSON.stringify(params);
    payload = timestamp + creds.apiKey + RECV_WINDOW + body;
  }

  const sign = await hmacSha256Hex(creds.apiSecret, payload);
  const res = await fetch(url, {
    method,
    headers: {
      'X-BAPI-API-KEY': creds.apiKey,
      'X-BAPI-TIMESTAMP': timestamp,
      'X-BAPI-RECV-WINDOW': RECV_WINDOW,
      'X-BAPI-SIGN': sign,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body,
  });
  const data = (await res.json()) as { retCode: number; retMsg: string; result: T };
  if (data.retCode !== 0) {
    throw new Error(`Bybit ${path} retCode=${data.retCode}: ${data.retMsg}`);
  }
  return data.result;
}

interface WalletResult {
  list: Array<{
    accountType: string;
    coin: Array<{ coin: string; walletBalance: string; locked: string; free?: string }>;
  }>;
}

async function getWalletBalance(
  creds: CexCredentials,
  accountType: string,
  walletType: WalletType,
): Promise<NormalizedBalance[]> {
  const result = await signedRequest<WalletResult>(creds, 'GET', '/v5/account/wallet-balance', {
    accountType,
  });
  const out: NormalizedBalance[] = [];
  for (const acc of result.list ?? []) {
    for (const c of acc.coin ?? []) {
      const total = parseFloat(c.walletBalance || '0');
      const locked = parseFloat(c.locked || '0');
      const free = c.free !== undefined ? parseFloat(c.free) : total - locked;
      if (total > 0) out.push({ walletType, asset: c.coin, free, locked, total });
    }
  }
  return out;
}

export async function getEarnBalances(creds: CexCredentials): Promise<NormalizedBalance[]> {
  const out: NormalizedBalance[] = [];
  for (const category of ['FlexibleSaving', 'OnChain']) {
    try {
      const result = await signedRequest<{ list: Array<{ coin: string; amount: string }> }>(
        creds,
        'GET',
        '/v5/earn/position',
        { category },
      );
      for (const p of result.list ?? []) {
        const total = parseFloat(p.amount || '0');
        if (total > 0) out.push({ walletType: 'earn', asset: p.coin, free: 0, locked: total, total });
      }
    } catch {
      /* sebagian akun tidak punya akses earn — abaikan */
    }
  }
  return out;
}

export async function getAllBalances(creds: CexCredentials): Promise<NormalizedBalance[]> {
  // UNIFIED mencakup spot + derivatif untuk Unified Trading Account.
  const results = await Promise.allSettled([
    getWalletBalance(creds, 'UNIFIED', 'spot'),
    getWalletBalance(creds, 'FUND', 'funding'),
    getEarnBalances(creds),
  ]);
  const out: NormalizedBalance[] = [];
  for (const r of results) if (r.status === 'fulfilled') out.push(...r.value);
  if (out.length === 0 && results.every((r) => r.status === 'rejected')) {
    const first = results.find((r) => r.status === 'rejected') as PromiseRejectedResult | undefined;
    throw new Error(first?.reason?.message ?? 'Semua endpoint Bybit gagal');
  }
  return out;
}

export async function getDepositHistory(
  creds: CexCredentials,
  startTime?: number,
): Promise<NormalizedDeposit[]> {
  const params: Record<string, string | number> = { limit: 50 };
  if (startTime) params.startTime = startTime;
  const result = await signedRequest<{
    rows: Array<{
      coin: string;
      chain: string;
      amount: string;
      txID: string;
      status: number;
      toAddress: string;
      successAt: string;
    }>;
  }>(creds, 'GET', '/v5/asset/deposit/query-record', params);
  const statusMap: Record<number, string> = { 0: 'unknown', 1: 'pending', 2: 'pending', 3: 'success' };
  return (result.rows ?? []).map((r) => ({
    txId: r.txID || `${r.coin}-${r.successAt}-${r.amount}`,
    asset: r.coin,
    amount: parseFloat(r.amount),
    network: r.chain,
    address: r.toAddress,
    status: statusMap[r.status] ?? String(r.status),
    ts: parseInt(r.successAt, 10) || Date.now(),
    raw: r,
  }));
}
