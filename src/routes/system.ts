import { Hono } from 'hono';
import type { Env, Variables } from '../types';
import { queryAll, queryOne, run, now } from '../lib/db';
import { ok } from '../lib/response';
import { isCooling } from '../lib/cooldown';

const app = new Hono<{ Bindings: Env; Variables: Variables }>();

app.get('/events', async (c) => {
  const limit = Math.min(Math.max(Number(c.req.query('limit')) || 200, 1), 500);
  const events = await queryAll(
    c.env,
    `SELECT id, level, source, account_id, message, detail, created_at, read_at
     FROM system_events ORDER BY created_at DESC LIMIT ?`,
    limit,
  );
  const unread = await queryOne<{ count: number }>(
    c.env,
    'SELECT COUNT(*) AS count FROM system_events WHERE read_at IS NULL',
  );
  return ok(c, { events, unreadCount: unread?.count ?? 0 });
});

app.post('/events/read-all', async (c) => {
  await run(c.env, 'UPDATE system_events SET read_at = ? WHERE read_at IS NULL', now());
  return ok(c, null);
});

app.delete('/events', async (c) => {
  await run(c.env, 'DELETE FROM system_events');
  return ok(c, null);
});

interface AccountRow {
  id: number;
  type: string;
  label: string;
  status: string | null;
  last_synced_at: number | null;
  last_error: string | null;
}

app.get('/queue', async (c) => {
  const accounts = await queryAll<AccountRow>(
    c.env,
    'SELECT id, type, label, status, last_synced_at, last_error FROM accounts WHERE enabled = 1 ORDER BY label',
  );

  const binanceCooling = await isCooling(c.env, 'cex:binance');
  const bybitCooling = await isCooling(c.env, 'cex:bybit');

  const lastSnapshot = await queryOne<{ captured_at: number }>(
    c.env,
    'SELECT MAX(captured_at) AS captured_at FROM portfolio_snapshots',
  );
  const intervalMin = parseInt(c.env.SNAPSHOT_INTERVAL_MINUTES ?? '30', 10) || 30;
  const nextSnapshot = (lastSnapshot?.captured_at ?? 0) + intervalMin * 60 * 1000;

  const queue = [];
  for (const acc of accounts) {
    let backfill: unknown = null;
    if (acc.type === 'binance') {
      const row = await queryOne<{ value: string }>(
        c.env,
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

  return ok(c, { accounts: queue, nextSnapshot, snapshotIntervalMin: intervalMin });
});

export default app;
