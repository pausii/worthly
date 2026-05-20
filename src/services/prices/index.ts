import type { Env } from '../../types';
import { now, queryAll, run } from '../../lib/db';

// Stablecoin yang dianggap = 1 USD.
const STABLES = new Set(['USDT', 'USDC', 'BUSD', 'DAI', 'TUSD', 'FDUSD', 'USDD', 'USDP', 'USD']);

// Fiat yang dikonversi via Frankfurter (ECB). Daftar umum; bisa ditambah.
const FIATS = new Set([
  'IDR', 'EUR', 'JPY', 'GBP', 'AUD', 'CAD', 'CHF', 'CNY', 'HKD', 'SGD',
  'KRW', 'INR', 'MYR', 'THB', 'PHP', 'NZD', 'SEK', 'NOK', 'DKK', 'ZAR', 'TRY', 'BRL', 'MXN',
]);

const PRICE_TTL_MS = 60_000; // anggap harga di tabel `prices` valid 60 detik

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
  if (needCrypto.length) Object.assign(fetched, await fetchCryptoUsd(needCrypto));
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

/** Harga crypto via ticker publik Binance (anggap USDT ~= USD). */
async function fetchCryptoUsd(assets: string[]): Promise<Record<string, number>> {
  const out: Record<string, number> = {};
  const symbols = assets.map((a) => `${a}USDT`);
  try {
    const url = `https://api.binance.com/api/v3/ticker/price?symbols=${encodeURIComponent(
      JSON.stringify(symbols),
    )}`;
    const res = await fetch(url, { headers: { Accept: 'application/json' } });
    if (res.ok) {
      const rows = (await res.json()) as Array<{ symbol: string; price: string }>;
      for (const row of rows) {
        const asset = row.symbol.replace(/USDT$/, '');
        const p = parseFloat(row.price);
        if (isFinite(p) && p > 0) out[asset] = p;
      }
    }
  } catch {
    // diamkan; aset yang gagal akan jatuh ke fallback cache/0
  }
  return out;
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
  } catch {
    // diamkan
  }
  return out;
}
