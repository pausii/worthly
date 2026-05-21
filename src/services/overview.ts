import type { Env } from '../types';
import { now, queryAll, queryOne, run } from '../lib/db';
import { computeValuation, type PortfolioValue } from './valuation';
import { getUsdRates, get24hChangePct } from './prices';

const OVERVIEW_KEY = 'overview_cache';

export interface OverviewPayload {
  portfolios: (PortfolioValue & { change24hPct: number | null })[];
  grandTotalUsd: number;
  grandChangePct: number | null;
  assetChange: Record<string, number>;
  idrRate: number;
  pricedAt: number;
  computedAt: number;
}

/**
 * Hitung payload overview lengkap (valuasi + perubahan 24 jam + kurs IDR).
 * Operasi berat (fetch harga, valuasi) — dijalankan oleh worker, BUKAN saat UI memuat.
 */
export async function buildOverview(env: Env): Promise<OverviewPayload> {
  const dayAgo = Date.now() - 24 * 60 * 60 * 1000;
  const [valuation, rates, pastRows] = await Promise.all([
    computeValuation(env),
    getUsdRates(env, ['IDR']),
    queryAll<{ portfolio_id: number; total_usd: number }>(
      env,
      `SELECT ps.portfolio_id AS portfolio_id, ps.total_usd AS total_usd FROM portfolio_snapshots ps
       JOIN (SELECT portfolio_id, MAX(captured_at) AS mc FROM portfolio_snapshots
             WHERE captured_at <= ? GROUP BY portfolio_id) m
       ON m.portfolio_id = ps.portfolio_id AND m.mc = ps.captured_at`,
      dayAgo,
    ),
  ]);

  const assetSet = new Set<string>();
  for (const p of valuation.portfolios) for (const a of p.assets) assetSet.add(a.asset);
  const assetChange = await get24hChangePct(env, [...assetSet]);

  const pastMap = new Map(pastRows.map((r) => [r.portfolio_id, r.total_usd]));
  let grandPast = 0;
  let grandPastKnown = false;
  const portfolios = valuation.portfolios.map((p) => {
    const past = pastMap.get(p.id);
    let change24hPct: number | null = null;
    if (past !== undefined && past > 0) {
      change24hPct = ((p.totalUsd - past) / past) * 100;
      grandPast += past;
      grandPastKnown = true;
    }
    return { ...p, change24hPct };
  });
  const grandChangePct =
    grandPastKnown && grandPast > 0 ? ((valuation.grandTotalUsd - grandPast) / grandPast) * 100 : null;

  const usdPerIdr = rates['IDR'] ?? 0;
  return {
    portfolios,
    grandTotalUsd: valuation.grandTotalUsd,
    grandChangePct,
    assetChange,
    idrRate: usdPerIdr > 0 ? 1 / usdPerIdr : 0,
    pricedAt: valuation.pricedAt,
    computedAt: Date.now(),
  };
}

/** Hitung overview lalu simpan ke DB (settings). Dipanggil worker/cron & setelah mutasi. */
export async function refreshOverview(env: Env): Promise<OverviewPayload> {
  const payload = await buildOverview(env);
  await run(
    env,
    `INSERT INTO settings (key, value, updated_at) VALUES (?, ?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
    OVERVIEW_KEY,
    JSON.stringify(payload),
    now(),
  );
  return payload;
}

/** Baca overview tersimpan dari DB (tanpa hitung apa pun). Null bila belum ada. */
export async function getStoredOverview(env: Env): Promise<OverviewPayload | null> {
  const row = await queryOne<{ value: string }>(env, 'SELECT value FROM settings WHERE key = ?', OVERVIEW_KEY);
  if (!row?.value) return null;
  try {
    return JSON.parse(row.value) as OverviewPayload;
  } catch {
    return null;
  }
}
