import { Hono } from 'hono';
import type { Env, Variables } from './types';
import { securityHeaders, requireAuth, requireCsrf } from './lib/auth';
import { getSession, readSessionCookie } from './lib/session';
import { loginHtml } from './frontend/login';
import { appHtml } from './frontend/app';
import { iconSvg, manifestJson, swJs } from './frontend/pwa';

import authRoutes from './routes/auth';
import portfolioRoutes from './routes/portfolios';
import accountRoutes from './routes/accounts';
import holdingRoutes from './routes/holdings';
import dashboardRoutes from './routes/dashboard';
import exportRoutes from './routes/export';
import { syncAll } from './services/sync';

const app = new Hono<{ Bindings: Env; Variables: Variables }>();

app.use('*', securityHeaders);

// --- Halaman ---
app.get('/login', (c) => c.html(loginHtml));

app.get('/', async (c) => {
  const sid = readSessionCookie(c);
  const session = sid ? await getSession(c.env, sid) : null;
  if (!session) return c.redirect('/login', 302);
  return c.html(appHtml);
});

app.get('/healthz', (c) => c.json({ ok: true }));

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

// --- API publik (auth) ---
app.route('/api/auth', authRoutes);

// --- API terproteksi ---
const api = new Hono<{ Bindings: Env; Variables: Variables }>();
api.use('*', requireAuth, requireCsrf);
api.route('/portfolios', portfolioRoutes);
api.route('/accounts', accountRoutes);
api.route('/holdings', holdingRoutes);
api.route('/dashboard', dashboardRoutes);
api.route('/export', exportRoutes);
app.route('/api', api);

app.notFound((c) => {
  if (c.req.path.startsWith('/api')) return c.json({ ok: false, error: 'not_found' }, 404);
  return c.redirect('/', 302);
});

app.onError((err, c) => {
  console.error('Unhandled error:', err);
  return c.json({ ok: false, error: 'internal_error' }, 500);
});

export default {
  fetch: app.fetch,

  // Cron Trigger Cloudflare (tiap 2 menit, lihat wrangler.toml).
  async scheduled(_event: ScheduledController, env: Env, ctx: ExecutionContext) {
    ctx.waitUntil(
      syncAll(env).catch((e) => console.error('Cron syncAll error:', e)),
    );
  },
};
