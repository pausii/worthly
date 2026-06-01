import type { Env } from '../../types';
import { now, queryAll, run } from '../../lib/db';
import { isCooling, setCooldown } from '../../lib/cooldown';

const BINANCE_COOLDOWN = 'cex:binance';
const BINANCE_COOLDOWN_SECONDS = 900; // 15 menit setelah 451

// Stablecoin yang dianggap = 1 USD.
const STABLES = new Set(['USDT', 'USDC', 'BUSD', 'DAI', 'TUSD', 'FDUSD', 'USDD', 'USDP', 'USD']);

// Fiat yang dikonversi via Frankfurter (ECB). Daftar umum; bisa ditambah.
const FIATS = new Set([
  'IDR', 'EUR', 'JPY', 'GBP', 'AUD', 'CAD', 'CHF', 'CNY', 'HKD', 'SGD',
  'KRW', 'INR', 'MYR', 'THB', 'PHP', 'NZD', 'SEK', 'NOK', 'DKK', 'ZAR', 'TRY', 'BRL', 'MXN',
]);

const PRICE_TTL_MS = 60_000; // anggap harga di tabel `prices` valid 60 detik

// Daily close historis hampir tak berubah. Refresh bila lebih tua dari window ini,
// tapi simpan di KV jauh lebih lama sebagai fallback saat Binance/relay sesekali gagal —
// supaya chart menyajikan data sedikit basi, bukan kosong total.
const KLINES_FRESH_MS = 6 * 60 * 60 * 1000; // 6 jam
const KLINES_TTL_SECONDS = 30 * 24 * 60 * 60; // 30 hari

// Host market-data publik Binance. data-api.binance.com lebih sering lolos geo-block (451)
// dibanding api.binance.com; dicoba lebih dulu.
const BINANCE_PUBLIC_HOSTS = ['https://data-api.binance.com', 'https://api.binance.com'];

/**
 * GET endpoint publik Binance; coba tiap host sampai ada yang OK (mengatasi 451 geo-block).
 * Hormati circuit breaker: lewati bila sedang cooldown; set cooldown bila kena 451 (hindari
 * terus menghantam IP yang ke-flag).
 *
 * Bila `BINANCE_PROXY_URL` di-set, request dirutekan lewat relay (IP-nya sudah lolos geo-block) —
 * sama seperti jalur signed di services/cex/binance.ts. Endpoint publik semuanya di bawah prefix
 * `/api/`, yang sudah di-forward relay. Tanpa relay, jatuh ke host langsung.
 */
