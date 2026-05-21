import { Hono } from 'hono';
import type { Env, Variables } from '../types';
import { queryAll } from '../lib/db';
import { ok } from '../lib/response';
import { computeValuation } from '../services/valuation';
import { getUsdRates, get24hChangePct } from '../services/prices';
import { syncAll } from '../services/sync';

const app = new Hono<{ Bindings: Env; Variables: Variables }>();

// Ringkasan nilai semua portofolio (live, dihitung dari saldo + harga terbaru).
app.get('/overview', async (c) => {
  const dayAgo = Date.now() - 24 * 60 * 60 * 1000;
  const [valuation, rates, pastRows] = await Promise.all([
    computeValuation(c.env),
    getUsdRates(c.env, ['IDR']),
    queryAll<{ portfolio_id: number; total_usd: number }>(
      c.env,
      `SELECT ps.portfolio_id AS portfolio_id, ps.total_usd AS total_usd FROM portfolio_snapshots ps
       JOIN (SELECT portfolio_id, MAX(captured_at) AS mc FROM portfolio_snapshots
             WHERE captured_at <= ? GROUP BY portfolio_id) m
       ON m.portfolio_id = ps.portfolio_id AND m.mc = ps.captured_at`,
      dayAgo,
    ),
  ]);

  // Perubahan 24 jam per aset (crypto, via Binance).
  const assets = new Set<string>();
  for (const p of valuation.portfolios) for (const a of p.assets) assets.add(a.asset);
  const assetChange = await get24hChangePct(c.env, [...assets]);

  // Perubahan 24 jam per portofolio (dari snapshot ~24 jam lalu).
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
  return ok(c, {
    ...valuation,
    portfolios,
    assetChange,
    grandChangePct,
    idrRate: usdPerIdr > 0 ? 1 / usdPerIdr : 0,
  });
});

// Data chart pergerakan nilai. ?portfolio_id= (kosong = agregat semua), ?days=30
app.get('/history', async (c) => {
  const pid = c.req.query('portfolio_id');
  const days = Math.min(Math.max(Number(c.req.query('days')) || 30, 1), 365);
  const since = Date.now() - days * 24 * 60 * 60 * 1000;

  if (pid) {
    const rows = await queryAll<{ captured_at: number; total_usd: number }>(
      c.env,
      'SELECT captured_at, total_usd FROM portfolio_snapshots WHERE portfolio_id = ? AND captured_at >= ? ORDER BY captured_at',
      Number(pid),
      since,
    );
    return ok(c, rows);
  }
  // Agregat: jumlahkan semua portofolio per captured_at.
  const rows = await queryAll<{ captured_at: number; total_usd: number }>(
    c.env,
    `SELECT captured_at, SUM(total_usd) AS total_usd FROM portfolio_snapshots
     WHERE captured_at >= ? GROUP BY captured_at ORDER BY captured_at`,
    since,
  );
  return ok(c, rows);
});

// Riwayat deposit terbaru (semua account).
app.get('/deposits', async (c) => {
  const limit = Math.min(Math.max(Number(c.req.query('limit')) || 100, 1), 500);
  const rows = await queryAll(
    c.env,
    `SELECT d.id, d.asset, d.amount, d.network, d.address, d.status, d.ts,
            a.label AS account_label, a.type AS account_type, p.name AS portfolio_name
     FROM deposits d
     JOIN accounts a ON a.id = d.account_id
     JOIN portfolios p ON p.id = a.portfolio_id
     ORDER BY d.ts DESC LIMIT ?`,
    limit,
  );
  return ok(c, rows);
});

// Trigger sinkronisasi penuh secara manual.
app.post('/sync', async (c) => {
  const result = await syncAll(c.env);
  return ok(c, result);
});

export default app;
