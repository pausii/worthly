import type {
  CexCredentials,
  Env,
  NormalizedBalance,
  NormalizedDeposit,
  OnchainConfig,
  OnchainCredentials,
} from '../types';
import { now, queryAll, queryOne, run } from '../lib/db';
import { decryptSecret } from '../lib/crypto';
import * as binance from './cex/binance';
import * as bybit from './cex/bybit';
import { getEvmBalances, getEvmAutoBalances } from './onchain/evm';
import { getTronBalances } from './onchain/tron';
import { computeValuation, type ValuationResult } from './valuation';
import { refreshOverview } from './overview';
import { isCooling, setCooldown } from '../lib/cooldown';
import { addEvent } from '../lib/events';

const CEX_COOLDOWN_SECONDS = 900; // 15 menit setelah 451 (hindari menghantam IP yang ke-flag)

interface AccountRow {
  id: number;
  portfolio_id: number;
  type: string;
  label: string;
  enc_credentials: string | null;
  config: string | null;
}

async function getCursor(env: Env, accountId: number, key: string): Promise<string | null> {
  const row = await queryOne<{ value: string }>(
    env,
    'SELECT value FROM sync_state WHERE account_id = ? AND key = ?',
    accountId,
    key,
  );
  return row?.value ?? null;
}

