import { Hono } from 'hono';
import { getCookie, setCookie } from 'hono/cookie';
import type { Env, Variables, AppContext } from './types';
import { securityHeaders } from './lib/auth';
import { getSession, readSessionCookie } from './lib/session';
import { loginHtml } from './frontend/login';
import { appHtml } from './frontend/app';
import { iconSvg, manifestJson, swJs } from './frontend/pwa';

import { yoga } from './graphql/yoga';
import { graphiqlGate } from './graphql/graphiqlGate';
import { syncAll } from './services/sync';

const app = new Hono<{ Bindings: Env; Variables: Variables }>();

app.use('*', securityHeaders);

// --- Halaman ---
// Sisipkan nonce CSP per-request ke placeholder skrip inline.
const withNonce = (html: string, nonce: string) => html.replace(/__CSP_NONCE__/g, nonce);

app.get('/login', (c) => c.html(withNonce(loginHtml, c.get('cspNonce'))));

const appVersion = (c: AppContext) => c.env.CF_VERSION_METADATA?.id ?? 'dev';

app.get('/', async (c) => {
  const sid = readSessionCookie(c);
  const session = sid ? await getSession(c.env, sid) : null;
  if (!session) return c.redirect('/login', 302);
  const html = withNonce(appHtml, c.get('cspNonce')).replace(/__APP_VERSION__/g, appVersion(c));
  return c.html(html);
});

app.get('/healthz', (c) => c.json({ ok: true }));

// Id versi deploy terkini — dipakai PWA untuk deteksi update (selalu fresh).
app.get('/version', (c) => {
  c.header('Cache-Control', 'no-store');
  return c.json({ id: appVersion(c) });
});

// PWA assets
app.get('/manifest.json', (c) => {
  c.header('Content-Type', 'application/manifest+json');
  return c.body(manifestJson);
});
app.get('/icon.svg', (c) => {
  c.header('Content-Type', 'image/svg+xml; charset=utf-8');
  return c.body(iconSvg);
});
app.get('/sw.js', (c) => {
  c.header('Content-Type', 'application/javascript; charset=utf-8');
  c.header('Service-Worker-Allowed', '/');
  return c.body(swJs);
});

// --- GraphQL API ---
// Seluruh REST lama (/api/*) digantikan oleh satu endpoint GraphQL.
// Auth (requireAuth) & CSRF (requireCsrf) kini ditegakkan di authPlugin (lihat graphql/authPlugin.ts).
const GRAPHIQL_COOKIE = 'graphiql_unlocked';

const sessionOf = async (c: AppContext) => {
  const sid = readSessionCookie(c);
  return sid ? await getSession(c.env, sid) : null;
};

// Gerbang password GraphiQL: verifikasi password lalu set cookie unlock.
app.post('/graphql/unlock', async (c) => {
  if (!(await sessionOf(c))) return c.redirect('/login', 302);
  const form = await c.req.parseBody();
  const password = typeof form.password === 'string' ? form.password : '';
  const gatePassword = c.env.GRAPHIQL_PASSWORD;
  if (!gatePassword || password !== gatePassword) {
    return c.html(withNonce(graphiqlGate(true), c.get('cspNonce')), 401);
  }
  setCookie(c, GRAPHIQL_COOKIE, '1', {
    httpOnly: true,
    secure: true,
    sameSite: 'Strict',
    path: '/',
    maxAge: 60 * 60 * 12, // 12 jam
  });
  return c.redirect('/graphql', 302);
});

// Endpoint GraphQL (POST query/mutation) + halaman GraphiQL (GET text/html, di-gate).
app.all('/graphql', async (c) => {
  const wantsHtml = c.req.method === 'GET' && (c.req.header('accept') || '').includes('text/html');
  if (wantsHtml) {
    if (!(await sessionOf(c))) return c.redirect('/login', 302);
    if (getCookie(c, GRAPHIQL_COOKIE) !== '1') {
      return c.html(withNonce(graphiqlGate(false), c.get('cspNonce')));
    }
  }
  return yoga.fetch(c.req.raw, { env: c.env, executionCtx: c.executionCtx, cookieJar: [] });
});

app.notFound((c) => {
  if (c.req.path === '/graphql') return c.json({ ok: false, error: 'not_found' }, 404);
  return c.redirect('/', 302);
});

app.onError((err, c) => {
  console.error('Unhandled error:', err);
  return c.json({ ok: false, error: 'internal_error' }, 500);
});

export default {
  fetch: app.fetch,

  // Cron Trigger Cloudflare (tiap 10 menit, lihat wrangler.toml).
  async scheduled(_event: ScheduledController, env: Env, ctx: ExecutionContext) {
    ctx.waitUntil(
      syncAll(env).catch((e) => console.error('Cron syncAll error:', e)),
    );
  },
};
