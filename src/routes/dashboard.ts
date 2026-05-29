import { Hono } from 'hono';
import type { Env, Variables } from '../types';
import { queryAll, queryOne } from '../lib/db';
import { ok } from '../lib/response';
import { syncAll } from '../services/sync';
import { getStoredOverview, refreshOverview } from '../services/overview';
import { classifyAsset, getDailyCloses, getUsdRates } from '../services/prices';

const app = new Hono<{ Bindings: Env; Variables: Variables }>();

// Ringkasan nilai semua portofolio. Dibaca LANGSUNG dari DB (hasil hitungan worker/cron) —
// tidak ada fetch harga / valuasi live di sini agar UI instan & murni dari DB.
app.get('/overview', async (c) => {
  const stored = await getStoredOverview(c.env);
  if (stored) return ok(c, stored);
  // Fallback sekali (mis. sebelum cron pertama mengisi cache): hitung & simpan.
  return ok(c, await refreshOverview(c.env));
});

// Data chart pergerakan nilai. ?portfolio_id= (kosong = agregat semua), ?days=30
app.get('/history', async (c) => {
  const pid = c.req.query('portfolio_id');
  const daysParam = c.req.query('days');
  const all = daysParam === 'all';
  // 'all' = seluruh riwayat (since 0). Selain itu clamp 1..3650 hari.
  const days = all ? 0 : Math.min(Math.max(Number(daysParam) || 30, 1), 3650);
  const since = all ? 0 : Date.now() - days * 24 * 60 * 60 * 1000;

  if (pid) {
    const rows = await queryAll<{ captured_at: number; total_usd: number }>(
      c.env,
      'SELECT captured_at, total_usd FROM portfolio_snapshots WHERE portfolio_id = ? AND captured_at >= ? ORDER BY captured_at',
      Number(pid),
      since,
    );
    return ok(c, rows);
  }
  // Agregat: jumlahkan semua portofolio per captured_at.
  const rows = await queryAll<{ captured_at: number; total_usd: number }>(
    c.env,
    `SELECT captured_at, SUM(total_usd) AS total_usd FROM portfolio_snapshots
     WHERE captured_at >= ? GROUP BY captured_at ORDER BY captured_at`,
    since,
  );
  return ok(c, rows);
});

