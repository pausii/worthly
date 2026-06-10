import { Hono } from 'hono';
import type { Env, Variables } from '../types';
import { now, queryAll, queryOne, run } from '../lib/db';
import { ok, fail } from '../lib/response';

const app = new Hono<{ Bindings: Env; Variables: Variables }>();

// List holding manual (opsional filter ?portfolio_id=).
app.get('/', async (c) => {
  const pid = c.req.query('portfolio_id');
  const rows = pid
    ? await queryAll(
        c.env,
        'SELECT * FROM manual_holdings WHERE portfolio_id = ? ORDER BY created_at DESC',
        Number(pid),
      )
    : await queryAll(c.env, 'SELECT * FROM manual_holdings ORDER BY created_at DESC');
  return ok(c, rows);
});

app.post('/', async (c) => {
  const body = (await c.req.json().catch(() => ({}))) as {
    portfolio_id?: number;
    label?: string;
    asset_class?: string;
    currency?: string;
    amount?: number;
    note?: string;
  };

  const portfolioId = Number(body.portfolio_id);
  const label = (body.label ?? '').trim();
  const assetClass = body.asset_class === 'crypto' ? 'crypto' : 'fiat';
  const currency = (body.currency ?? '').trim().toUpperCase();
  const amount = Number(body.amount);

  if (!portfolioId) return fail(c, 'Portofolio wajib dipilih');
  if (!label) return fail(c, 'Label wajib diisi');
  if (!currency) return fail(c, 'Mata uang/aset wajib diisi');
  if (!isFinite(amount) || amount <= 0) return fail(c, 'Jumlah harus angka > 0');

  const pf = await queryOne(c.env, 'SELECT id FROM portfolios WHERE id = ?', portfolioId);
  if (!pf) return fail(c, 'Portofolio tidak ditemukan', 404);

  const res = await run(
    c.env,
    `INSERT INTO manual_holdings (portfolio_id, label, asset_class, currency, amount, note, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    portfolioId,
    label,
    assetClass,
    currency,
    amount,
    body.note ?? null,
    now(),
    now(),
  );
  return ok(c, { id: res.meta.last_row_id }, 201);
});

app.put('/:id', async (c) => {
  const id = Number(c.req.param('id'));
  const body = (await c.req.json().catch(() => ({}))) as {
    label?: string;
    asset_class?: string;
    currency?: string;
    amount?: number;
    note?: string;
  };
  const existing = await queryOne(c.env, 'SELECT id FROM manual_holdings WHERE id = ?', id);
  if (!existing) return fail(c, 'Holding tidak ditemukan', 404);
  await run(
    c.env,
    `UPDATE manual_holdings
     SET label = COALESCE(?, label),
         asset_class = COALESCE(?, asset_class),
         currency = COALESCE(?, currency),
         amount = COALESCE(?, amount),
         note = ?, updated_at = ?
     WHERE id = ?`,
    body.label?.trim() || null,
    body.asset_class || null,
    body.currency?.trim().toUpperCase() || null,
    isFinite(Number(body.amount)) ? Number(body.amount) : null,
    body.note ?? null,
    now(),
    id,
  );
  return ok(c, { updated: true });
});

app.delete('/:id', async (c) => {
  const id = Number(c.req.param('id'));
  await run(c.env, 'DELETE FROM manual_holdings WHERE id = ?', id);
  return ok(c, { deleted: true });
});

export default app;
