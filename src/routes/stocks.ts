import { Hono } from 'hono';
import type { Env, Variables, StockConfig } from '../types';
import { queryAll } from '../lib/db';
import { ok } from '../lib/response';
import { getStockQuotes, getUsdRates } from '../services/prices';

const app = new Hono<{ Bindings: Env; Variables: Variables }>();

interface AggPos {
  ticker: string;
  lots: number;
  shares: number;
  costIdr: number; // total modal (IDR) = Σ lembar × harga beli
}

/**
 * Daftar posisi saham IDX + untung/rugi (cost basis).
 * Agregasi per ticker dari semua account type 'idx' yang aktif (harga beli rata-rata berbobot).
 * Harga pasar dari Yahoo (IDR), nilai USD memakai kurs IDR yang sama dengan pipeline valuasi.
 */
app.get('/', async (c) => {
  const accounts = await queryAll<{ config: string | null }>(
    c.env,
    "SELECT config FROM accounts WHERE type = 'idx' AND enabled = 1",
  );

  const byTicker = new Map<string, AggPos>();
  for (const a of accounts) {
    let cfg: StockConfig;
    try {
      cfg = JSON.parse(a.config ?? '{}') as StockConfig;
    } catch {
      continue;
    }
    for (const p of cfg.positions ?? []) {
      const ticker = String(p.ticker ?? '').trim().toUpperCase();
      const lots = Number(p.lots);
      const avgPrice = Number(p.avgPrice);
      if (!ticker || !isFinite(lots) || lots <= 0 || !isFinite(avgPrice) || avgPrice < 0) continue;
      const shares = lots * 100;
      const agg = byTicker.get(ticker) ?? { ticker, lots: 0, shares: 0, costIdr: 0 };
      agg.lots += lots;
      agg.shares += shares;
      agg.costIdr += shares * avgPrice;
      byTicker.set(ticker, agg);
    }
  }

  const tickers = [...byTicker.keys()];
  if (!tickers.length) {
    return ok(c, { positions: [], totals: { costUsd: 0, marketUsd: 0, plUsd: 0, plPct: 0, idrUsd: 0 } });
  }

  const symbols = tickers.map((t) => `${t}.JK`);
  const [quotes, rates] = await Promise.all([
    getStockQuotes(c.env, symbols),
    getUsdRates(c.env, ['IDR']),
  ]);
  const idrUsd = rates['IDR'] ?? 0;

  let totCostIdr = 0;
  let totMarketIdr = 0;
  const positions = [...byTicker.values()].map((agg) => {
    const q = quotes[`${agg.ticker}.JK`];
    const priceIdr = q?.priceIdr ?? 0;
    const avgPriceIdr = agg.shares > 0 ? agg.costIdr / agg.shares : 0;
    const marketIdr = agg.shares * priceIdr;
    const plIdr = marketIdr - agg.costIdr;
    totCostIdr += agg.costIdr;
    totMarketIdr += marketIdr;
    return {
      ticker: agg.ticker,
      lots: agg.lots,
      shares: agg.shares,
      avgPriceIdr,
      priceIdr,
      changePct: q?.changePct ?? 0,
      costIdr: agg.costIdr,
      marketIdr,
      plIdr,
      plPct: agg.costIdr > 0 ? (plIdr / agg.costIdr) * 100 : 0,
      // Nilai USD (memakai kurs IDR pipeline valuasi).
      costUsd: agg.costIdr * idrUsd,
      marketUsd: marketIdr * idrUsd,
      plUsd: plIdr * idrUsd,
    };
  });
  positions.sort((a, b) => b.marketIdr - a.marketIdr);

  const totPlIdr = totMarketIdr - totCostIdr;
  return ok(c, {
    positions,
    totals: {
      costUsd: totCostIdr * idrUsd,
      marketUsd: totMarketIdr * idrUsd,
      plUsd: totPlIdr * idrUsd,
      costIdr: totCostIdr,
      marketIdr: totMarketIdr,
      plIdr: totPlIdr,
      plPct: totCostIdr > 0 ? (totPlIdr / totCostIdr) * 100 : 0,
      idrUsd,
    },
  });
});

export default app;