// Chart "what-if": nilai portofolio bila holdings SAAT INI dipegang sepanjang periode.
// Ambil jumlah aset terkini (overview cache) × harga historis harian (Binance klines).
// Berguna saat snapshot belum punya riwayat panjang (mis. baru deposit hari ini).
app.get('/asset-history', async (c) => {
  const daysParam = c.req.query('days');
  const all = daysParam === 'all';
  // interval harian; Binance klines max 1000 candle. 'all' = ambil sebanyak mungkin.
  const days = all ? 1000 : Math.min(Math.max(Number(daysParam) || 30, 1), 1000);

  const overview = (await getStoredOverview(c.env)) || (await refreshOverview(c.env));

  // Agregasi jumlah + nilai USD per aset (gabungan semua portofolio), sama seperti aggAssets() di UI.
  const amounts = new Map<string, number>();
  const usdValue = new Map<string, number>();
  for (const p of overview.portfolios) {
    for (const a of p.assets) {
      const amt = Number(a.amount);
      if (!isFinite(amt) || amt === 0) continue;
      const sym = a.asset.toUpperCase();
      amounts.set(sym, (amounts.get(sym) || 0) + amt);
      usdValue.set(sym, (usdValue.get(sym) || 0) + (Number(a.usd) || 0));
    }
  }

  // Crypto → butuh klines. Stable/fiat → dinilai konstan pada kurs USD terkini.
  // Worker punya batas subrequest (≈50/permintaan) & banyak dust token tak punya pair USDT —
  // jadi hanya ambil klines untuk crypto bernilai signifikan; dust diabaikan (kontribusi ~0).
  const MIN_CRYPTO_USD = 1;
  const cryptoAssets: string[] = [];
  const constAssets: string[] = [];
  for (const sym of amounts.keys()) {
    if (classifyAsset(sym) !== 'crypto') constAssets.push(sym);
    else if ((usdValue.get(sym) || 0) >= MIN_CRYPTO_USD) cryptoAssets.push(sym);
  }
  const constRates = constAssets.length ? await getUsdRates(c.env, constAssets) : {};

  const series = await Promise.all(
    cryptoAssets.map(async (sym) => ({ sym, m: new Map((await getDailyCloses(c.env, sym + 'USDT', days)).map((p) => [p.t, p.c])) })),
  );

  // Timeline = union semua tanggal kline yang tersedia.
  const daySet = new Set<number>();
  for (const s of series) for (const t of s.m.keys()) daySet.add(t);
  const timeline = [...daySet].sort((a, b) => a - b);

  // Nilai per hari: Σ(jumlah × harga). Harga di-carry-forward dari close terakhir yang diketahui
  // (sebelum aset pertama kali ada di Binance, kontribusinya 0). Stable/fiat konstan.
  const constUsd = constAssets.reduce((s, a) => s + (amounts.get(a) || 0) * (constRates[a] || 0), 0);
  const last: Record<string, number> = {};
  const rows = timeline.map((t) => {
    let total = constUsd;
    for (const s of series) {
      const close = s.m.get(t);
      if (close !== undefined) last[s.sym] = close;
      const price = last[s.sym];
      if (price !== undefined) total += (amounts.get(s.sym) || 0) * price;
    }
    return { captured_at: t, total_usd: total };
  });

  // Ringkasan harga per-aset: puncak harga di periode + harga terkini + jarak dari puncak.
  const allPeaks = series
    .map((s) => {
      let peak = 0, peakAt = 0, current = 0, currentAt = -1;
      for (const [t, close] of s.m) {
        if (close > peak) { peak = close; peakAt = t; }
        if (t >= currentAt) { current = close; currentAt = t; }
      }
      return {
        asset: s.sym,
        peak,
        peakAt,
        current,
        fromPeakPct: peak > 0 ? ((current - peak) / peak) * 100 : 0,
        usd: usdValue.get(s.sym) || 0,
      };
    })
    .filter((p) => p.peak > 0);

  // Tampilkan per-aset diurut nilai terbesar, dibatasi agar ringkas.
  // Total/highest/lowest gabungan dihitung di frontend dari `points` (kurva portofolio).
  const peaks = allPeaks.slice().sort((a, b) => b.usd - a.usd).slice(0, 6);

  return ok(c, { points: rows, peaks });
});

// Riwayat deposit dengan server-side pagination.
app.get('/deposits', async (c) => {
  const page  = Math.max(Number(c.req.query('page'))  || 1,  1);
  const limit = Math.min(Math.max(Number(c.req.query('limit')) || 25, 1), 100);
  const offset = (page - 1) * limit;

  const BASE_FROM = `FROM deposits d
     JOIN accounts a ON a.id = d.account_id
     JOIN portfolios p ON p.id = a.portfolio_id`;

  const [countRow, rows] = await Promise.all([
    queryOne<{ total: number }>(c.env, `SELECT COUNT(*) AS total ${BASE_FROM}`),
    queryAll(c.env,
      `SELECT d.id, d.asset, d.amount, d.network, d.address, d.status, d.ts,
              a.label AS account_label, a.type AS account_type, p.name AS portfolio_name
       ${BASE_FROM}
       ORDER BY d.ts DESC LIMIT ? OFFSET ?`,
      limit, offset,
    ),
  ]);

  const total = countRow?.total ?? 0;
  return ok(c, { data: rows, total, page, limit, pages: Math.ceil(total / limit) || 1 });
});

// Trigger sinkronisasi penuh secara manual.
app.post('/sync', async (c) => {
  const result = await syncAll(c.env);
  return ok(c, result);
});

export default app;