async function binancePublicGet(env: Env, pathWithQuery: string): Promise<Response | null> {
  if (await isCooling(env, BINANCE_COOLDOWN)) return null;

  const headers: Record<string, string> = { Accept: 'application/json' };
  let hosts = BINANCE_PUBLIC_HOSTS;
  if (env.BINANCE_PROXY_URL) {
    const r = new URL(env.BINANCE_PROXY_URL);
    hosts = [r.origin];
    if (r.username) {
      headers['Authorization'] = `Basic ${btoa(`${decodeURIComponent(r.username)}:${decodeURIComponent(r.password)}`)}`;
    }
  }

  const ep = pathWithQuery.split('?')[0];
  for (const host of hosts) {
    try {
      const res = await fetch(host + pathWithQuery, { headers });
      if (res.ok) return res;
      if (res.status === 451) {
        await setCooldown(env, BINANCE_COOLDOWN, BINANCE_COOLDOWN_SECONDS);
        console.error(`[prices] Binance 451 geo-block ${host}${ep} — cooldown ${BINANCE_COOLDOWN_SECONDS}s`);
        return null;
      }
      console.error(`[prices] Binance ${res.status} ${host}${ep}`);
    } catch (e) {
      console.error(`[prices] fetch gagal ${host}${ep}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }
  return null;
}

export interface PricePoint {
  t: number; // openTime kline (epoch ms, UTC midnight untuk interval 1d)
  c: number; // harga close USDT
}

/**
 * Daily close (USDT) untuk satu simbol via Binance `/api/v3/klines`.
 * Di-cache di KV ~6 jam (data harian jarang berubah intraday). `limit` = jumlah hari (max 1000).
 * Mengembalikan [] bila simbol tak ada / ter-geo-block.
 */
export async function getDailyCloses(env: Env, symbol: string, limit: number): Promise<PricePoint[]> {
  const lim = Math.min(Math.max(limit, 1), 1000);
  const KEY = `klines:${symbol}:1d:${lim}`;
  let cached: { ts: number; pts: PricePoint[] } | null = null;
  try {
    cached = (await env.KV.get(KEY, 'json')) as { ts: number; pts: PricePoint[] } | null;
    if (cached && Date.now() - cached.ts < KLINES_FRESH_MS) return cached.pts;
    const res = await binancePublicGet(env, `/api/v3/klines?symbol=${symbol}&interval=1d&limit=${lim}`);
    if (res) {
      const rows = (await res.json()) as unknown[][];
      const pts: PricePoint[] = [];
      for (const r of rows) {
        const t = Number(r[0]);
        const c = parseFloat(String(r[4]));
        if (isFinite(t) && isFinite(c) && c > 0) pts.push({ t, c });
      }
      // Hanya timpa cache bila fetch benar-benar menghasilkan data; jangan kosongkan fallback.
      if (pts.length) await env.KV.put(KEY, JSON.stringify({ ts: Date.now(), pts }), { expirationTtl: KLINES_TTL_SECONDS });
      return pts.length ? pts : (cached?.pts ?? []);
    }
  } catch (e) {
    console.error(`[prices] getDailyCloses ${symbol} gagal: ${e instanceof Error ? e.message : String(e)}`);
  }
  return cached?.pts ?? [];
}

export function classifyAsset(asset: string): 'stable' | 'fiat' | 'crypto' {
  const a = asset.toUpperCase();
  if (STABLES.has(a)) return 'stable';
  if (FIATS.has(a)) return 'fiat';
  return 'crypto';
}

/** Ambil rate USD untuk daftar aset. Hasil: { ASSET: usdPerUnit }. */
export async function getUsdRates(env: Env, assetsRaw: string[]): Promise<Record<string, number>> {
  const assets = Array.from(new Set(assetsRaw.map((a) => a.toUpperCase()).filter(Boolean)));
  const result: Record<string, number> = {};
  const needCrypto: string[] = [];
  const needFiat: string[] = [];

  // 1) Gunakan cache di tabel `prices` yang masih segar.
  const cached = await queryAll<{ asset: string; usd: number; updated_at: number }>(
    env,
    `SELECT asset, usd, updated_at FROM prices`,
  );
  const cacheMap = new Map(cached.map((r) => [r.asset, r]));
  const fresh = now() - PRICE_TTL_MS;

  for (const asset of assets) {
    const kind = classifyAsset(asset);
    if (kind === 'stable') {
      result[asset] = 1;
      continue;
    }
    const c = cacheMap.get(asset);
    if (c && c.updated_at >= fresh) {
      result[asset] = c.usd;
      continue;
    }
    if (kind === 'fiat') needFiat.push(asset);
    else needCrypto.push(asset);
  }

  // 2) Fetch yang belum tersedia.
  const fetched: Record<string, number> = {};
  if (needCrypto.length) Object.assign(fetched, await fetchCryptoUsd(env, needCrypto));
  if (needFiat.length) Object.assign(fetched, await fetchFiatUsd(needFiat));

  // 3) Simpan ke cache + isi hasil. Kalau gagal fetch, fallback ke cache lama bila ada.
  const ts = now();
  for (const asset of [...needCrypto, ...needFiat]) {
    const value = fetched[asset];
    if (typeof value === 'number' && isFinite(value) && value > 0) {
      result[asset] = value;
      await run(
        env,
        `INSERT INTO prices (asset, usd, source, updated_at) VALUES (?, ?, ?, ?)
         ON CONFLICT(asset) DO UPDATE SET usd = excluded.usd, source = excluded.source, updated_at = excluded.updated_at`,
        asset,
        value,
        FIATS.has(asset) ? 'frankfurter' : 'binance',
        ts,
      );
    } else {
      const stale = cacheMap.get(asset);
      result[asset] = stale ? stale.usd : 0;
    }
  }

  return result;
}

/**
 * Map seluruh harga ticker Binance (symbol -> price), di-cache di KV ~60 dtk.
 * Pakai endpoint TANPA params: satu simbol tak-valid (mis. `LD*` Flexible Savings,
 * atau token belum listing) membuat batch `?symbols=[...]` balas 400 dan menggagalkan
 * SEMUA harga. Ambil semua lalu lookup lokal jauh lebih tahan-banting.
 */
async function getBinanceTickerMap(env: Env): Promise<Record<string, number>> {
  const KEY = 'binance:tickers';
  let cached: { ts: number; map: Record<string, number> } | null = null;
  try {
    cached = (await env.KV.get(KEY, 'json')) as { ts: number; map: Record<string, number> } | null;
    if (cached && Date.now() - cached.ts < 60_000) return cached.map;
    const res = await binancePublicGet(env, '/api/v3/ticker/price');
    if (res) {
      const rows = (await res.json()) as Array<{ symbol: string; price: string }>;
      const map: Record<string, number> = {};
      for (const r of rows) {
        const p = parseFloat(r.price);
        if (isFinite(p) && p > 0) map[r.symbol] = p;
      }
      await env.KV.put(KEY, JSON.stringify({ ts: Date.now(), map }), { expirationTtl: 120 });
      return map;
    }
  } catch (e) {
    console.error(`[prices] tickerMap gagal: ${e instanceof Error ? e.message : String(e)}`);
  }
  return cached?.map ?? {};
}

/** Harga crypto -> USD (anggap USDT ~= USD), via map ticker Binance. */
async function fetchCryptoUsd(env: Env, assets: string[]): Promise<Record<string, number>> {
  const map = await getBinanceTickerMap(env);
  const out: Record<string, number> = {};
  for (const a of assets) {
    const p = map[a.toUpperCase() + 'USDT'];
    if (typeof p === 'number' && p > 0) out[a.toUpperCase()] = p;
  }
  return out;
}

/**
 * Persentase perubahan harga 24 jam per aset crypto (Binance `/ticker/24hr`).
 * Hanya minta simbol yang valid (ada di map ticker) agar batch tak kena 400.
 * Hasil di-cache & di-merge di KV ~60 dtk (key stabil).
 */
export async function get24hChangePct(env: Env, assetsRaw: string[]): Promise<Record<string, number>> {
  const map = await getBinanceTickerMap(env);
  const assets = Array.from(new Set(assetsRaw.map((a) => a.toUpperCase()))).filter(
    (a) => classifyAsset(a) === 'crypto' && map[a + 'USDT'] !== undefined,
  );
  const KEY = 'binance:chg24';
  let store: { ts: number; chg: Record<string, number> } | null = null;
  try {
    store = (await env.KV.get(KEY, 'json')) as { ts: number; chg: Record<string, number> } | null;
    if (store && Date.now() - store.ts < 60_000) return store.chg;
    if (!assets.length) return store?.chg ?? {};
    const chg: Record<string, number> = { ...(store?.chg ?? {}) };
    const symbols = assets.map((a) => a + 'USDT');
    const res = await binancePublicGet(
      env,
      '/api/v3/ticker/24hr?symbols=' + encodeURIComponent(JSON.stringify(symbols)),
    );
    if (res) {
      const rows = (await res.json()) as Array<{ symbol: string; priceChangePercent: string }>;
      for (const r of rows) {
        const p = parseFloat(r.priceChangePercent);
        if (isFinite(p)) chg[r.symbol.replace(/USDT$/, '')] = p;
      }
      await env.KV.put(KEY, JSON.stringify({ ts: Date.now(), chg }), { expirationTtl: 120 });
    }
    return chg;
  } catch (e) {
    console.error(`[prices] 24hChange gagal: ${e instanceof Error ? e.message : String(e)}`);
    return store?.chg ?? {};
  }
}

/** Rate fiat -> USD via Frankfurter (ECB). */
async function fetchFiatUsd(assets: string[]): Promise<Record<string, number>> {
  const out: Record<string, number> = {};
  try {
    const to = assets.join(',');
    const url = `https://api.frankfurter.app/latest?from=USD&to=${encodeURIComponent(to)}`;
    const res = await fetch(url, { headers: { Accept: 'application/json' } });
    if (res.ok) {
      const data = (await res.json()) as { rates?: Record<string, number> };
      for (const asset of assets) {
        const usdToFiat = data.rates?.[asset];
        if (usdToFiat && usdToFiat > 0) out[asset] = 1 / usdToFiat; // 1 unit fiat = ? USD
      }
    }
  } catch (e) {
    console.error(`[prices] fiat (Frankfurter) gagal: ${e instanceof Error ? e.message : String(e)}`);
  }
  return out;
}
