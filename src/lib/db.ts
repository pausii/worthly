import type { Env } from '../types';

export const now = () => Date.now();

/** Ambil 1 baris atau null. */
export async function queryOne<T = Record<string, unknown>>(
  env: Env,
  sql: string,
  ...params: unknown[]
): Promise<T | null> {
  const stmt = env.DB.prepare(sql).bind(...params);
  return (await stmt.first<T>()) ?? null;
}

/** Ambil banyak baris. */
export async function queryAll<T = Record<string, unknown>>(
  env: Env,
  sql: string,
  ...params: unknown[]
): Promise<T[]> {
  const stmt = env.DB.prepare(sql).bind(...params);
  const res = await stmt.all<T>();
  return res.results ?? [];
}

/** Eksekusi statement tulis. */
export async function run(env: Env, sql: string, ...params: unknown[]): Promise<D1Result> {
  return env.DB.prepare(sql).bind(...params).run();
}

export interface BatchStmt { sql: string; params?: unknown[] }

/**
 * Jalankan beberapa statement tulis sebagai SATU transaksi D1 (all-or-nothing) dan satu
 * round-trip. Dipakai untuk penulisan yang tidak boleh setengah jadi (mis. hapus saldo
 * dompet lalu sisipkan saldo barunya) — kalau invocation mati di tengah, data lama tetap utuh.
 */
export async function batch(env: Env, stmts: BatchStmt[]): Promise<D1Result[]> {
  if (!stmts.length) return [];
  return env.DB.batch(stmts.map((s) => env.DB.prepare(s.sql).bind(...(s.params ?? []))));
}

export async function getSetting(env: Env, key: string): Promise<string | null> {
  const row = await queryOne<{ value: string }>(env, 'SELECT value FROM settings WHERE key = ?', key);
  return row?.value ?? null;
}

export async function setSetting(env: Env, key: string, value: string): Promise<void> {
  await run(
    env,
    `INSERT INTO settings (key, value, updated_at) VALUES (?, ?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
    key,
    value,
    now(),
  );
}
