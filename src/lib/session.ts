import { getCookie, setCookie, deleteCookie } from 'hono/cookie';
import type { AppContext, Env, SessionData } from '../types';
import { randomToken } from './crypto';

export const SESSION_COOKIE = '__Host-sid';
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7; // 7 hari
const sessionKey = (sid: string) => `sess:${sid}`;

export async function createSession(
  env: Env,
  user: { id: number; username: string },
  meta: { ip?: string; ua?: string },
): Promise<{ sid: string; data: SessionData }> {
  const sid = randomToken(32);
  const data: SessionData = {
    userId: user.id,
    username: user.username,
    csrf: randomToken(32),
    createdAt: Date.now(),
    ip: meta.ip,
    ua: meta.ua,
  };
  await env.KV.put(sessionKey(sid), JSON.stringify(data), { expirationTtl: SESSION_TTL_SECONDS });
  return { sid, data };
}

export async function getSession(env: Env, sid: string): Promise<SessionData | null> {
  const raw = await env.KV.get(sessionKey(sid));
  if (!raw) return null;
  try {
    return JSON.parse(raw) as SessionData;
  } catch {
    return null;
  }
}

export async function destroySession(env: Env, sid: string): Promise<void> {
  await env.KV.delete(sessionKey(sid));
}

/** Set cookie session. Prefix __Host- mewajibkan Secure + Path=/ + tanpa Domain. */
export function setSessionCookie(c: AppContext, sid: string): void {
  setCookie(c, SESSION_COOKIE, sid, {
    httpOnly: true,
    secure: true,
    sameSite: 'Strict',
    path: '/',
    maxAge: SESSION_TTL_SECONDS,
  });
}

export function clearSessionCookie(c: AppContext): void {
  deleteCookie(c, SESSION_COOKIE, { path: '/' });
}

export function readSessionCookie(c: AppContext): string | undefined {
  return getCookie(c, SESSION_COOKIE);
}
