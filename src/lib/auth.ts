import type { MiddlewareHandler } from 'hono';
import type { Env, Variables } from '../types';
import { getSession, readSessionCookie } from './session';
import { randomToken } from './crypto';

type M = MiddlewareHandler<{ Bindings: Env; Variables: Variables }>;

/** Wajib login. Menaruh session ke context. */
export const requireAuth: M = async (c, next) => {
  const sid = readSessionCookie(c);
  if (!sid) return c.json({ ok: false, error: 'unauthorized' }, 401);
  const session = await getSession(c.env, sid);
  if (!session) return c.json({ ok: false, error: 'unauthorized' }, 401);
  c.set('session', session);
  c.set('sid', sid);
  await next();
};

/**
 * Proteksi CSRF untuk method yang mengubah state.
 * Cookie sudah SameSite=Strict; ditambah validasi header X-CSRF-Token == session.csrf
 * (header custom tidak bisa di-set lintas-origin tanpa CORS preflight yang kita tolak).
 */
export const requireCsrf: M = async (c, next) => {
  const method = c.req.method.toUpperCase();
  if (method === 'GET' || method === 'HEAD' || method === 'OPTIONS') return next();
  const session = c.get('session');
  const token = c.req.header('X-CSRF-Token');
  if (!session || !token || token !== session.csrf) {
    return c.json({ ok: false, error: 'csrf_failed' }, 403);
  }
  await next();
};

/** Security headers untuk semua response. */
export const securityHeaders: M = async (c, next) => {
  // Nonce per-request untuk skrip inline (theme-init & app()/login()), agar CSP tak perlu 'unsafe-inline'.
  const nonce = randomToken(16);
  c.set('cspNonce', nonce);
  await next();
  const h = c.res.headers;
  h.set('X-Content-Type-Options', 'nosniff');
  h.set('X-Frame-Options', 'DENY');
  h.set('Referrer-Policy', 'no-referrer');
  h.set('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
  h.set('Cross-Origin-Opener-Policy', 'same-origin');
  // Frontend kini di-self-host (Tailwind precompiled + Alpine + Chart.js via Workers Assets) —
  // tidak ada CDN pihak ketiga & tanpa 'unsafe-inline'. Skrip inline diizinkan lewat nonce.
  // 'unsafe-eval' tetap dibutuhkan: Alpine mengevaluasi ekspresi atribut via Function().
  h.set(
    'Content-Security-Policy',
    [
      "default-src 'self'",
      `script-src 'self' 'unsafe-eval' 'nonce-${nonce}'`,
      "style-src 'self' 'unsafe-inline'",
      "font-src 'self' data:",
      "img-src 'self' data:",
      "connect-src 'self'",
      "worker-src 'self'",
      "base-uri 'self'",
      "form-action 'self'",
      "frame-ancestors 'none'",
    ].join('; '),
  );
}
