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

/**
 * Parser CSV minimal (RFC 4180): menangani field ber-quote, koma & newline di dalam quote,
 * serta escape "" -> ". Mengembalikan array baris (array sel string).
 */
function parseCsv(text: string): string[][] {
  const s = text.replace(/^\uFEFF/, ''); // buang BOM
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
      // Lewati baris kosong sepenuhnya.
      if (row.length > 1 || row[0] !== '') rows.push(row);
      row = [];
    } else field += ch;
  }
  if (field !== '' || row.length) { row.push(field); if (row.length > 1 || row[0] !== '') rows.push(row); }
  return rows;
}

/** Import manual holdings dari CSV (kompatibel format export /export/holdings.csv). */
app.post('/import', async (c) => {
  const body = (await c.req.json().catch(() => ({}))) as { csv?: string; portfolio_id?: number };
  const text = (body.csv ?? '').trim();
  if (!text) return fail(c, 'CSV is empty');

  const rows = parseCsv(text);
  if (rows.length < 2) return fail(c, 'CSV has no data rows');

  // Petakan header (case-insensitive) -> index kolom.
  const header = rows[0].map((h) => h.trim().toLowerCase());
  const col = (name: string) => header.indexOf(name);
  const iLabel = col('label');
  const iCurrency = col('currency');
  const iAmount = col('amount');
  const iNote = col('note');
  const iAdded = col('added_at');
  const iPortfolio = col('portfolio');
  if (iLabel < 0 || iCurrency < 0 || iAmount < 0) {
    return fail(c, 'CSV must have columns: label, currency, amount');
  }

  // Pra-ambil portfolio: peta nama->id (case-insensitive) + himpunan id valid.
  const pfRows = await queryAll<{ id: number; name: string }>(c.env, 'SELECT id, name FROM portfolios');
  const byName = new Map(pfRows.map((p) => [p.name.trim().toLowerCase(), p.id]));
  const validId = new Set(pfRows.map((p) => p.id));
  const fallbackId = Number(body.portfolio_id) || null;
  if (fallbackId && !validId.has(fallbackId)) return fail(c, 'Fallback portfolio not found', 404);

  const ts = now();
  const errors: { row: number; error: string }[] = [];
  let imported = 0;

  for (let r = 1; r < rows.length; r++) {
    const cells = rows[r];
    const get = (i: number) => (i >= 0 && i < cells.length ? cells[i].trim() : '');

    // Resolusi portfolio: kolom `portfolio` (by name) -> fallback portfolio_id.
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
      c.env,
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

  if (imported) await refreshOverview(c.env).catch(() => undefined);
  return ok(c, { imported, failed: errors.length, total: rows.length - 1, errors: errors.slice(0, 50) });
});

export default app;
