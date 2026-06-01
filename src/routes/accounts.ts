import { Hono } from 'hono';
import type { AccountType, Env, Variables } from '../types';
import { now, queryAll, queryOne, run } from '../lib/db';
import { encryptSecret } from '../lib/crypto';
import { ok, fail } from '../lib/response';
import { syncOne, startDepositBackfill, runDepositBackfill } from '../services/sync';
import { refreshOverview } from '../services/overview';
import { getUsdRates } from '../services/prices';
import { isCooling } from '../lib/cooldown';

const app = new Hono<{ Bindings: Env; Variables: Variables }>();

const CEX_TYPES = new Set<AccountType>(['binance', 'bybit']);
const ONCHAIN_TYPES = new Set<AccountType>(['tron', 'eth', 'bsc', 'btc']);
const ALL_TYPES = new Set<AccountType>([...CEX_TYPES, ...ONCHAIN_TYPES]);

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

/** Bentuk aman untuk dikirim ke client — TANPA kredensial. */
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

app.get('/', async (c) => {
  const rows = await queryAll<AccountRow>(c.env, 'SELECT * FROM accounts ORDER BY portfolio_id, id');
  const states = await queryAll<{ account_id: number; value: string }>(
    c.env,
    "SELECT account_id, value FROM sync_state WHERE key = 'deposit_backfill'",
  );
  const stateMap = new Map(states.map((s) => [s.account_id, s.value]));

  // Nilai USD + jumlah aset + top aset per-account (untuk kartu di halaman Accounts).
  const bals = await queryAll<{ account_id: number; asset: string; total: number }>(
    c.env,
    'SELECT account_id, asset, SUM(total) AS total FROM balances GROUP BY account_id, asset',
  );
  const assetSet = new Set<string>();
  for (const b of bals) assetSet.add(b.asset.toUpperCase());
  const rates = await getUsdRates(c.env, [...assetSet]);
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

  return ok(
    c,
    rows.map((r) => {
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
    }),
  );
});

app.post('/', async (c) => {
  const body = await c.req.json<any>().catch(() => ({}));
  const type = body.type as AccountType;
  const portfolioId = Number(body.portfolio_id);
  const label = (body.label ?? '').trim();

  if (!ALL_TYPES.has(type)) return fail(c, 'Tipe account tidak valid');
  if (!portfolioId) return fail(c, 'Portofolio wajib dipilih');
  if (!label) return fail(c, 'Label wajib diisi');
  const pf = await queryOne(c.env, 'SELECT id FROM portfolios WHERE id = ?', portfolioId);
  if (!pf) return fail(c, 'Portofolio tidak ditemukan', 404);

  let encCredentials: string | null = null;
  let config: string | null = null;

  if (CEX_TYPES.has(type)) {
    const apiKey = (body.apiKey ?? '').trim();
    const apiSecret = (body.apiSecret ?? '').trim();
    if (!apiKey || !apiSecret) return fail(c, 'API key & secret wajib diisi');
    encCredentials = await encryptSecret(JSON.stringify({ apiKey, apiSecret }), c.env.MASTER_KEY);
  } else {
    const address = (body.address ?? '').trim();
    if (!address) return fail(c, 'Address wallet wajib diisi');
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
    if (rpcUrl) encCredentials = await encryptSecret(JSON.stringify({ rpcUrl }), c.env.MASTER_KEY);
  }

  const res = await run(
    c.env,
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
  return ok(c, { id: res.meta.last_row_id }, 201);
});

app.put('/:id', async (c) => {
  const id = Number(c.req.param('id'));
  const row = await queryOne<AccountRow>(c.env, 'SELECT * FROM accounts WHERE id = ?', id);
  if (!row) return fail(c, 'Account tidak ditemukan', 404);
  const body = await c.req.json<any>().catch(() => ({}));
  const type = row.type as AccountType;

  const label = body.label !== undefined ? String(body.label).trim() : row.label;
  const enabled = body.enabled !== undefined ? (body.enabled ? 1 : 0) : row.enabled;
  let encCredentials = row.enc_credentials;
  let config = row.config;

  if (ONCHAIN_TYPES.has(type)) {
    const prev = row.config ? JSON.parse(row.config) : {};
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
    if (body.rpcUrl) encCredentials = await encryptSecret(JSON.stringify({ rpcUrl: String(body.rpcUrl).trim() }), c.env.MASTER_KEY);
  } else {
    // Rotasi kredensial CEX hanya bila keduanya dikirim.
    if (body.apiKey && body.apiSecret) {
      encCredentials = await encryptSecret(
        JSON.stringify({ apiKey: String(body.apiKey).trim(), apiSecret: String(body.apiSecret).trim() }),
        c.env.MASTER_KEY,
      );
    }
  }

  await run(
    c.env,
    'UPDATE accounts SET label = ?, enabled = ?, enc_credentials = ?, config = ?, updated_at = ? WHERE id = ?',
    label,
    enabled,
    encCredentials,
    config,
    now(),
    id,
  );
  return ok(c, { updated: true });
});

app.delete('/:id', async (c) => {
  const id = Number(c.req.param('id'));
  await run(c.env, 'DELETE FROM accounts WHERE id = ?', id);
  return ok(c, { deleted: true });
});

// Trigger sync manual untuk satu account.
app.post('/:id/sync', async (c) => {
  const id = Number(c.req.param('id'));
  const found = await syncOne(c.env, id);
  if (!found) return fail(c, 'Account tidak ditemukan', 404);
  await refreshOverview(c.env).catch(() => undefined);
  const row = await queryOne<AccountRow>(c.env, 'SELECT * FROM accounts WHERE id = ?', id);
  return ok(c, row ? publicView(row) : { synced: true });
});

// Mulai backfill full-history deposit (Binance): mundur per jendela 90 hari sampai transaksi terlama.
// Sebagian besar diproses di latar belakang (waitUntil), sisanya dilanjutkan cron tiap 10 menit.
app.post('/:id/backfill-deposits', async (c) => {
  const id = Number(c.req.param('id'));
  const acc = await queryOne<AccountRow>(c.env, 'SELECT * FROM accounts WHERE id = ?', id);
  if (!acc) return fail(c, 'Account tidak ditemukan', 404);
  if (acc.type !== 'binance') return fail(c, 'Backfill saat ini hanya untuk Binance');
  if (await isCooling(c.env, 'cex:binance'))
    return fail(c, 'Binance sedang cooldown (geo-block 451). Coba lagi setelah ~15 menit.');
  const started = await startDepositBackfill(c.env, id);
  if (!started) return fail(c, 'Gagal memulai backfill');
  // Burst awal kecil (8 jendela, jeda 1 dtk) agar tak memicu flag IP; sisanya disebar cron 3/tick.
  c.executionCtx.waitUntil(runDepositBackfill(c.env, id, 8).catch(() => undefined));
  return ok(c, { started: true });
});

// Saldo terkini untuk satu account.
app.get('/:id/balances', async (c) => {
  const id = Number(c.req.param('id'));
  const rows = await queryAll(
    c.env,
    'SELECT wallet_type, asset, free, locked, total, updated_at FROM balances WHERE account_id = ? ORDER BY total DESC',
    id,
  );
  return ok(c, rows);
});

export default app;
