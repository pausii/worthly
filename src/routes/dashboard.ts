import { Hono } from 'hono';
import type { Env, Variables } from '../types';
import { queryAll } from '../lib/db';
import { ok } from '../lib/response';
import { syncAll } from '../services/sync';
import { getStoredOverview, refreshOverview } from '../services/overview';

const app = new Hono<{ Bindings: Env; Variables: Variables }>();

// Ringkasan nilai semua portofolio. Dibaca LANGSUNG dari DB (hasil hitungan worker/cron) —
// tidak ada fetch harga / valuasi live di sini agar UI instan & murni dari DB.
app.get('/overview', async (c) => {
  const stored = await getStoredOverview(c.env);
  if (stored) return ok(c, stored);
  // Fallback sekali (mis. sebelum cron pertama mengisi cache): hitung & simpan.
  return ok(c, await refreshOverview(c.env));
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