async function setCursor(env: Env, accountId: number, key: string, value: string): Promise<void> {
  await run(
    env,
    `INSERT INTO sync_state (account_id, key, value, updated_at) VALUES (?, ?, ?, ?)
     ON CONFLICT(account_id, key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
    accountId,
    key,
    value,
    now(),
  );
}

/** Tulis ulang saldo terkini untuk satu account (hapus yang sudah tidak ada). */
async function upsertBalances(env: Env, accountId: number, balances: NormalizedBalance[]): Promise<void> {
  const ts = now();
  await run(env, 'DELETE FROM balances WHERE account_id = ?', accountId);
  for (const b of balances) {
    await run(
      env,
      `INSERT INTO balances (account_id, wallet_type, asset, free, locked, total, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(account_id, wallet_type, asset)
       DO UPDATE SET free = excluded.free, locked = excluded.locked, total = excluded.total, updated_at = excluded.updated_at`,
      accountId,
      b.walletType,
      b.asset.toUpperCase(),
      b.free,
      b.locked,
      b.total,
      ts,
    );
  }
}

async function upsertDeposits(env: Env, accountId: number, deposits: NormalizedDeposit[]): Promise<void> {
  const ts = now();
  for (const d of deposits) {
    await run(
      env,
      `INSERT INTO deposits (account_id, tx_id, asset, amount, network, address, status, ts, raw, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(account_id, tx_id)
       DO UPDATE SET status = excluded.status, amount = excluded.amount`,
      accountId,
      d.txId,
      d.asset.toUpperCase(),
      d.amount,
      d.network ?? null,
      d.address ?? null,
      d.status ?? null,
      d.ts,
      d.raw ? JSON.stringify(d.raw) : null,
      ts,
    );
  }
}

const NINETY_DAYS_MS = 90 * 24 * 60 * 60 * 1000;
const BACKFILL_FLOOR = Date.UTC(2017, 6, 1); // ~peluncuran Binance (Jul 2017)

interface BackfillState {
  cursorEnd: number; // batas akhir jendela berikutnya (berjalan mundur)
  done: boolean;
  fetched: number; // total baris deposit yang sempat diambil
}

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/**
 * Backfill deposit untuk satu account, mundur per jendela 90 hari (batas Binance),
 * maksimum `maxWindows` jendela per panggilan agar hemat subrequest/CPU Worker.
 * State disimpan di sync_state sehingga bisa dilanjutkan cron pada tick berikutnya.
 */
export async function backfillDeposits(
  env: Env,
  acc: AccountRow,
  maxWindows: number,
): Promise<BackfillState | null> {
  if (acc.type !== 'binance' || !acc.enc_credentials) return null;
  const raw = await getCursor(env, acc.id, 'deposit_backfill');
  const state: BackfillState = raw
    ? (JSON.parse(raw) as BackfillState)
    : { cursorEnd: Date.now(), done: false, fetched: 0 };
  if (state.done) return state;

  const creds = JSON.parse(await decryptSecret(acc.enc_credentials, env.MASTER_KEY)) as CexCredentials;
  const proxyUrl = env.BINANCE_PROXY_URL || undefined;
  for (let i = 0; i < maxWindows && !state.done; i++) {
    const end = state.cursorEnd;
    const start = Math.max(end - NINETY_DAYS_MS, BACKFILL_FLOOR);
    const deposits = await binance.getDepositHistoryRange(creds, start, end, proxyUrl);
    await upsertDeposits(env, acc.id, deposits);
    state.fetched += deposits.length;
    state.cursorEnd = start - 1;
    if (start <= BACKFILL_FLOOR) state.done = true;
    await setCursor(env, acc.id, 'deposit_backfill', JSON.stringify(state));
    if (!state.done) await sleep(1000); // ramah rate-limit / hindari burst yang memicu flag IP
  }
  return state;
}

/** Mulai / reset backfill dari sekarang (dipanggil tombol UI). */
export async function startDepositBackfill(env: Env, accountId: number): Promise<boolean> {
  const acc = await queryOne<AccountRow>(
    env,
    'SELECT id, portfolio_id, type, label, enc_credentials, config FROM accounts WHERE id = ?',
    accountId,
  );
  if (!acc || acc.type !== 'binance') return false;
  await setCursor(
    env,
    acc.id,
    'deposit_backfill',
    JSON.stringify({ cursorEnd: Date.now(), done: false, fetched: 0 }),
  );
  return true;
}

/** Jalankan backfill untuk satu account by id (dipakai endpoint lewat waitUntil). */
export async function runDepositBackfill(
  env: Env,
  accountId: number,
  maxWindows: number,
): Promise<BackfillState | null> {
  const acc = await queryOne<AccountRow>(
    env,
    'SELECT id, portfolio_id, type, label, enc_credentials, config FROM accounts WHERE id = ?',
    accountId,
  );
  if (!acc) return null;
  return backfillDeposits(env, acc, maxWindows);
}

async function syncCexAccount(env: Env, acc: AccountRow): Promise<void> {
  if (!acc.enc_credentials) throw new Error('Kredensial belum diisi');
  const creds = JSON.parse(await decryptSecret(acc.enc_credentials, env.MASTER_KEY)) as CexCredentials;
  const api = acc.type === 'binance' ? binance : bybit;
  const proxyUrl = acc.type === 'binance' ? (env.BINANCE_PROXY_URL || undefined) : undefined;

  const balances = proxyUrl
    ? await binance.getAllBalances(creds, proxyUrl)
    : await api.getAllBalances(creds);
  await upsertBalances(env, acc.id, balances);

  // Deposit incremental: mulai dari cursor terakhir (default 90 hari ke belakang).
  // Kegagalan di sini (mis. 451 geo) TIDAK boleh menggagalkan sync saldo — abaikan & coba lagi.
  try {
    const lastTs = parseInt((await getCursor(env, acc.id, 'deposit_ts')) ?? '0', 10);
    const startTime = lastTs > 0 ? lastTs + 1 : Date.now() - 90 * 24 * 60 * 60 * 1000;
    const deposits = proxyUrl
      ? await binance.getDepositHistory(creds, startTime, proxyUrl)
      : await api.getDepositHistory(creds, startTime);
    await upsertDeposits(env, acc.id, deposits);
    const maxTs = deposits.reduce((m, d) => Math.max(m, d.ts), lastTs);
    if (maxTs > lastTs) await setCursor(env, acc.id, 'deposit_ts', String(maxTs));
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await addEvent(env, {
      level: 'warning',
      source: acc.type,
      account_id: acc.id,
      message: 'Fetch deposit gagal (saldo tetap tersimpan)',
      detail: msg.slice(0, 300),
    });
  }
}

async function syncOnchainAccount(env: Env, acc: AccountRow): Promise<void> {
  const config = JSON.parse(acc.config ?? '{}') as OnchainConfig;
  if (!config.address) throw new Error('Address on-chain belum diisi');

  let rpcUrl = '';
  let apiKey = '';
  if (acc.enc_credentials) {
    const creds = JSON.parse(await decryptSecret(acc.enc_credentials, env.MASTER_KEY)) as OnchainCredentials;
    rpcUrl = creds.rpcUrl ?? '';
    apiKey = creds.apiKey ?? '';
  }
  if (!rpcUrl) {
    rpcUrl =
      acc.type === 'eth'
        ? env.RPC_ETH_URL ?? ''
        : acc.type === 'bsc'
          ? env.RPC_BSC_URL ?? ''
          : env.RPC_TRON_URL ?? '';
  }
  if (!rpcUrl) throw new Error(`Endpoint RPC untuk ${acc.type} belum dikonfigurasi`);
  if (!apiKey && acc.type === 'tron') apiKey = env.RPC_TRON_API_KEY ?? '';

  let balances: NormalizedBalance[];
  if (acc.type === 'tron') {
    balances = await getTronBalances(rpcUrl, config, apiKey);
  } else {
    balances = await getEvmBalances(rpcUrl, config, acc.type === 'eth' ? 'ETH' : 'BNB');
    // Auto-deteksi token: gabungkan, dahulukan token manual/native yang sudah ada.
    if (config.autoDetect) {
      const auto = await getEvmAutoBalances(rpcUrl, config.address);
      const seen = new Set(balances.map((b) => b.asset.toUpperCase()));
      for (const b of auto) {
        const sym = b.asset.toUpperCase();
        if (!seen.has(sym)) {
          balances.push(b);
          seen.add(sym);
        }
      }
    }
  }

  await upsertBalances(env, acc.id, balances);
}

/** Sinkronkan satu account dan update status. */
export async function syncAccount(env: Env, acc: AccountRow): Promise<void> {
  const isCex = acc.type === 'binance' || acc.type === 'bybit';
  // Circuit breaker: kalau penyedia lagi cooldown (habis 451), lewati tanpa menyentuh data/status.
  if (isCex && (await isCooling(env, `cex:${acc.type}`))) return;
  try {
    if (isCex) await syncCexAccount(env, acc);
    else await syncOnchainAccount(env, acc);
    await run(
      env,
      'UPDATE accounts SET status = ?, last_error = NULL, last_synced_at = ?, updated_at = ? WHERE id = ?',
      'ok',
      now(),
      now(),
      acc.id,
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    // 451 = geo/flag IP. Cooldown agar tick berikutnya tak ikut menghantam IP yang ke-flag.
    const is451 = isCex && msg.includes('451');
    if (is451) await setCooldown(env, `cex:${acc.type}`, CEX_COOLDOWN_SECONDS);
    await addEvent(env, {
      level: is451 ? 'warning' : 'error',
      source: acc.type,
      account_id: acc.id,
      message: is451
        ? `451 geo-block: ${acc.label} — cooldown ${CEX_COOLDOWN_SECONDS / 60} menit`
        : `Sync gagal: ${acc.label}`,
      detail: msg.slice(0, 500),
    });
    await run(
      env,
      'UPDATE accounts SET status = ?, last_error = ?, updated_at = ? WHERE id = ?',
      'error',
      msg.slice(0, 500),
      now(),
      acc.id,
    );
  }
}

/** Tulis snapshot nilai portofolio jika interval sudah lewat. Pakai valuasi yang sudah dihitung. */
async function maybeSnapshot(env: Env, valuation: ValuationResult): Promise<void> {
  const intervalMin = parseInt(env.SNAPSHOT_INTERVAL_MINUTES ?? '30', 10) || 30;
  const lastRow = await queryOne<{ captured_at: number }>(
    env,
    'SELECT MAX(captured_at) AS captured_at FROM portfolio_snapshots',
  );
  const last = lastRow?.captured_at ?? 0;
  if (now() - last < intervalMin * 60 * 1000) return;

  const ts = now();
  for (const p of valuation.portfolios) {
    await run(
      env,
      'INSERT INTO portfolio_snapshots (portfolio_id, total_usd, captured_at) VALUES (?, ?, ?)',
      p.id,
      p.totalUsd,
      ts,
    );
  }
}

/** Ambil/simpan kursor round-robin sync di tabel settings. */
async function getSyncCursor(env: Env): Promise<number> {
  const row = await queryOne<{ value: string }>(env, "SELECT value FROM settings WHERE key = 'sync_cursor'");
  return parseInt(row?.value ?? '0', 10) || 0;
}
async function setSyncCursor(env: Env, value: number): Promise<void> {
  await run(
    env,
    `INSERT INTO settings (key, value, updated_at) VALUES ('sync_cursor', ?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
    String(value),
    now(),
  );
}

/** Dipanggil oleh cron / trigger manual. Sinkronkan account aktif. */
export async function syncAll(env: Env): Promise<{ synced: number }> {
  const accounts = await queryAll<AccountRow>(
    env,
    'SELECT id, portfolio_id, type, label, enc_credentials, config FROM accounts WHERE enabled = 1 ORDER BY id',
  );

  // Round-robin (Workers Free: batas CPU per-invocation ketat). 0/kosong = sinkron semua.
  const batchSize = parseInt(env.SYNC_BATCH_SIZE ?? '0', 10) || 0;
  let toSync = accounts;
  if (batchSize > 0 && accounts.length > batchSize) {
    const start = (await getSyncCursor(env)) % accounts.length;
    toSync = [];
    for (let i = 0; i < batchSize; i++) toSync.push(accounts[(start + i) % accounts.length]);
    await setSyncCursor(env, (start + batchSize) % accounts.length);
  }

  // Sekuensial agar ramah rate-limit API eksternal.
  for (const acc of toSync) await syncAccount(env, acc);
  // Lanjutkan backfill deposit yang sedang berjalan (hanya bila sudah dimulai via tombol).
  for (const acc of toSync) {
    if (acc.type !== 'binance') continue;
    if (await isCooling(env, 'cex:binance')) break; // lagi cooldown — jangan poke IP yang ke-flag
    const raw = await getCursor(env, acc.id, 'deposit_backfill');
    if (!raw) continue;
    try {
      const st = JSON.parse(raw) as { done: boolean };
      // 1 jendela per tick agar beban CPU/subrequest per-invocation kecil (lanjut tick berikutnya).
      if (!st.done) await backfillDeposits(env, acc, 1);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      await addEvent(env, {
        level: 'warning',
        source: 'backfill',
        account_id: acc.id,
        message: `Backfill deposit gagal: ${acc.label}`,
        detail: msg.slice(0, 300),
      });
    }
  }
  // Hitung valuasi SEKALI per tick, lalu pakai ulang untuk snapshot + overview
  // (sebelumnya computeValuation berjalan 2x pada tick yang ada snapshot).
  const valuation = await computeValuation(env);
  await maybeSnapshot(env, valuation);
  // Simpan overview ke DB agar UI cukup membaca dari sana (bukan hitung live).
  await refreshOverview(env, valuation).catch(() => undefined);
  return { synced: toSync.length };
}

/** Sinkron satu account by id (untuk tombol "Sync sekarang" di UI). */
export async function syncOne(env: Env, accountId: number): Promise<boolean> {
  const acc = await queryOne<AccountRow>(
    env,
    'SELECT id, portfolio_id, type, label, enc_credentials, config FROM accounts WHERE id = ?',
    accountId,
  );
  if (!acc) return false;
  await syncAccount(env, acc);
  return true;
}
