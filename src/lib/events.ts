import type { Env } from '../types';
import { run, now } from './db';

export interface EventInput {
  level: 'error' | 'warning' | 'info';
  source: string;
  account_id?: number | null;
  message: string;
  detail?: string | null;
}

/** Tulis event sistem ke DB. Tidak pernah throw — kegagalan logging tidak boleh merusak caller. */
export async function addEvent(env: Env, evt: EventInput): Promise<void> {
  try {
    await run(
      env,
      `INSERT INTO system_events (level, source, account_id, message, detail, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
      evt.level,
      evt.source,
      evt.account_id ?? null,
      evt.message,
      evt.detail ?? null,
      now(),
    );
  } catch {
    // Intentionally swallowed — event logging must never break the caller
  }
}
