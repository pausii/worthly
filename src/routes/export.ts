import { Hono } from 'hono';
import type { AppContext, Env, Variables } from '../types';
import { queryAll } from '../lib/db';

const app = new Hono<{ Bindings: Env; Variables: Variables }>();

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

function csv(c: AppContext, name: string, body: string) {
  c.header('Content-Type', 'text/csv; charset=utf-8');
  c.header('Content-Disposition', `attachment; filename="${name}"`);
  // BOM agar Excel mengenali UTF-8.
  return c.body('﻿' + body);
}

// Saldo terkini semua account.
app.get('/balances.csv', async (c) => {
  const rows = await queryAll<{
    portfolio: string; account: string; account_type: string; wallet_type: string; asset: string; total: number; updated_at: number;
  }>(
    c.env,
    `SELECT p.name AS portfolio, a.label AS account, a.type AS account_type,
            b.wallet_type AS wallet_type, b.asset AS asset, b.total AS total, b.updated_at AS updated_at
     FROM balances b JOIN accounts a ON a.id = b.account_id JOIN portfolios p ON p.id = a.portfolio_id
     ORDER BY p.name, a.label, b.total DESC`,
  );
  return csv(
    c,
    'balances.csv',
    toCsv(
      ['portfolio', 'account', 'account_type', 'wallet_type', 'asset', 'total', 'updated_at'],
      rows.map((r) => [r.portfolio, r.account, r.account_type, r.wallet_type, r.asset, r.total, iso(r.updated_at)]),
    ),
  );
});

// Holding manual.
app.get('/holdings.csv', async (c) => {
  const rows = await queryAll<{
    portfolio: string; label: string; asset_class: string; currency: string; amount: number; note: string | null; added_at: number;
  }>(
    c.env,
    `SELECT p.name AS portfolio, h.label AS label, h.asset_class AS asset_class, h.currency AS currency,
            h.amount AS amount, h.note AS note, h.added_at AS added_at
     FROM manual_holdings h JOIN portfolios p ON p.id = h.portfolio_id
     ORDER BY p.name, h.added_at DESC`,
  );
  return csv(
    c,
    'holdings.csv',
    toCsv(
      ['portfolio', 'label', 'asset_class', 'currency', 'amount', 'note', 'added_at'],
      rows.map((r) => [r.portfolio, r.label, r.asset_class, r.currency, r.amount, r.note, iso(r.added_at)]),
    ),
  );
});

// Riwayat snapshot nilai portofolio (untuk chart / analisis).
app.get('/snapshots.csv', async (c) => {
  const rows = await queryAll<{ portfolio: string; total_usd: number; captured_at: number }>(
    c.env,
    `SELECT p.name AS portfolio, s.total_usd AS total_usd, s.captured_at AS captured_at
     FROM portfolio_snapshots s JOIN portfolios p ON p.id = s.portfolio_id
     ORDER BY s.captured_at DESC, p.name`,
  );
  return csv(
    c,
    'snapshots.csv',
    toCsv(
      ['portfolio', 'total_usd', 'captured_at'],
      rows.map((r) => [r.portfolio, r.total_usd, iso(r.captured_at)]),
    ),
  );
});

export default app;
