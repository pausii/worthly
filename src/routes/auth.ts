import { Hono } from 'hono';
import type { Env, Variables } from '../types';
import { now, queryOne, run } from '../lib/db';
import { hashPassword, verifyPassword } from '../lib/crypto';
import {
  createSession,
  destroySession,
  setSessionCookie,
  clearSessionCookie,
  readSessionCookie,
} from '../lib/session';
import { rateLimit, resetRateLimit } from '../lib/ratelimit';
import { requireAuth, requireCsrf } from '../lib/auth';
import { ok, fail } from '../lib/response';

const app = new Hono<{ Bindings: Env; Variables: Variables }>();

interface UserRow {
  id: number;
  username: string;
  password_hash: string;
  password_salt: string;
  iterations: number;
}

async function userCount(env: Env): Promise<number> {
  const row = await queryOne<{ c: number }>(env, 'SELECT COUNT(*) AS c FROM users');
  return row?.c ?? 0;
}

// Status: apakah perlu setup awal? sudah login?
app.get('/status', async (c) => {
  const needsSetup = (await userCount(c.env)) === 0;
  const sid = readSessionCookie(c);
  const authenticated = sid ? !!(await import('../lib/session').then((m) => m.getSession(c.env, sid))) : false;
  return ok(c, { needsSetup, authenticated });
});

// Setup user pertama (hanya jika belum ada user).
app.post('/setup', async (c) => {
  if ((await userCount(c.env)) > 0) return fail(c, 'Setup sudah dilakukan', 409);
  const body = (await c.req.json().catch(() => ({}))) as { username?: string; password?: string };
  const username = (body.username ?? '').trim();
  const password = body.password ?? '';
  if (username.length < 3) return fail(c, 'Username minimal 3 karakter');
  if (password.length < 10) return fail(c, 'Password minimal 10 karakter');

  const { hash, salt, iterations } = await hashPassword(password, undefined, undefined, c.env.MASTER_KEY);
  await run(
    c.env,
    'INSERT INTO users (username, password_hash, password_salt, iterations, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)',
    username,
    hash,
    salt,
    iterations,
    now(),
    now(),
  );
  return ok(c, { created: true });
});

// Login.
app.post('/login', async (c) => {
  const ip = c.req.header('CF-Connecting-IP') ?? 'unknown';
  // Rate limit per IP: 10 percobaan / 5 menit.
  const rl = await rateLimit(c.env, `login:${ip}`, 10, 300);
  if (!rl.allowed) return fail(c, 'Terlalu banyak percobaan. Coba lagi nanti.', 429);

  const body = (await c.req.json().catch(() => ({}))) as { username?: string; password?: string };
  const username = (body.username ?? '').trim();
  const password = body.password ?? '';

  const user = await queryOne<UserRow>(
    c.env,
    'SELECT id, username, password_hash, password_salt, iterations FROM users WHERE username = ?',
    username,
  );

  // Selalu jalankan verifikasi (timing) walau user tidak ada.
  const valid = user
    ? await verifyPassword(password, user.password_hash, user.password_salt, user.iterations, c.env.MASTER_KEY)
    : await verifyPassword(password, '', 'AAAAAAAAAAAAAAAAAAAAAA==', 100000, c.env.MASTER_KEY).then(() => false);

  if (!user || !valid) return fail(c, 'Username atau password salah', 401);

  await resetRateLimit(c.env, `login:${ip}`);
  const { sid } = await createSession(
    c.env,
    { id: user.id, username: user.username },
    { ip, ua: c.req.header('User-Agent') ?? undefined },
  );
  setSessionCookie(c, sid);
  return ok(c, { username: user.username });
});

// Logout.
app.post('/logout', requireAuth, async (c) => {
  await destroySession(c.env, c.get('sid'));
  clearSessionCookie(c);
  return ok(c, { loggedOut: true });
});

// Info user + token CSRF.
app.get('/me', requireAuth, (c) => {
  const s = c.get('session');
  return ok(c, { username: s.username, csrf: s.csrf });
});

// Ganti password (mencabut semua perlu re-login krn session lama tetap; cukup untuk single-user).
app.post('/change-password', requireAuth, requireCsrf, async (c) => {
  const body = (await c.req.json().catch(() => ({}))) as { current?: string; next?: string };
  const current = body.current ?? '';
  const next = body.next ?? '';
  if (next.length < 10) return fail(c, 'Password baru minimal 10 karakter');

  const s = c.get('session');
  const user = await queryOne<UserRow>(
    c.env,
    'SELECT id, username, password_hash, password_salt, iterations FROM users WHERE id = ?',
    s.userId,
  );
  if (!user) return fail(c, 'User tidak ditemukan', 404);
  const valid = await verifyPassword(current, user.password_hash, user.password_salt, user.iterations, c.env.MASTER_KEY);
  if (!valid) return fail(c, 'Password saat ini salah', 401);

  const { hash, salt, iterations } = await hashPassword(next, undefined, undefined, c.env.MASTER_KEY);
  await run(
    c.env,
    'UPDATE users SET password_hash = ?, password_salt = ?, iterations = ?, updated_at = ? WHERE id = ?',
    hash,
    salt,
    iterations,
    now(),
    user.id,
  );
  return ok(c, { changed: true });
});

export default app;
