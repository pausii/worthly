import { Hono } from 'hono';
import type { Env, Variables } from '../types';
import { now, queryAll, queryOne, run } from '../lib/db';
import { ok, fail } from '../lib/response';

const app = new Hono<{ Bindings: Env; Variables: Variables }>();

app.get('/', async (c) => {
  const rows = await queryAll(
    c.env,
    'SELECT id, name, description, sort_order, created_at, updated_at FROM portfolios ORDER BY sort_order, id',
  );
  return ok(c, rows);
});

app.post('/', async (c) => {
  const body = (await c.req.json().catch(() => ({}))) as { name?: string; description?: string; sort_order?: number };
  const name = (body.name ?? '').trim();
  if (!name) return fail(c, 'Nama portofolio wajib diisi');
  const res = await run(
    c.env,
    'INSERT INTO portfolios (name, description, sort_order, created_at, updated_at) VALUES (?, ?, ?, ?, ?)',
    name,
    body.description ?? null,
    body.sort_order ?? 0,
    now(),
    now(),
  );
  return ok(c, { id: res.meta.last_row_id }, 201);
});

app.put('/:id', async (c) => {
  const id = Number(c.req.param('id'));
  const body = (await c.req.json().catch(() => ({}))) as { name?: string; description?: string; sort_order?: number };
  const existing = await queryOne(c.env, 'SELECT id FROM portfolios WHERE id = ?', id);
  if (!existing) return fail(c, 'Portofolio tidak ditemukan', 404);
  await run(
    c.env,
    'UPDATE portfolios SET name = COALESCE(?, name), description = ?, sort_order = COALESCE(?, sort_order), updated_at = ? WHERE id = ?',
    body.name?.trim() || null,
    body.description ?? null,
    body.sort_order ?? null,
    now(),
    id,
  );
  return ok(c, { updated: true });
});

app.delete('/:id', async (c) => {
  const id = Number(c.req.param('id'));
  await run(c.env, 'DELETE FROM portfolios WHERE id = ?', id);
  return ok(c, { deleted: true });
});

export default app;
