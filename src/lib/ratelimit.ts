import type { Env } from '../types';

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfter: number; // detik
}

/**
 * Rate limit sederhana berbasis KV (fixed window).
 * Cukup untuk proteksi brute-force login. Tidak 100% atomic, tapi memadai.
 */
export async function rateLimit(
  env: Env,
  bucket: string,
  limit: number,
  windowSeconds: number,
): Promise<RateLimitResult> {
  const key = `rl:${bucket}`;
  const current = parseInt((await env.KV.get(key)) ?? '0', 10) || 0;
  if (current >= limit) {
    return { allowed: false, remaining: 0, retryAfter: windowSeconds };
  }
  await env.KV.put(key, String(current + 1), { expirationTtl: windowSeconds });
  return { allowed: true, remaining: limit - current - 1, retryAfter: 0 };
}

export async function resetRateLimit(env: Env, bucket: string): Promise<void> {
  await env.KV.delete(`rl:${bucket}`);
}
