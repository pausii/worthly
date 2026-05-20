import type { AppContext } from '../types';

export function ok<T>(c: AppContext, data: T, status = 200) {
  return c.json({ ok: true, data }, status as any);
}

export function fail(c: AppContext, message: string, status = 400, extra?: Record<string, unknown>) {
  return c.json({ ok: false, error: message, ...extra }, status as any);
}
