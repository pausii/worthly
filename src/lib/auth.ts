import type { MiddlewareHandler } from 'hono';
import type { Env, Variables } from '../types';
import { getSession, readSessionCookie } from './session';

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
  await next();
  const h = c.res.headers;
  h.set('X-Content-Type-Options', 'nosniff');
  h.set('X-Frame-Options', 'DENY');
  h.set('Referrer-Policy', 'no-referrer');
  h.set('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
  h.set('Cross-Origin-Opener-Policy', 'same-origin');
  // CSP: izinkan CDN yang dipakai frontend (Tailwind, Alpine, Chart.js, Google Fonts).
  // Alpine & Tailwind CDN butuh 'unsafe-eval'/'unsafe-inline'. Ini trade-off dari syarat "full CDN".
  h.set(
    'Content-Security-Policy',
    [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdn.tailwindcss.com https://cdn.jsdelivr.net https://unpkg.com",
      "style-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net https://fonts.googleapis.com",
      "font-src 'self' https://fonts.gstatic.com data:",
      "img-src 'self' data: https:",
      "connect-src 'self' https://cdn.jsdelivr.net",
      "worker-src 'self'",
      "base-uri 'self'",
      "form-action 'self'",
      "frame-ancestors 'none'",
    ].join('; '),
  );
}
