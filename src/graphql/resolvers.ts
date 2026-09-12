import { GraphQLError } from 'graphql';
import { FIXED_ASSET_KINDS, type AccountType, type Env, type FixedAssetKind, type StockConfig } from '../types';
import { now, queryAll, queryOne, run } from '../lib/db';
import { hashPassword, verifyPassword, encryptSecret } from '../lib/crypto';
import { createSession, destroySession } from '../lib/session';
import { rateLimit, resetRateLimit } from '../lib/ratelimit';
import { isCooling } from '../lib/cooldown';
import { syncOne, startDepositBackfill, runDepositBackfill, syncAll } from '../services/sync';
import { getStoredOverview, refreshOverview } from '../services/overview';
import { computeCostBasis } from '../services/returns';
import { FIXED_ASSETS_LATEST_SQL } from '../services/valuation';
import {
  classifyAsset,
  getCryptoCandles,
  getDailyCloses,
  getStockCandles,
  getStockQuotes,
  getUsdRates,
} from '../services/prices';
import { JSONScalar } from './scalars';
import {
  buildSessionCookie,
  clearSessionCookieStr,
  type GraphQLContext,
} from './context';

/** Pengganti fail(c, msg): lempar error yang pesannya tampil apa adanya ke client. */
const fail = (message: string): never => {
  throw new GraphQLError(message);
};

// =================== auth ===================
interface UserRow {
  id: number;
  username: string;
  password_hash: string;
  password_salt: string;
  iterations: number;
}

async function userCount(env: Env): Promise<number> {
  const row = await queryOne<{ c: number }>(env, 'SELECT COUNT(*) AS c FROM users');
  return row?.c ?? 0;
}

// =================== accounts (helpers) ===================
const CEX_TYPES = new Set<AccountType>(['binance', 'bybit']);
const ONCHAIN_TYPES = new Set<AccountType>(['tron', 'eth', 'bsc', 'btc', 'sol']);
const STOCK_TYPES = new Set<AccountType>(['idx']);
const ALL_TYPES = new Set<AccountType>([...CEX_TYPES, ...ONCHAIN_TYPES, ...STOCK_TYPES]);

function parsePositions(raw: unknown): { ticker: string; lots: number; avgPrice: number }[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((p: any) => ({
      ticker: String(p?.ticker ?? '').trim().toUpperCase(),
      lots: Number(p?.lots),
      avgPrice: Number(p?.avgPrice),
    }))
    .filter((p) => p.ticker && isFinite(p.lots) && p.lots > 0 && isFinite(p.avgPrice) && p.avgPrice >= 0);
}

interface AccountRow {
  id: number;
  portfolio_id: number;
  type: string;
  label: string;
  enc_credentials: string | null;
  config: string | null;
  enabled: number;
  status: string | null;
  last_error: string | null;
  last_synced_at: number | null;
  created_at: number;
  updated_at: number;
}

function publicView(row: AccountRow) {
  let config: unknown = null;
  try {
    config = row.config ? JSON.parse(row.config) : null;
  } catch {
    config = null;
  }
  return {
    id: row.id,
    portfolio_id: row.portfolio_id,
    type: row.type,
    label: row.label,
    config,
    enabled: !!row.enabled,
    status: row.status,
    last_error: row.last_error,
    last_synced_at: row.last_synced_at,
    has_credentials: !!row.enc_credentials,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

// =================== holdings (helpers) ===================
const ALLOWED_CURRENCIES = new Set(['USD', 'IDR', 'JPY', 'SGD']);

// =================== fixed assets (helpers) ===================
interface FixedAssetLatestRow {
  id: number;
  portfolio_id: number;
  kind: string;
  label: string;
  currency: string;
  purchase_price: number;
  purchase_date: number;
  note: string | null;
  created_at: number;
  updated_at: number;
  value: number;
  valued_at: number;
  source: string | null;
}
interface ValuationRow {
  id: number;
  asset_id: number;
  value: number;
  valued_at: number;
  source: string | null;
  created_at: number;
}

/** Parse tanggal dari input (epoch ms atau string tanggal). Null bila tidak valid. */
function parseTs(v: unknown): number | null {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(v);
  if (isFinite(n) && n > 0) return n;
  const t = Date.parse(String(v));
  return isFinite(t) ? t : null;
}

function parseKind(v: unknown): FixedAssetKind | null {
  const k = String(v ?? '').trim().toLowerCase();
  return (FIXED_ASSET_KINDS as readonly string[]).includes(k) ? (k as FixedAssetKind) : null;
}

function parseCsv(text: string): string[][] {
  const s = text.replace(/^﻿/, '');
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (inQuotes) {
      if (ch === '"') {
        if (s[i + 1] === '"') { field += '"'; i++; }
        else inQuotes = false;
      } else field += ch;
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',') {
      row.push(field); field = '';
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && s[i + 1] === '\n') i++;
      row.push(field); field = '';
      if (row.length > 1 || row[0] !== '') rows.push(row);
      row = [];
    } else field += ch;
  }
  if (field !== '' || row.length) { row.push(field); if (row.length > 1 || row[0] !== '') rows.push(row); }
  return rows;
}

// =================== stocks (helpers) ===================
interface AggPos {
  ticker: string;
  lots: number;
  shares: number;
  costIdr: number;
}

// =================== export (helpers) ===================
type Cell = string | number | null | undefined;

