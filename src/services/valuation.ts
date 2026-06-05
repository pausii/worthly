import type { Env } from '../types';
import { queryAll } from '../lib/db';
import { getUsdRates } from './prices';

export interface AssetValue {
  asset: string;
  amount: number;
  usd: number;
  origin: 'cex' | 'onchain' | 'manual' | 'stock';
}

export interface PortfolioValue {
  id: number;
  name: string;
  description: string | null;
  totalUsd: number;
  assets: AssetValue[];
}

export interface ValuationResult {
  portfolios: PortfolioValue[];
  grandTotalUsd: number;
  pricedAt: number;
}

interface BalanceRow {
  portfolio_id: number;
  asset: string;
  total: number;
  account_type: string;
}
interface ManualRow {
  portfolio_id: number;
  currency: string;
  amount: number;
}
interface PortfolioRow {
  id: number;
  name: string;
  description: string | null;
}

/** Hitung nilai semua portofolio dalam USD (balances CEX/on-chain + holding manual). */
export async function computeValuation(env: Env): Promise<ValuationResult> {
  const [portfolios, balances, manuals] = await Promise.all([
    queryAll<PortfolioRow>(env, 'SELECT id, name, description FROM portfolios ORDER BY sort_order, id'),
    queryAll<BalanceRow>(
      env,
      `SELECT a.portfolio_id AS portfolio_id, b.asset AS asset, SUM(b.total) AS total, a.type AS account_type
       FROM balances b JOIN accounts a ON a.id = b.account_id
       WHERE a.enabled = 1
       GROUP BY a.portfolio_id, b.asset, a.type`,
    ),
    queryAll<ManualRow>(
      env,
      `SELECT portfolio_id, currency, SUM(amount) AS amount FROM manual_holdings GROUP BY portfolio_id, currency`,
    ),
  ]);

  // Kumpulkan semua aset yang butuh harga.
  const assetSet = new Set<string>();
  for (const b of balances) assetSet.add(b.asset.toUpperCase());
  for (const m of manuals) assetSet.add(m.currency.toUpperCase());
  const rates = await getUsdRates(env, [...assetSet]);

  const byPortfolio = new Map<number, PortfolioValue>();
  for (const p of portfolios) {
    byPortfolio.set(p.id, { id: p.id, name: p.name, description: p.description, totalUsd: 0, assets: [] });
  }

  const addAsset = (pid: number, asset: string, amount: number, origin: AssetValue['origin']) => {
    const pv = byPortfolio.get(pid);
    if (!pv) return;
    const rate = rates[asset.toUpperCase()] ?? 0;
    const usd = amount * rate;
    const existing = pv.assets.find((a) => a.asset === asset.toUpperCase() && a.origin === origin);
    if (existing) {
      existing.amount += amount;
      existing.usd += usd;
    } else {
      pv.assets.push({ asset: asset.toUpperCase(), amount, usd, origin });
    }
    pv.totalUsd += usd;
  };

  for (const b of balances) {
    const origin =
      b.account_type === 'idx'
        ? 'stock'
        : b.account_type === 'tron' ||
            b.account_type === 'eth' ||
            b.account_type === 'bsc' ||
            b.account_type === 'btc'
          ? 'onchain'
          : 'cex';
    addAsset(b.portfolio_id, b.asset, b.total, origin);
  }
  for (const m of manuals) addAsset(m.portfolio_id, m.currency, m.amount, 'manual');

  const portfolioList = [...byPortfolio.values()];
  for (const pv of portfolioList) pv.assets.sort((a, b) => b.usd - a.usd);
  const grandTotalUsd = portfolioList.reduce((s, p) => s + p.totalUsd, 0);

  return { portfolios: portfolioList, grandTotalUsd, pricedAt: Date.now() };
}
