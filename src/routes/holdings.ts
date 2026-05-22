import { Hono } from 'hono';
import type { Env, Variables } from '../types';
import { now, queryAll, queryOne, run } from '../lib/db';
import { ok, fail } from '../lib/response';
import { refreshOverview } from '../services/overview';

const app = new Hono<{ Bindings: Env; Variables: Variables }>();

const ALLOWED_CURRENCIES = new Set(['USD', 'IDR', 'JPY', 'SGD']);

app.get('/', async (c) => {
  const pid = c.req.query('portfolio_id');
  const rows = pid
    ? await queryAll(
        c.env,
        'SELECT * FROM manual_holdings WHERE portfolio_id = ? ORDER BY added_at DESC, created_at DESC',
        Number(pid),
      )
    : await queryAll(c.env, 'SELECT * FROM manual_holdings ORDER BY added_at DESC, created_at DESC');
  return ok(c, rows);
});

app.post('/', async (c) => {
  const body = (await c.req.json().catch(() => ({}))) as {
    portfolio_id?: number;
    label?: string;
    currency?: string;
    amount?: number;
    note?: string;
    added_at?: number;
  };

  const portfolioId = Number(body.portfolio_id);
  const label = (body.label ?? '').trim();
  const currency = (body.currency ?? '').trim().toUpperCase();
  const amount = Number(body.amount);
  const addedAt = body.added_at && isFinite(Number(body.added_at)) ? Number(body.added_at) : now();

  if (!portfolioId) return fail(c, 'Portfolio is required');
  if (!label) return fail(c, 'Label is required');
  if (!ALLOWED_CURRENCIES.has(currency)) return fail(c, 'Invalid currency');
  if (!isFinite(amount) || amount === 0) return fail(c, 'Amount cannot be zero');

  const pf = await queryOne(c.env, 'SELECT id FROM portfolios WHERE id = ?', portfolioId);
  if (!pf) return fail(c, 'Portfolio not found', 404);

  // Nominal negatif = pengeluaran (mengurangi total). Tandai via asset_class agar UI bisa membedakan.
  const assetClass = amount < 0 ? 'expense' : 'fiat';
  const res = await run(
    c.env,
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
  await refreshOverview(c.env).catch(() => undefined);
  return ok(c, { id: res.meta.last_row_id }, 201);
});

app.put('/:id', async (c) => {
  const id = Number(c.req.param('id'));
  const body = (await c.req.json().catch(() => ({}))) as {
    label?: string;
    currency?: string;
    amount?: number;
    note?: string;
    added_at?: number;
  };
  const existing = await queryOne(c.env, 'SELECT id FROM manual_holdings WHERE id = ?', id);
  if (!existing) return fail(c, 'Holding not found', 404);

  const currency = body.currency?.trim().toUpperCase() || null;
  if (currency && !ALLOWED_CURRENCIES.has(currency)) return fail(c, 'Invalid currency');

  const addedAt = body.added_at && isFinite(Number(body.added_at)) ? Number(body.added_at) : null;

  const amountVal = isFinite(Number(body.amount)) ? Number(body.amount) : null;
  if (amountVal === 0) return fail(c, 'Amount cannot be zero');
  // Sinkronkan penanda pengeluaran dengan tanda nominal yang baru (negatif = pengeluaran).
  const assetClass = amountVal === null ? null : amountVal < 0 ? 'expense' : 'fiat';

  await run(
    c.env,
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
  await refreshOverview(c.env).catch(() => undefined);
  return ok(c, { updated: true });
});

app.delete('/:id', async (c) => {
  const id = Number(c.req.param('id'));
  await run(c.env, 'DELETE FROM manual_holdings WHERE id = ?', id);
  await refreshOverview(c.env).catch(() => undefined);
  return ok(c, { deleted: true });
});

export default app;