function toCsv(headers: string[], rows: Cell[][]): string {
  const esc = (v: Cell) => {
    const s = v === null || v === undefined ? '' : String(v);
    return /[",\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  };
  return [headers.join(','), ...rows.map((r) => r.map(esc).join(','))].join('\r\n');
}

function iso(ts: unknown): string {
  const n = Number(ts);
  return isFinite(n) && n > 0 ? new Date(n).toISOString() : '';
}

// =================== dashboard (konstanta) ===================
const RETURNS_KV_KEY = 'returns_basis';
const INSIGHT_KV_KEY = 'ai_insight';
const INSIGHT_MODEL = '@cf/meta/llama-3.1-8b-instruct';

export const resolvers = {
  JSON: JSONScalar,

  Query: {
    // ---- auth ----
    async authStatus(_p: unknown, _a: unknown, ctx: GraphQLContext) {
      const needsSetup = (await userCount(ctx.env)) === 0;
      const authenticated = !!ctx.session;
      return { needsSetup, authenticated };
    },
    me(_p: unknown, _a: unknown, ctx: GraphQLContext) {
      const s = ctx.session!;
      return { username: s.username, csrf: s.csrf };
    },

    // ---- portfolios ----
    async portfolios(_p: unknown, _a: unknown, ctx: GraphQLContext) {
      return queryAll(
        ctx.env,
        'SELECT id, name, description, sort_order, created_at, updated_at FROM portfolios ORDER BY sort_order, id',
      );
    },

    // ---- accounts ----
    async accounts(_p: unknown, _a: unknown, ctx: GraphQLContext) {
      const env = ctx.env;
      const rows = await queryAll<AccountRow>(env, 'SELECT * FROM accounts ORDER BY portfolio_id, id');
      const states = await queryAll<{ account_id: number; value: string }>(
        env,
        "SELECT account_id, value FROM sync_state WHERE key = 'deposit_backfill'",
      );
      const stateMap = new Map(states.map((s) => [s.account_id, s.value]));

      const bals = await queryAll<{ account_id: number; asset: string; total: number }>(
        env,
        'SELECT account_id, asset, SUM(total) AS total FROM balances GROUP BY account_id, asset',
      );
      const assetSet = new Set<string>();
      for (const b of bals) assetSet.add(b.asset.toUpperCase());
      const rates = await getUsdRates(env, [...assetSet]);
      const valByAcc = new Map<number, { usd: number; count: number; assets: { asset: string; usd: number }[] }>();
      for (const b of bals) {
        if (!(b.total > 0)) continue;
        const usd = b.total * (rates[b.asset.toUpperCase()] ?? 0);
        let e = valByAcc.get(b.account_id);
        if (!e) {
          e = { usd: 0, count: 0, assets: [] };
          valByAcc.set(b.account_id, e);
        }
        e.usd += usd;
        e.count += 1;
        e.assets.push({ asset: b.asset.toUpperCase(), usd });
      }

      return rows.map((r) => {
        let backfill: unknown = null;
        const v = stateMap.get(r.id);
        if (v) {
          try {
            backfill = JSON.parse(v);
          } catch {
            backfill = null;
          }
        }
        const val = valByAcc.get(r.id);
        const topAssets = val
          ? [...val.assets].sort((a, b) => b.usd - a.usd).slice(0, 3).map((a) => a.asset)
          : [];
        return {
          ...publicView(r),
          deposit_backfill: backfill,
          value_usd: val?.usd ?? 0,
          asset_count: val?.count ?? 0,
          top_assets: topAssets,
        };
      });
    },
    async accountBalances(_p: unknown, { id }: { id: number }, ctx: GraphQLContext) {
      return queryAll(
        ctx.env,
        'SELECT wallet_type, asset, free, locked, total, updated_at FROM balances WHERE account_id = ? ORDER BY total DESC',
        id,
      );
    },

    // ---- holdings ----
    async holdings(_p: unknown, { portfolioId }: { portfolioId?: number }, ctx: GraphQLContext) {
      return portfolioId
        ? queryAll(
            ctx.env,
            'SELECT * FROM manual_holdings WHERE portfolio_id = ? ORDER BY added_at DESC, created_at DESC',
            Number(portfolioId),
          )
        : queryAll(ctx.env, 'SELECT * FROM manual_holdings ORDER BY added_at DESC, created_at DESC');
    },

    // ---- fixed assets ----
    async fixedAssets(_p: unknown, { portfolioId }: { portfolioId?: number }, ctx: GraphQLContext) {
      const env = ctx.env;
      const sql = FIXED_ASSETS_LATEST_SQL + (portfolioId ? ' WHERE f.portfolio_id = ?' : '') + ' ORDER BY f.label';
      const assets = portfolioId
        ? await queryAll<FixedAssetLatestRow>(env, sql, Number(portfolioId))
        : await queryAll<FixedAssetLatestRow>(env, sql);
      if (!assets.length) {
        return { assets: [], totals: { costUsd: 0, valueUsd: 0, plUsd: 0, plPct: 0, idrUsd: 0 } };
      }

      const ids = assets.map((a) => a.id);
      const [valuations, rates] = await Promise.all([
        queryAll<ValuationRow>(
          env,
          `SELECT id, asset_id, value, valued_at, source, created_at FROM fixed_asset_valuations
           WHERE asset_id IN (${ids.map(() => '?').join(',')}) ORDER BY valued_at DESC, id DESC`,
          ...ids,
        ),
        getUsdRates(env, [...new Set([...assets.map((a) => a.currency.toUpperCase()), 'IDR'])]),
      ]);
      const byAsset = new Map<number, ValuationRow[]>();
      for (const v of valuations) {
        const list = byAsset.get(v.asset_id) ?? [];
        list.push(v);
        byAsset.set(v.asset_id, list);
      }

      let totCost = 0;
      let totValue = 0;
      const out = assets.map((a) => {
        const rate = rates[a.currency.toUpperCase()] ?? 0;
        const costUsd = a.purchase_price * rate;
        const valueUsd = a.value * rate;
        totCost += costUsd;
        totValue += valueUsd;
        const pl = a.value - a.purchase_price;
        return {
          ...a,
          rate,
          costUsd,
          valueUsd,
          plUsd: pl * rate,
          plPct: a.purchase_price > 0 ? (pl / a.purchase_price) * 100 : 0,
          valuations: byAsset.get(a.id) ?? [],
        };
      });
      out.sort((x, y) => y.valueUsd - x.valueUsd);
      const totPl = totValue - totCost;
      return {
        assets: out,
        totals: {
          costUsd: totCost,
          valueUsd: totValue,
          plUsd: totPl,
          plPct: totCost > 0 ? (totPl / totCost) * 100 : 0,
          idrUsd: rates['IDR'] ?? 0,
        },
      };
    },

    // ---- stocks ----
    async stocks(_p: unknown, _a: unknown, ctx: GraphQLContext) {
      const env = ctx.env;
      const accounts = await queryAll<{ config: string | null }>(
        env,
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
        return { positions: [], totals: { costUsd: 0, marketUsd: 0, plUsd: 0, plPct: 0, idrUsd: 0 } };
      }

      const symbols = tickers.map((t) => `${t}.JK`);
      const [quotes, rates] = await Promise.all([
        getStockQuotes(env, symbols),
        getUsdRates(env, ['IDR']),
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
          costUsd: agg.costIdr * idrUsd,
          marketUsd: marketIdr * idrUsd,
          plUsd: plIdr * idrUsd,
        };
      });
      positions.sort((a, b) => b.marketIdr - a.marketIdr);

      const totPlIdr = totMarketIdr - totCostIdr;
      return {
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
      };
    },

    // ---- dashboard ----
    async overview(_p: unknown, _a: unknown, ctx: GraphQLContext) {
      const stored = await getStoredOverview(ctx.env);
      if (stored) return stored;
      return refreshOverview(ctx.env);
    },
    async history(_p: unknown, { portfolioId, days: daysParam }: { portfolioId?: number; days?: string }, ctx: GraphQLContext) {
      const env = ctx.env;
      const all = daysParam === 'all';
      const days = all ? 0 : Math.min(Math.max(Number(daysParam) || 30, 1), 3650);
      const since = all ? 0 : Date.now() - days * 24 * 60 * 60 * 1000;

      if (portfolioId) {
        return queryAll<{ captured_at: number; total_usd: number }>(
          env,
          'SELECT captured_at, total_usd FROM portfolio_snapshots WHERE portfolio_id = ? AND captured_at >= ? ORDER BY captured_at',
          Number(portfolioId),
          since,
        );
      }
      return queryAll<{ captured_at: number; total_usd: number }>(
        env,
        `SELECT captured_at, SUM(total_usd) AS total_usd FROM portfolio_snapshots
         WHERE captured_at >= ? GROUP BY captured_at ORDER BY captured_at`,
        since,
      );
    },
    async assetHistory(_p: unknown, { days: daysParam }: { days?: string }, ctx: GraphQLContext) {
      const env = ctx.env;
      const all = daysParam === 'all';
      const days = all ? 1000 : Math.min(Math.max(Number(daysParam) || 30, 1), 1000);

      const overview = (await getStoredOverview(env)) || (await refreshOverview(env));

      const amounts = new Map<string, number>();
      const usdValue = new Map<string, number>();
      const fixed = await queryAll<FixedAssetLatestRow>(env, FIXED_ASSETS_LATEST_SQL);
      const valuations = await queryAll<ValuationRow>(env,
        'SELECT * FROM fixed_asset_valuations ORDER BY valued_at, id');
      for (const p of overview.portfolios) {
        for (const a of p.assets) {
          if (a.origin === 'asset') {
            continue;
          }
          const amt = Number(a.amount);
          if (!isFinite(amt) || amt === 0) continue;
          const sym = a.asset.toUpperCase();
          amounts.set(sym, (amounts.get(sym) || 0) + amt);
          usdValue.set(sym, (usdValue.get(sym) || 0) + (Number(a.usd) || 0));
        }
      }

      const MIN_CRYPTO_USD = 1;
      const cryptoAssets: string[] = [];
      const constAssets: string[] = [];
      for (const sym of amounts.keys()) {
        if (classifyAsset(sym) !== 'crypto') constAssets.push(sym);
        else if ((usdValue.get(sym) || 0) >= MIN_CRYPTO_USD) cryptoAssets.push(sym);
      }
      const constRates = await getUsdRates(env, [...constAssets, ...fixed.map((f) => f.currency)]);

      const series = await Promise.all(
        cryptoAssets.map(async (sym) => ({ sym, m: new Map((await getDailyCloses(env, sym + 'USDT', days)).map((p) => [p.t, p.c])) })),
      );

      const daySet = new Set<number>();
      // Include daily points even when the portfolio contains only fixed assets.
      const dayMs = 86400000;
      const today = Math.floor(now() / dayMs) * dayMs;
      if (fixed.length) for (let i = 0; i < days; i++) daySet.add(today - i * dayMs);
      for (const s of series) for (const t of s.m.keys()) daySet.add(t);
      const timeline = [...daySet].sort((a, b) => a - b);

      const constUsd =
        constAssets.reduce((s, a) => s + (amounts.get(a) || 0) * (constRates[a] || 0), 0);
      const fixedValues = new Map<number, number>();
      let valuationIndex = 0;
      const last: Record<string, number> = {};
      const rows = timeline.map((t) => {
        let total = constUsd;
        const cutoff = Math.min(t + dayMs - 1, now());
        while (valuationIndex < valuations.length && valuations[valuationIndex].valued_at <= cutoff) {
          const v = valuations[valuationIndex++];
          fixedValues.set(v.asset_id, v.value);
        }
        for (const f of fixed) if (f.purchase_date <= cutoff) {
          total += (fixedValues.get(f.id) ?? f.purchase_price) * (constRates[f.currency] ?? 0);
        }
        for (const s of series) {
          const close = s.m.get(t);
          if (close !== undefined) last[s.sym] = close;
          const price = last[s.sym];
          if (price !== undefined) total += (amounts.get(s.sym) || 0) * price;
        }
        return { captured_at: t, total_usd: total };
      });

      const allPeaks = series
        .map((s) => {
          let peak = 0, peakAt = 0, current = 0, currentAt = -1;
          for (const [t, close] of s.m) {
            if (close > peak) { peak = close; peakAt = t; }
            if (t >= currentAt) { current = close; currentAt = t; }
          }
          return {
            asset: s.sym,
            peak,
            peakAt,
            current,
            fromPeakPct: peak > 0 ? ((current - peak) / peak) * 100 : 0,
            usd: usdValue.get(s.sym) || 0,
          };
        })
        .filter((p) => p.peak > 0);

      const peaks = allPeaks.slice().sort((a, b) => b.usd - a.usd).slice(0, 6);

      return { points: rows, peaks };
    },
    async assetChart(_p: unknown, { symbol: symbolRaw, period: periodRaw }: { symbol: string; period?: string }, ctx: GraphQLContext) {
      const symbol = (symbolRaw || '').toUpperCase().trim();
      const period = periodRaw || '1M';
      if (!symbol) fail('Parameter symbol wajib diisi');

      const kind = classifyAsset(symbol);
      if (kind !== 'crypto' && kind !== 'stock') {
        fail('Aset ini tidak memiliki chart harga');
      }

      const CRYPTO: Record<string, { interval: string; limit: number }> = {
        '1W': { interval: '1h', limit: 168 },
        '1M': { interval: '1d', limit: 30 },
        '3M': { interval: '1d', limit: 90 },
        '6M': { interval: '1d', limit: 180 },
        '1Y': { interval: '1d', limit: 365 },
      };
      const STOCK: Record<string, { range: string; interval: string }> = {
        '1W': { range: '5d', interval: '60m' },
        '1M': { range: '1mo', interval: '1d' },
        '3M': { range: '3mo', interval: '1d' },
        '6M': { range: '6mo', interval: '1d' },
        '1Y': { range: '1y', interval: '1d' },
      };

      if (kind === 'crypto') {
        const cfg = CRYPTO[period] || CRYPTO['1M'];
        const candles = await getCryptoCandles(ctx.env, symbol + 'USDT', cfg.interval, cfg.limit);
        return { symbol, period, unit: 'USD', candles };
      }
      const cfg = STOCK[period] || STOCK['1M'];
      const candles = await getStockCandles(ctx.env, symbol, cfg.range, cfg.interval);
      return { symbol, period, unit: 'IDR', candles };
    },
    async deposits(_p: unknown, { page: pageRaw, limit: limitRaw }: { page?: number; limit?: number }, ctx: GraphQLContext) {
      const env = ctx.env;
      const page = Math.max(Number(pageRaw) || 1, 1);
      const limit = Math.min(Math.max(Number(limitRaw) || 25, 1), 100);
      const offset = (page - 1) * limit;

      const BASE_FROM = `FROM deposits d
         JOIN accounts a ON a.id = d.account_id
         JOIN portfolios p ON p.id = a.portfolio_id`;

      const [countRow, rows] = await Promise.all([
        queryOne<{ total: number }>(env, `SELECT COUNT(*) AS total ${BASE_FROM}`),
        queryAll(env,
          `SELECT d.id, d.asset, d.amount, d.network, d.address, d.status, d.ts,
                  a.label AS account_label, a.type AS account_type, p.name AS portfolio_name
           ${BASE_FROM}
           ORDER BY d.ts DESC LIMIT ? OFFSET ?`,
          limit, offset,
        ),
      ]);

      const total = countRow?.total ?? 0;
      return { data: rows, total, page, limit, pages: Math.ceil(total / limit) || 1 };
    },
    async returns(_p: unknown, _a: unknown, ctx: GraphQLContext) {
      const env = ctx.env;
      const overview = (await getStoredOverview(env)) || (await refreshOverview(env));
      const currentValue = overview?.grandTotalUsd ?? 0;

      const sig = await queryOne<{ dc: number; dts: number; mc: number; mts: number; fc: number; fts: number }>(
        env,
        `SELECT
           (SELECT COUNT(*) FROM deposits WHERE status != 'pending') AS dc,
           (SELECT COALESCE(MAX(ts), 0) FROM deposits) AS dts,
           (SELECT COUNT(*) FROM manual_holdings) AS mc,
           (SELECT COALESCE(MAX(updated_at), 0) FROM manual_holdings) AS mts,
           (SELECT COUNT(*) FROM fixed_assets) AS fc,
           (SELECT COALESCE(MAX(updated_at), 0) FROM fixed_assets) AS fts`,
      );
      const sigStr = `${sig?.dc ?? 0}:${sig?.dts ?? 0}:${sig?.mc ?? 0}:${sig?.mts ?? 0}:${sig?.fc ?? 0}:${sig?.fts ?? 0}`;

      let basis = null as Awaited<ReturnType<typeof computeCostBasis>> | null;
      const cachedRaw = await env.KV.get(RETURNS_KV_KEY);
      if (cachedRaw) {
        try {
          const cached = JSON.parse(cachedRaw) as { sig: string; result: typeof basis };
          if (cached.sig === sigStr && cached.result) basis = cached.result;
        } catch { /* abaikan cache rusak */ }
      }
      if (!basis) {
        basis = await computeCostBasis(env);
        await env.KV.put(RETURNS_KV_KEY, JSON.stringify({ sig: sigStr, result: basis }), { expirationTtl: 21600 });
      }

      const costBasis = basis.costBasis;
      const abs = currentValue - costBasis;
      const pct = costBasis > 0 ? (abs / costBasis) * 100 : null;
      return {
        currentValue,
        costBasis,
        abs,
        pct,
        pricedItems: basis.pricedItems,
        totalItems: basis.totalItems,
        unpricedAssets: basis.unpricedAssets,
        earliestTs: basis.earliestTs,
      };
    },
    async insight(_p: unknown, _a: unknown, ctx: GraphQLContext) {
      const env = ctx.env;
      const overview = (await getStoredOverview(env)) || (await refreshOverview(env));
      if (!overview || overview.portfolios.length === 0) {
        return { text: 'Belum ada data portofolio untuk dianalisis.', cached: false, computedAt: 0 };
      }

      const cachedRaw = await env.KV.get(INSIGHT_KV_KEY);
      if (cachedRaw) {
        try {
          const cached = JSON.parse(cachedRaw) as { computedAt: number; text: string };
          if (cached.computedAt === overview.computedAt) {
            return { text: cached.text, cached: true, computedAt: cached.computedAt };
          }
        } catch { /* abaikan cache rusak */ }
      }

      const total = overview.grandTotalUsd || 0;
      const assetUsd = new Map<string, number>();
      for (const p of overview.portfolios) {
        for (const a of p.assets) {
          if (!(a.usd > 0)) continue;
          assetUsd.set(a.asset, (assetUsd.get(a.asset) || 0) + a.usd);
        }
      }
      const topAssets = [...assetUsd.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 8)
        .map(([sym, usd]) => {
          const pct = total > 0 ? ((usd / total) * 100).toFixed(1) : '0';
          const chg = overview.assetChange[sym];
          const chgStr = chg !== undefined && chg !== null ? `${chg >= 0 ? '+' : ''}${chg.toFixed(2)}%` : 'n/a';
          return `- ${sym}: $${usd.toFixed(2)} (${pct}% dari total, 24h ${chgStr})`;
        });
      const portfolioLines = overview.portfolios.map((p) => {
        const chg = p.change24hPct;
        const chgStr = chg !== null && chg !== undefined ? `${chg >= 0 ? '+' : ''}${chg.toFixed(2)}%` : 'n/a';
        return `- ${p.name}: $${p.totalUsd.toFixed(2)} (24h ${chgStr})`;
      });
      const grandChg = overview.grandChangePct;
      const grandChgStr = grandChg !== null && grandChg !== undefined ? `${grandChg >= 0 ? '+' : ''}${grandChg.toFixed(2)}%` : 'n/a';

      const dataContext = [
        `Total nilai: $${total.toFixed(2)} (perubahan 24 jam: ${grandChgStr})`,
        `Portofolio (${overview.portfolios.length}):`,
        ...portfolioLines,
        `Aset terbesar:`,
        ...topAssets,
      ].join('\n');

      const systemPrompt =
        'Kamu analis portofolio kripto. Berdasarkan data yang diberikan, tulis ringkasan singkat ' +
        'dalam Bahasa Indonesia, 3-4 kalimat, objektif dan padat. Sebutkan: total nilai & pergerakan 24 jam, ' +
        'kontributor/penggerak utama, dan satu catatan risiko (mis. konsentrasi pada satu aset atau porsi stablecoin). ' +
        'JANGAN memberi nasihat beli/jual atau prediksi harga. JANGAN mengarang angka di luar data yang diberikan.';

      try {
        const result = (await env.AI.run(INSIGHT_MODEL as any, {
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: dataContext },
          ],
          max_tokens: 400,
        } as any)) as { response?: string };
        const text = (result?.response || '').trim();
        if (!text) fail('AI tidak mengembalikan teks');

        await env.KV.put(
          INSIGHT_KV_KEY,
          JSON.stringify({ computedAt: overview.computedAt, text }),
          { expirationTtl: 86400 },
        );
        return { text, cached: false, computedAt: overview.computedAt };
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        fail('Gagal membuat insight: ' + msg.slice(0, 200));
      }
    },

    // ---- system ----
    async systemEvents(_p: unknown, { limit: limitRaw }: { limit?: number }, ctx: GraphQLContext) {
      const env = ctx.env;
      const limit = Math.min(Math.max(Number(limitRaw) || 200, 1), 500);
      const events = await queryAll(
        env,
        `SELECT id, level, source, account_id, message, detail, created_at, read_at
         FROM system_events ORDER BY created_at DESC LIMIT ?`,
        limit,
      );
      const unread = await queryOne<{ count: number }>(
        env,
        'SELECT COUNT(*) AS count FROM system_events WHERE read_at IS NULL',
      );
      return { events, unreadCount: unread?.count ?? 0 };
    },
    async systemQueue(_p: unknown, _a: unknown, ctx: GraphQLContext) {
      const env = ctx.env;
      const accounts = await queryAll<{
        id: number; type: string; label: string; status: string | null; last_synced_at: number | null; last_error: string | null;
      }>(
        env,
        'SELECT id, type, label, status, last_synced_at, last_error FROM accounts WHERE enabled = 1 ORDER BY label',
      );

      const binanceCooling = await isCooling(env, 'cex:binance');
      const bybitCooling = await isCooling(env, 'cex:bybit');

      const lastSnapshot = await queryOne<{ captured_at: number }>(
        env,
        'SELECT MAX(captured_at) AS captured_at FROM portfolio_snapshots',
      );
      const intervalMin = parseInt(env.SNAPSHOT_INTERVAL_MINUTES ?? '30', 10) || 30;
      const nextSnapshot = (lastSnapshot?.captured_at ?? 0) + intervalMin * 60 * 1000;

      const queue = [];
      for (const acc of accounts) {
        let backfill: unknown = null;
        if (acc.type === 'binance') {
          const row = await queryOne<{ value: string }>(
            env,
            "SELECT value FROM sync_state WHERE account_id = ? AND key = 'deposit_backfill'",
            acc.id,
          );
          if (row?.value) {
            try {
              backfill = JSON.parse(row.value);
            } catch {
              /* abaikan parse error */
            }
          }
        }
        const cooling =
          (acc.type === 'binance' && binanceCooling) || (acc.type === 'bybit' && bybitCooling);
        queue.push({ ...acc, cooling, backfill });
      }

      return { accounts: queue, nextSnapshot, snapshotIntervalMin: intervalMin };
    },

    // ---- export ----
    async exportCsv(_p: unknown, { type }: { type: string }, ctx: GraphQLContext) {
      const env = ctx.env;
      if (type === 'balances') {
        const rows = await queryAll<{
          portfolio: string; account: string; account_type: string; wallet_type: string; asset: string; total: number; updated_at: number;
        }>(
          env,
          `SELECT p.name AS portfolio, a.label AS account, a.type AS account_type,
                  b.wallet_type AS wallet_type, b.asset AS asset, b.total AS total, b.updated_at AS updated_at
           FROM balances b JOIN accounts a ON a.id = b.account_id JOIN portfolios p ON p.id = a.portfolio_id
           ORDER BY p.name, a.label, b.total DESC`,
        );
        const body = toCsv(
          ['portfolio', 'account', 'account_type', 'wallet_type', 'asset', 'total', 'updated_at'],
          rows.map((r) => [r.portfolio, r.account, r.account_type, r.wallet_type, r.asset, r.total, iso(r.updated_at)]),
        );
        return { filename: 'balances.csv', content: '﻿' + body };
      }
      if (type === 'holdings') {
        const rows = await queryAll<{
          portfolio: string; label: string; asset_class: string; currency: string; amount: number; note: string | null; added_at: number;
        }>(
          env,
          `SELECT p.name AS portfolio, h.label AS label, h.asset_class AS asset_class, h.currency AS currency,
                  h.amount AS amount, h.note AS note, h.added_at AS added_at
           FROM manual_holdings h JOIN portfolios p ON p.id = h.portfolio_id
           ORDER BY p.name, h.added_at DESC`,
        );
        const body = toCsv(
          ['portfolio', 'label', 'asset_class', 'currency', 'amount', 'note', 'added_at'],
          rows.map((r) => [r.portfolio, r.label, r.asset_class, r.currency, r.amount, r.note, iso(r.added_at)]),
        );
        return { filename: 'holdings.csv', content: '﻿' + body };
      }
      if (type === 'assets') {
        const rows = await queryAll<FixedAssetLatestRow & { portfolio: string }>(
          env,
          FIXED_ASSETS_LATEST_SQL.replace('FROM fixed_assets f', ', p.name AS portfolio FROM fixed_assets f JOIN portfolios p ON p.id = f.portfolio_id') +
            ' ORDER BY p.name, f.label',
        );
        const body = toCsv(
          ['portfolio', 'kind', 'label', 'currency', 'purchase_price', 'purchase_date', 'current_value', 'valued_at', 'source', 'note'],
          rows.map((r) => [r.portfolio, r.kind, r.label, r.currency, r.purchase_price, iso(r.purchase_date), r.value, iso(r.valued_at), r.source, r.note]),
        );
        return { filename: 'assets.csv', content: '\ufeff' + body };
      }
      if (type === 'snapshots') {
        const rows = await queryAll<{ portfolio: string; total_usd: number; captured_at: number }>(
          env,
          `SELECT p.name AS portfolio, s.total_usd AS total_usd, s.captured_at AS captured_at
           FROM portfolio_snapshots s JOIN portfolios p ON p.id = s.portfolio_id
           ORDER BY s.captured_at DESC, p.name`,
        );
        const body = toCsv(
          ['portfolio', 'total_usd', 'captured_at'],
          rows.map((r) => [r.portfolio, r.total_usd, iso(r.captured_at)]),
        );
        return { filename: 'snapshots.csv', content: '﻿' + body };
      }
      return fail('Tipe export tidak valid');
    },
  },

  Mutation: {
    // ---- auth ----
    async setup(_p: unknown, { username: u, password: p }: { username: string; password: string }, ctx: GraphQLContext) {
      const env = ctx.env;
      if ((await userCount(env)) > 0) fail('Setup already completed');
      const username = (u ?? '').trim();
      const password = p ?? '';
      if (username.length < 3) fail('Username must be at least 3 characters');
      if (password.length < 10) fail('Password must be at least 10 characters');

      const { hash, salt, iterations } = await hashPassword(password, undefined, undefined, env.MASTER_KEY);
      await run(
        env,
        'INSERT INTO users (username, password_hash, password_salt, iterations, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)',
        username,
        hash,
        salt,
        iterations,
        now(),
        now(),
      );
      return { created: true };
    },
    async login(_p: unknown, { username: u, password: p }: { username: string; password: string }, ctx: GraphQLContext) {
      const env = ctx.env;
      const ip = ctx.ip;
      const rl = await rateLimit(env, `login:${ip}`, 10, 300);
      if (!rl.allowed) fail('Too many attempts. Please try again later.');

      const username = (u ?? '').trim();
      const password = p ?? '';

      const user = await queryOne<UserRow>(
        env,
        'SELECT id, username, password_hash, password_salt, iterations FROM users WHERE username = ?',
        username,
      );

      const valid = user
        ? await verifyPassword(password, user.password_hash, user.password_salt, user.iterations, env.MASTER_KEY)
        : await verifyPassword(password, '', 'AAAAAAAAAAAAAAAAAAAAAA==', 100000, env.MASTER_KEY).then(() => false);

      if (!user || !valid) fail('Incorrect username or password');

      await resetRateLimit(env, `login:${ip}`);
      const { sid } = await createSession(
        env,
        { id: user!.id, username: user!.username },
        { ip, ua: ctx.ua },
      );
      ctx.cookieJar.push(buildSessionCookie(sid));
      return { username: user!.username };
    },
    async logout(_p: unknown, _a: unknown, ctx: GraphQLContext) {
      await destroySession(ctx.env, ctx.sid!);
      ctx.cookieJar.push(clearSessionCookieStr());
      return { loggedOut: true };
    },
    async changePassword(_p: unknown, { current, next }: { current: string; next: string }, ctx: GraphQLContext) {
      const env = ctx.env;
      const cur = current ?? '';
      const nxt = next ?? '';
      if (nxt.length < 10) fail('New password must be at least 10 characters');

      const s = ctx.session!;
      const user = await queryOne<UserRow>(
        env,
        'SELECT id, username, password_hash, password_salt, iterations FROM users WHERE id = ?',
        s.userId,
      );
      if (!user) fail('User not found');
      const valid = await verifyPassword(cur, user!.password_hash, user!.password_salt, user!.iterations, env.MASTER_KEY);
      if (!valid) fail('Current password is incorrect');

      const { hash, salt, iterations } = await hashPassword(nxt, undefined, undefined, env.MASTER_KEY);
      await run(
        env,
        'UPDATE users SET password_hash = ?, password_salt = ?, iterations = ?, updated_at = ? WHERE id = ?',
        hash,
        salt,
        iterations,
        now(),
        user!.id,
      );
      return { changed: true };
    },

    // ---- portfolios ----
    async createPortfolio(_p: unknown, { input }: { input: any }, ctx: GraphQLContext) {
      const body = input ?? {};
      const name = (body.name ?? '').trim();
      if (!name) fail('Nama portofolio wajib diisi');
      const res = await run(
        ctx.env,
        'INSERT INTO portfolios (name, description, sort_order, created_at, updated_at) VALUES (?, ?, ?, ?, ?)',
        name,
        body.description ?? null,
        body.sort_order ?? 0,
        now(),
        now(),
      );
      return { id: res.meta.last_row_id };
    },
    async updatePortfolio(_p: unknown, { id, input }: { id: number; input: any }, ctx: GraphQLContext) {
      const env = ctx.env;
      const body = input ?? {};
      const existing = await queryOne(env, 'SELECT id FROM portfolios WHERE id = ?', id);
      if (!existing) fail('Portofolio tidak ditemukan');
      await run(
        env,
        'UPDATE portfolios SET name = COALESCE(?, name), description = ?, sort_order = COALESCE(?, sort_order), updated_at = ? WHERE id = ?',
        body.name?.trim() || null,
        body.description ?? null,
        body.sort_order ?? null,
        now(),
        id,
      );
      return { updated: true };
    },
    async deletePortfolio(_p: unknown, { id }: { id: number }, ctx: GraphQLContext) {
      await run(ctx.env, 'DELETE FROM portfolios WHERE id = ?', id);
      return { deleted: true };
    },

    // ---- accounts ----
    async createAccount(_p: unknown, { input }: { input: any }, ctx: GraphQLContext) {
      const env = ctx.env;
      const body = input ?? {};
      const type = body.type as AccountType;
      const portfolioId = Number(body.portfolio_id);
      const label = (body.label ?? '').trim();

      if (!ALL_TYPES.has(type)) fail('Tipe account tidak valid');
      if (!portfolioId) fail('Portofolio wajib dipilih');
      if (!label) fail('Label wajib diisi');
      const pf = await queryOne(env, 'SELECT id FROM portfolios WHERE id = ?', portfolioId);
      if (!pf) fail('Portofolio tidak ditemukan');

      let encCredentials: string | null = null;
      let config: string | null = null;

      if (CEX_TYPES.has(type)) {
        const apiKey = (body.apiKey ?? '').trim();
        const apiSecret = (body.apiSecret ?? '').trim();
        if (!apiKey || !apiSecret) fail('API key & secret wajib diisi');
        encCredentials = await encryptSecret(JSON.stringify({ apiKey, apiSecret }), env.MASTER_KEY);
      } else if (STOCK_TYPES.has(type)) {
        const positions = parsePositions(body.positions);
        if (!positions.length) fail('Minimal satu posisi saham wajib diisi');
        config = JSON.stringify({ positions });
      } else {
        const address = (body.address ?? '').trim();
        if (!address) fail('Address wallet wajib diisi');
        const tokens = Array.isArray(body.tokens)
          ? body.tokens
              .filter((t: any) => t && t.contract && t.symbol)
              .map((t: any) => ({
                contract: String(t.contract).trim(),
                symbol: String(t.symbol).trim().toUpperCase(),
                decimals: Number(t.decimals) || 18,
              }))
          : [];
        config = JSON.stringify({ address, trackNative: body.trackNative !== false, tokens, autoDetect: body.autoDetect === true });
        const rpcUrl = (body.rpcUrl ?? '').trim();
        if (rpcUrl) encCredentials = await encryptSecret(JSON.stringify({ rpcUrl }), env.MASTER_KEY);
      }

      const res = await run(
        env,
        `INSERT INTO accounts (portfolio_id, type, label, enc_credentials, config, enabled, status, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, 1, 'pending', ?, ?)`,
        portfolioId,
        type,
        label,
        encCredentials,
        config,
        now(),
        now(),
      );
      return { id: res.meta.last_row_id };
    },
    async updateAccount(_p: unknown, { id, input }: { id: number; input: any }, ctx: GraphQLContext) {
      const env = ctx.env;
      const row = await queryOne<AccountRow>(env, 'SELECT * FROM accounts WHERE id = ?', id);
      if (!row) fail('Account tidak ditemukan');
      const body = input ?? {};
      const type = row!.type as AccountType;

      const label = body.label !== undefined ? String(body.label).trim() : row!.label;
      const enabled = body.enabled !== undefined ? (body.enabled ? 1 : 0) : row!.enabled;
      let encCredentials = row!.enc_credentials;
      let config = row!.config;

      if (ONCHAIN_TYPES.has(type)) {
        const prev = row!.config ? JSON.parse(row!.config) : {};
        const address = body.address !== undefined ? String(body.address).trim() : prev.address;
        const trackNative = body.trackNative !== undefined ? body.trackNative !== false : prev.trackNative ?? true;
        const tokens =
          body.tokens !== undefined
            ? (Array.isArray(body.tokens) ? body.tokens : [])
                .filter((t: any) => t && t.contract && t.symbol)
                .map((t: any) => ({
                  contract: String(t.contract).trim(),
                  symbol: String(t.symbol).trim().toUpperCase(),
                  decimals: Number(t.decimals) || 18,
                }))
            : prev.tokens ?? [];
        const autoDetect = body.autoDetect !== undefined ? body.autoDetect === true : prev.autoDetect === true;
        config = JSON.stringify({ address, trackNative, tokens, autoDetect });
        if (body.rpcUrl) encCredentials = await encryptSecret(JSON.stringify({ rpcUrl: String(body.rpcUrl).trim() }), env.MASTER_KEY);
      } else if (STOCK_TYPES.has(type)) {
        const prev = row!.config ? JSON.parse(row!.config) : {};
        const positions = body.positions !== undefined ? parsePositions(body.positions) : prev.positions ?? [];
        config = JSON.stringify({ positions });
      } else {
        if (body.apiKey && body.apiSecret) {
          encCredentials = await encryptSecret(
            JSON.stringify({ apiKey: String(body.apiKey).trim(), apiSecret: String(body.apiSecret).trim() }),
            env.MASTER_KEY,
          );
        }
      }

      await run(
        env,
        'UPDATE accounts SET label = ?, enabled = ?, enc_credentials = ?, config = ?, updated_at = ? WHERE id = ?',
        label,
        enabled,
        encCredentials,
        config,
        now(),
        id,
      );
      return { updated: true };
    },
    async deleteAccount(_p: unknown, { id }: { id: number }, ctx: GraphQLContext) {
      await run(ctx.env, 'DELETE FROM accounts WHERE id = ?', id);
      return { deleted: true };
    },
    async syncAccount(_p: unknown, { id }: { id: number }, ctx: GraphQLContext) {
      const env = ctx.env;
      const found = await syncOne(env, id);
      if (!found) fail('Account tidak ditemukan');
      await refreshOverview(env).catch(() => undefined);
      const row = await queryOne<AccountRow>(env, 'SELECT * FROM accounts WHERE id = ?', id);
      return row ? publicView(row) : { synced: true };
    },
    async backfillDeposits(_p: unknown, { id }: { id: number }, ctx: GraphQLContext) {
      const env = ctx.env;
      const acc = await queryOne<AccountRow>(env, 'SELECT * FROM accounts WHERE id = ?', id);
      if (!acc) fail('Account tidak ditemukan');
      if (acc!.type !== 'binance') fail('Backfill saat ini hanya untuk Binance');
      if (await isCooling(env, 'cex:binance'))
        fail('Binance sedang cooldown (geo-block 451). Coba lagi setelah ~15 menit.');
      const started = await startDepositBackfill(env, id);
      if (!started) fail('Gagal memulai backfill');
      ctx.executionCtx.waitUntil(runDepositBackfill(env, id, 8).catch(() => undefined));
      return { started: true };
    },

    // ---- holdings ----
    async createHolding(_p: unknown, { input }: { input: any }, ctx: GraphQLContext) {
      const env = ctx.env;
      const body = input ?? {};
      const portfolioId = Number(body.portfolio_id);
      const label = (body.label ?? '').trim();
      const currency = (body.currency ?? '').trim().toUpperCase();
      const amount = Number(body.amount);
      const addedAt = body.added_at && isFinite(Number(body.added_at)) ? Number(body.added_at) : now();

      if (!portfolioId) fail('Portfolio is required');
      if (!label) fail('Label is required');
      if (!ALLOWED_CURRENCIES.has(currency)) fail('Invalid currency');
      if (!isFinite(amount) || amount === 0) fail('Amount cannot be zero');

      const pf = await queryOne(env, 'SELECT id FROM portfolios WHERE id = ?', portfolioId);
      if (!pf) fail('Portfolio not found');

      const assetClass = amount < 0 ? 'expense' : 'fiat';
      const res = await run(
        env,
        `INSERT INTO manual_holdings (portfolio_id, label, asset_class, currency, amount, note, added_at, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        portfolioId,
        label,
        assetClass,
        currency,
        amount,
        body.note ?? null,
        addedAt,
        now(),
        now(),
      );
      await refreshOverview(env).catch(() => undefined);
      return { id: res.meta.last_row_id };
    },
    async updateHolding(_p: unknown, { id, input }: { id: number; input: any }, ctx: GraphQLContext) {
      const env = ctx.env;
      const body = input ?? {};
      const existing = await queryOne(env, 'SELECT id FROM manual_holdings WHERE id = ?', id);
      if (!existing) fail('Holding not found');

      const currency = body.currency?.trim().toUpperCase() || null;
      if (currency && !ALLOWED_CURRENCIES.has(currency)) fail('Invalid currency');

      const addedAt = body.added_at && isFinite(Number(body.added_at)) ? Number(body.added_at) : null;

      const amountVal = isFinite(Number(body.amount)) ? Number(body.amount) : null;
      if (amountVal === 0) fail('Amount cannot be zero');
      const assetClass = amountVal === null ? null : amountVal < 0 ? 'expense' : 'fiat';

      await run(
        env,
        `UPDATE manual_holdings
         SET label = COALESCE(?, label),
             currency = COALESCE(?, currency),
             amount = COALESCE(?, amount),
             asset_class = COALESCE(?, asset_class),
             note = ?,
             added_at = COALESCE(?, added_at),
             updated_at = ?
         WHERE id = ?`,
        body.label?.trim() || null,
        currency,
        amountVal,
        assetClass,
        body.note ?? null,
        addedAt,
        now(),
        id,
      );
      await refreshOverview(env).catch(() => undefined);
      return { updated: true };
    },
    async deleteHolding(_p: unknown, { id }: { id: number }, ctx: GraphQLContext) {
      const env = ctx.env;
      await run(env, 'DELETE FROM manual_holdings WHERE id = ?', id);
      await refreshOverview(env).catch(() => undefined);
      return { deleted: true };
    },
    async importHoldings(_p: unknown, { input }: { input: any }, ctx: GraphQLContext) {
      const env = ctx.env;
      const body = input ?? {};
      const text = (body.csv ?? '').trim();
      if (!text) fail('CSV is empty');

      const rows = parseCsv(text);
      if (rows.length < 2) fail('CSV has no data rows');

      const header = rows[0].map((h) => h.trim().toLowerCase());
      const col = (name: string) => header.indexOf(name);
      const iLabel = col('label');
      const iCurrency = col('currency');
      const iAmount = col('amount');
      const iNote = col('note');
      const iAdded = col('added_at');
      const iPortfolio = col('portfolio');
      if (iLabel < 0 || iCurrency < 0 || iAmount < 0) {
        fail('CSV must have columns: label, currency, amount');
      }

      const pfRows = await queryAll<{ id: number; name: string }>(env, 'SELECT id, name FROM portfolios');
      const byName = new Map(pfRows.map((p) => [p.name.trim().toLowerCase(), p.id]));
      const validId = new Set(pfRows.map((p) => p.id));
      const fallbackId = Number(body.portfolio_id) || null;
      if (fallbackId && !validId.has(fallbackId)) fail('Fallback portfolio not found');

      const ts = now();
      const errors: { row: number; error: string }[] = [];
      let imported = 0;

      for (let r = 1; r < rows.length; r++) {
        const cells = rows[r];
        const get = (i: number) => (i >= 0 && i < cells.length ? cells[i].trim() : '');

        const pfName = get(iPortfolio);
        let portfolioId = pfName ? byName.get(pfName.toLowerCase()) ?? null : null;
        if (!portfolioId) portfolioId = fallbackId;

        const label = get(iLabel);
        const currency = get(iCurrency).toUpperCase();
        const amount = Number(get(iAmount).replace(/[,\s]/g, ''));
        const addedRaw = get(iAdded);
        const parsedAdded = addedRaw ? (/^\d+$/.test(addedRaw) ? Number(addedRaw) : Date.parse(addedRaw)) : NaN;
        const addedAt = isFinite(parsedAdded) && parsedAdded > 0 ? parsedAdded : ts;
        const note = get(iNote) || null;

        if (!portfolioId) { errors.push({ row: r + 1, error: pfName ? `Unknown portfolio "${pfName}"` : 'No portfolio' }); continue; }
        if (!label) { errors.push({ row: r + 1, error: 'Missing label' }); continue; }
        if (!ALLOWED_CURRENCIES.has(currency)) { errors.push({ row: r + 1, error: `Invalid currency "${currency}"` }); continue; }
        if (!isFinite(amount) || amount === 0) { errors.push({ row: r + 1, error: 'Amount cannot be zero' }); continue; }

        const assetClass = amount < 0 ? 'expense' : 'fiat';
        await run(
          env,
          `INSERT INTO manual_holdings (portfolio_id, label, asset_class, currency, amount, note, added_at, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          portfolioId,
          label,
          assetClass,
          currency,
          amount,
          note,
          addedAt,
          ts,
          ts,
        );
        imported++;
      }

      if (imported) await refreshOverview(env).catch(() => undefined);
      return { imported, failed: errors.length, total: rows.length - 1, errors: errors.slice(0, 50) };
    },

    // ---- dashboard ----
    // ---- fixed assets ----
    async createFixedAsset(_p: unknown, { input }: { input: any }, ctx: GraphQLContext) {
      const env = ctx.env;
      const body = input ?? {};
      const portfolioId = Number(body.portfolio_id);
      const kind = parseKind(body.kind);
      const label = String(body.label ?? '').trim();
      const currency = String(body.currency ?? '').trim().toUpperCase();
      const purchasePrice = Number(body.purchase_price);
      const purchaseDate = parseTs(body.purchase_date) ?? now();
      const initialValue = body.initial_value === undefined || body.initial_value === null || body.initial_value === ''
        ? purchasePrice
        : Number(body.initial_value);

      if (!portfolioId) fail('Portfolio is required');
      if (!kind) fail('Invalid asset kind');
      if (!label) fail('Label is required');
      if (!ALLOWED_CURRENCIES.has(currency)) fail('Invalid currency');
      if (!isFinite(purchasePrice) || purchasePrice < 0) fail('Purchase price must be zero or more');
      if (!isFinite(initialValue) || initialValue < 0) fail('Current value must be zero or more');

      const pf = await queryOne(env, 'SELECT id FROM portfolios WHERE id = ?', portfolioId);
      if (!pf) fail('Portfolio not found');

      const ts = now();
      const results = await env.DB.batch([
        env.DB.prepare(
        `INSERT INTO fixed_assets (portfolio_id, kind, label, currency, purchase_price, purchase_date, note, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`).bind(
        portfolioId, kind, label, currency, purchasePrice, purchaseDate, body.note ?? null, ts, ts,
        ),
        env.DB.prepare(`INSERT INTO fixed_asset_valuations (asset_id, value, valued_at, source, created_at)
          VALUES (last_insert_rowid(), ?, ?, ?, ?)`).bind(initialValue, ts, 'initial', ts),
      ]);
      const id = results[0].meta.last_row_id;
      await refreshOverview(env).catch(() => undefined);
      return { id };
    },
    async updateFixedAsset(_p: unknown, { id, input }: { id: number; input: any }, ctx: GraphQLContext) {
      const env = ctx.env;
      const body = input ?? {};
      const existing = await queryOne<{ currency: string; note: string | null }>(env, 'SELECT currency, note FROM fixed_assets WHERE id = ?', id);
      if (!existing) fail('Asset not found');

      const kind = body.kind === undefined ? null : parseKind(body.kind);
      if (body.kind !== undefined && !kind) fail('Invalid asset kind');
      const currency = body.currency ? String(body.currency).trim().toUpperCase() : null;
      if (currency && !ALLOWED_CURRENCIES.has(currency)) fail('Invalid currency');
      if (body.currency !== undefined && currency !== existing!.currency) fail('Currency cannot be changed after creation');
      if (body.label !== undefined && !String(body.label ?? '').trim()) fail('Label is required');
      const purchasePrice = body.purchase_price === undefined || body.purchase_price === null || body.purchase_price === ''
        ? null
        : Number(body.purchase_price);
      if (purchasePrice !== null && (!isFinite(purchasePrice) || purchasePrice < 0)) fail('Purchase price must be zero or more');
      const purchaseDate = parseTs(body.purchase_date);
      const portfolioId = body.portfolio_id ? Number(body.portfolio_id) : null;
      if (portfolioId) {
        const pf = await queryOne(env, 'SELECT id FROM portfolios WHERE id = ?', portfolioId);
        if (!pf) fail('Portfolio not found');
      }

      await run(
        env,
        `UPDATE fixed_assets
         SET portfolio_id = COALESCE(?, portfolio_id),
             kind = COALESCE(?, kind),
             label = COALESCE(?, label),
             currency = COALESCE(?, currency),
             purchase_price = COALESCE(?, purchase_price),
             purchase_date = COALESCE(?, purchase_date),
             note = ?,
             updated_at = ?
         WHERE id = ?`,
        portfolioId, kind, String(body.label ?? '').trim() || null, currency, purchasePrice, purchaseDate,
        body.note === undefined ? existing!.note : body.note, now(), id,
      );
      await refreshOverview(env).catch(() => undefined);
      return { updated: true };
    },
    async deleteFixedAsset(_p: unknown, { id }: { id: number }, ctx: GraphQLContext) {
      const env = ctx.env;
      // Hapus valuasi eksplisit (jaga-jaga bila foreign_keys tidak aktif; ON DELETE CASCADE tetap ada).
      await env.DB.batch([
        env.DB.prepare('DELETE FROM fixed_asset_valuations WHERE asset_id = ?').bind(id),
        env.DB.prepare('DELETE FROM fixed_assets WHERE id = ?').bind(id),
      ]);
      await refreshOverview(env).catch(() => undefined);
      return { deleted: true };
    },
    async addFixedAssetValuation(_p: unknown, { id, input }: { id: number; input: any }, ctx: GraphQLContext) {
      const env = ctx.env;
      const body = input ?? {};
      const existing = await queryOne(env, 'SELECT id FROM fixed_assets WHERE id = ?', id);
      if (!existing) fail('Asset not found');
      const value = Number(body.value);
      if (!isFinite(value) || value < 0) fail('Value must be zero or more');
      const valuedAt = parseTs(body.valued_at) ?? now();
      const source = String(body.source ?? '').trim() || null;

      const ts = now();
      const res = await run(
        env,
        `INSERT INTO fixed_asset_valuations (asset_id, value, valued_at, source, created_at) VALUES (?, ?, ?, ?, ?)`,
        id, value, valuedAt, source, ts,
      );
      await run(env, 'UPDATE fixed_assets SET updated_at = ? WHERE id = ?', ts, id);
      await refreshOverview(env).catch(() => undefined);
      return { id: res.meta.last_row_id };
    },
    async deleteFixedAssetValuation(_p: unknown, { id }: { id: number }, ctx: GraphQLContext) {
      const env = ctx.env;
      const row = await queryOne<{ asset_id: number }>(env, 'SELECT asset_id FROM fixed_asset_valuations WHERE id = ?', id);
      if (!row) fail('Valuation not found');
      const cnt = await queryOne<{ c: number }>(env, 'SELECT COUNT(*) AS c FROM fixed_asset_valuations WHERE asset_id = ?', row!.asset_id);
      if ((cnt?.c ?? 0) <= 1) fail('Cannot delete the only valuation — add a new one first');
      await run(env, 'DELETE FROM fixed_asset_valuations WHERE id = ?', id);
      await run(env, 'UPDATE fixed_assets SET updated_at = ? WHERE id = ?', now(), row!.asset_id);
      await refreshOverview(env).catch(() => undefined);
      return { deleted: true };
    },

    async syncAll(_p: unknown, _a: unknown, ctx: GraphQLContext) {
      return syncAll(ctx.env);
    },

    // ---- system ----
    async markEventsRead(_p: unknown, _a: unknown, ctx: GraphQLContext) {
      await run(ctx.env, 'UPDATE system_events SET read_at = ? WHERE read_at IS NULL', now());
      return null;
    },
    async clearEvents(_p: unknown, _a: unknown, ctx: GraphQLContext) {
      await run(ctx.env, 'DELETE FROM system_events');
      return null;
    },
  },
};
