import type { Env } from '../types';

// Circuit breaker sederhana berbasis KV. Saat sebuah penyedia (mis. Binance) menolak dengan 451,
// kita "cooldown" sejenak agar tidak terus-menerus menghantam IP yang ke-flag (memperpanjang ban).

const keyOf = (name: string) => `cooldown:${name}`;

/** True bila masih dalam masa cooldown. */
export async function isCooling(env: Env, name: string): Promise<boolean> {
  return (await env.KV.get(keyOf(name))) !== null;
}

/** Aktifkan cooldown selama `seconds` (auto-hapus via TTL KV). */
export async function setCooldown(env: Env, name: string, seconds: number): Promise<void> {
  await env.KV.put(keyOf(name), String(Date.now()), { expirationTtl: seconds });
}
