// Browser renderer, bundled as WorthlyShare by build-frontend.mjs.
// Semua gambar dibuat prosedural di canvas (tanpa aset eksternal — aman CSP).
export function shareAssetList(data: any, options: any) {
  const rows = (data.assets || []).filter((a: any) => Number.isFinite(a.usd) &&
    (options.minDollar !== false ? a.usd >= 1 : (a.usd !== 0 || Number(a.amount) !== 0)));
  const order = options.order || 'value-desc';
  rows.sort((a: any, b: any) => {
    const name = String(a.asset).localeCompare(String(b.asset));
    if (order === 'name-asc') return name;
    if (order === 'name-desc') return -name;
    return (order === 'value-asc' ? a.usd - b.usd : b.usd - a.usd) || name;
  });
  // Keep type readable instead of squeezing the whole portfolio into one card.
  const perPage = options.size === 'story' ? 20 : options.size === 'landscape' ? 6 : 8;
  const pages = Math.max(1, Math.ceil(rows.length / perPage));
  const page = Math.min(Math.max(Math.floor(Number(options.page) || 1), 1), pages);
  const positiveTotal = (data.assets || []).reduce((sum: number, a: any) => sum + (Number.isFinite(a.usd) && a.usd > 0 ? a.usd : 0), 0);
  return { rows, pages, page, perPage, positiveTotal, visible: rows.slice((page - 1) * perPage, page * perPage) };
}

// ---------------------------------------------------------------------------
// Katalog opsi (dipakai UI Share Studio lewat WorthlyShare.*)
// ---------------------------------------------------------------------------
export const SHARE_TEMPLATES = [
  { id: 'overview', name: 'Overview', desc: 'Value + allocation' },
  { id: 'allocation', name: 'Allocation Only', desc: 'A private perspective' },
  { id: 'performance', name: 'Performance', desc: 'Your value journey' },
  { id: 'assets', name: 'All Assets', desc: 'Every holding, your way' },
  { id: 'movers', name: 'Movers 24h', desc: 'Best & worst today' },
  { id: 'returns', name: 'All-time Return', desc: 'Invested vs now' },
  { id: 'thennow', name: 'Then vs Now', desc: 'Start and end of period' },
  { id: 'composition', name: 'Source Composition', desc: 'CEX, on-chain, stocks…' },
  { id: 'spotlight', name: 'Asset Spotlight', desc: 'One asset, one story' },
  { id: 'milestone', name: 'Milestone', desc: 'Peak, threshold, streak' },
];
// Ukuran kanvas. `logical` = ukuran tata letak yang digambar; kanvas lain dipetakan ke sana
// (portrait = square + pita atas/bawah, wide = landscape diperkecil) agar posisi tetap konsisten.
export const SHARE_SIZES: Record<string, { w: number; h: number; name: string; logical: 'square' | 'story' | 'landscape' }> = {
  square: { w: 1080, h: 1080, name: 'Square · 1080 × 1080', logical: 'square' },
  portrait: { w: 1080, h: 1350, name: 'Portrait 4:5 · 1080 × 1350', logical: 'square' },
  story: { w: 1080, h: 1920, name: 'Story · 1080 × 1920', logical: 'story' },
  landscape: { w: 1600, h: 900, name: 'Landscape · 1600 × 900', logical: 'landscape' },
  wide: { w: 1200, h: 675, name: 'Wide 16:9 · 1200 × 675', logical: 'landscape' },
};
export const SHARE_ACCENTS: Record<string, { name: string; colors: string[] }> = {
  indigo: { name: 'Indigo', colors: ['#818cf8', '#2dd4bf', '#38bdf8', '#fbbf24', '#f472b6', '#94a3b8'] },
  teal: { name: 'Teal', colors: ['#2dd4bf', '#5eead4', '#22d3ee', '#a7f3d0', '#67e8f9', '#94a3b8'] },
  amber: { name: 'Amber', colors: ['#fbbf24', '#f59e0b', '#fb923c', '#fde68a', '#f97316', '#a8a29e'] },
  rose: { name: 'Rose', colors: ['#fb7185', '#f472b6', '#e879f9', '#fda4af', '#c084fc', '#a1a1aa'] },
  emerald: { name: 'Emerald', colors: ['#34d399', '#a3e635', '#2dd4bf', '#86efac', '#4ade80', '#94a3b8'] },
  mono: { name: 'Mono', colors: ['#e2e8f0', '#94a3b8', '#cbd5e1', '#64748b', '#f8fafc', '#475569'] },
};
export const SHARE_FONTS: Record<string, { name: string; family: string }> = {
  sans: { name: 'Sans', family: 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif' },
  serif: { name: 'Serif', family: 'Georgia, "Times New Roman", "Noto Serif", serif' },
  mono: { name: 'Mono', family: 'ui-monospace, Menlo, Consolas, "Liberation Mono", monospace' },
};
export const SHARE_FRAMES = [
  { id: 'none', name: 'None' },
  { id: 'rounded', name: 'Rounded' },
  { id: 'border', name: 'Border' },
  { id: 'glass', name: 'Glass' },
];
export const SHARE_AMOUNT_MODES = [
  { id: 'hidden', name: 'Hidden' },
  { id: 'blur', name: 'Blurred' },
  { id: 'rounded', name: 'Rounded (≈ $35k)' },
  { id: 'exact', name: 'Exact' },
];
// ---------------------------------------------------------------------------
// Background presets — digambar prosedural di canvas (tanpa aset eksternal, aman CSP).
// Tiap preset punya varian dark/light mengikuti pilihan Theme. `swatch` = CSS untuk
// pratinjau kecil di Share Studio.
// ---------------------------------------------------------------------------
type Ctx = CanvasRenderingContext2D;
interface Background {
  id: string;
  name: string;
  swatch: { dark: string; light: string };
  paint: (ctx: Ctx, w: number, h: number, light: boolean) => void;
}

function linear(ctx: Ctx, w: number, h: number, stops: string[], angle: 'diag' | 'down' = 'diag') {
  const g = angle === 'diag' ? ctx.createLinearGradient(0, 0, w, h) : ctx.createLinearGradient(0, 0, 0, h);
  stops.forEach((c, i) => g.addColorStop(i / (stops.length - 1), c));
  ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
}
/** Blob radial lembut (mesh gradient). fx/fy = posisi relatif 0..1, r = radius relatif ke sisi terpanjang. */
function blob(ctx: Ctx, w: number, h: number, fx: number, fy: number, r: number, color: string) {
  const R = Math.max(w, h) * r;
  const g = ctx.createRadialGradient(w * fx, h * fy, 0, w * fx, h * fy, R);
  g.addColorStop(0, color); g.addColorStop(1, color.slice(0, 7) + '00');
  ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
}
function grid(ctx: Ctx, w: number, h: number, step: number, color: string) {
  ctx.strokeStyle = color; ctx.lineWidth = 1; ctx.beginPath();
  for (let x = step; x < w; x += step) { ctx.moveTo(x, 0); ctx.lineTo(x, h); }
  for (let y = step; y < h; y += step) { ctx.moveTo(0, y); ctx.lineTo(w, y); }
  ctx.stroke();
}
function dots(ctx: Ctx, w: number, h: number, step: number, radius: number, color: string) {
  ctx.fillStyle = color;
  for (let x = step / 2; x < w; x += step) for (let y = step / 2; y < h; y += step) { ctx.beginPath(); ctx.arc(x, y, radius, 0, Math.PI * 2); ctx.fill(); }
}
function waves(ctx: Ctx, w: number, h: number, colors: string[]) {
  colors.forEach((c, i) => {
    const base = h * (0.62 + i * 0.1), amp = h * 0.04, freq = (Math.PI * 2 * (1.2 + i * 0.4)) / w, phase = i * 1.7;
    ctx.beginPath(); ctx.moveTo(0, h);
    for (let x = 0; x <= w; x += 8) ctx.lineTo(x, base + Math.sin(x * freq + phase) * amp);
    ctx.lineTo(w, h); ctx.closePath(); ctx.fillStyle = c; ctx.fill();
  });
}
/** Butiran halus: tile noise 128px dijadikan pattern (murah, tidak per-piksel penuh). */
function grain(ctx: Ctx, w: number, h: number, alpha: number, light: boolean) {
  const tile = document.createElement('canvas'); tile.width = tile.height = 128;
  const tc = tile.getContext('2d'); if (!tc) return;
  const img = tc.createImageData(128, 128); const v = light ? 15 : 255;
  let seed = 7;
  for (let i = 0; i < img.data.length; i += 4) {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff; // LCG deterministik agar preview == PNG
    const a = (seed >> 8) % 256;
    img.data[i] = v; img.data[i + 1] = v; img.data[i + 2] = v; img.data[i + 3] = a;
  }
  tc.putImageData(img, 0, 0);
  const pat = ctx.createPattern(tile, 'repeat'); if (!pat) return;
  ctx.save(); ctx.globalAlpha = alpha; ctx.fillStyle = pat; ctx.fillRect(0, 0, w, h); ctx.restore();
}
const faint = (light: boolean, a: number) => (light ? 'rgba(15,23,42,' : 'rgba(255,255,255,') + a + ')';

export const SHARE_BACKGROUNDS: Background[] = [
  { id: 'classic', name: 'Classic', swatch: { dark: 'linear-gradient(135deg,#101a31,#1c1640)', light: 'linear-gradient(135deg,#f8fafc,#e0e7ff)' },
    paint: (c, w, h, l) => linear(c, w, h, l ? ['#f8fafc', '#e0e7ff'] : ['#101a31', '#1c1640']) },
  { id: 'aurora', name: 'Aurora', swatch: { dark: 'radial-gradient(at 20% 20%,#4f46e5 0,transparent 55%),radial-gradient(at 80% 30%,#0d9488 0,transparent 50%),radial-gradient(at 60% 90%,#db2777 0,transparent 50%),#0b1020', light: 'radial-gradient(at 20% 20%,#c7d2fe 0,transparent 55%),radial-gradient(at 80% 30%,#99f6e4 0,transparent 50%),radial-gradient(at 60% 90%,#fbcfe8 0,transparent 50%),#f8fafc' },
    paint: (c, w, h, l) => { linear(c, w, h, l ? ['#f8fafc', '#f1f5f9'] : ['#0b1020', '#0f172a']);
      blob(c, w, h, 0.2, 0.2, 0.55, l ? '#c7d2feee' : '#4f46e5aa'); blob(c, w, h, 0.85, 0.3, 0.5, l ? '#99f6e4dd' : '#0d948888'); blob(c, w, h, 0.6, 0.9, 0.5, l ? '#fbcfe8dd' : '#db277777'); } },
  { id: 'sunset', name: 'Sunset', swatch: { dark: 'linear-gradient(160deg,#2a0f2e,#5b1a3a 55%,#9a3412)', light: 'linear-gradient(160deg,#fff7ed,#fce7f3 60%,#fde68a)' },
    paint: (c, w, h, l) => { linear(c, w, h, l ? ['#fff7ed', '#fce7f3', '#fde68a'] : ['#2a0f2e', '#5b1a3a', '#9a3412'], 'down');
      blob(c, w, h, 0.5, 1.1, 0.5, l ? '#fdba74cc' : '#f9731666'); } },
  { id: 'ocean', name: 'Ocean', swatch: { dark: 'linear-gradient(135deg,#0c1a3a,#0e4a6b,#0d9488)', light: 'linear-gradient(135deg,#eff6ff,#cffafe,#ccfbf1)' },
    paint: (c, w, h, l) => { linear(c, w, h, l ? ['#eff6ff', '#cffafe', '#ccfbf1'] : ['#0c1a3a', '#0e4a6b', '#0d9488']);
      blob(c, w, h, 0.15, 0.85, 0.45, l ? '#bae6fdcc' : '#38bdf855'); } },
  { id: 'emerald', name: 'Emerald', swatch: { dark: 'linear-gradient(135deg,#052e16,#064e3b,#14532d)', light: 'linear-gradient(135deg,#f0fdf4,#d1fae5,#ecfccb)' },
    paint: (c, w, h, l) => { linear(c, w, h, l ? ['#f0fdf4', '#d1fae5', '#ecfccb'] : ['#052e16', '#064e3b', '#14532d']);
      blob(c, w, h, 0.8, 0.15, 0.5, l ? '#a7f3d0cc' : '#34d39944'); } },
  { id: 'mono', name: 'Mono', swatch: { dark: '#0b0f19', light: '#ffffff' },
    paint: (c, w, h, l) => { c.fillStyle = l ? '#ffffff' : '#0b0f19'; c.fillRect(0, 0, w, h); } },
  { id: 'grid', name: 'Grid', swatch: { dark: 'linear-gradient(rgba(255,255,255,.08) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.08) 1px,transparent 1px),#0f172a', light: 'linear-gradient(rgba(15,23,42,.08) 1px,transparent 1px),linear-gradient(90deg,rgba(15,23,42,.08) 1px,transparent 1px),#f8fafc' },
    paint: (c, w, h, l) => { linear(c, w, h, l ? ['#f8fafc', '#eef2ff'] : ['#0f172a', '#111a33']); grid(c, w, h, 60, faint(l, 0.07));
      blob(c, w, h, 0.5, 0.5, 0.7, l ? '#ffffff88' : '#0f172a99'); } },
  { id: 'dots', name: 'Dots', swatch: { dark: 'radial-gradient(rgba(255,255,255,.18) 1px,transparent 1.5px) 0 0/10px 10px,#111827', light: 'radial-gradient(rgba(15,23,42,.18) 1px,transparent 1.5px) 0 0/10px 10px,#f8fafc' },
    paint: (c, w, h, l) => { linear(c, w, h, l ? ['#f8fafc', '#f1f5f9'] : ['#111827', '#0f172a']); dots(c, w, h, 36, 2, faint(l, 0.12)); } },
  { id: 'waves', name: 'Waves', swatch: { dark: 'linear-gradient(#0f172a 55%,#312e81 70%,#4338ca 85%,#6366f1)', light: 'linear-gradient(#f8fafc 55%,#e0e7ff 70%,#c7d2fe 85%,#a5b4fc)' },
    paint: (c, w, h, l) => { linear(c, w, h, l ? ['#f8fafc', '#f1f5f9'] : ['#0f172a', '#0b1020'], 'down');
      waves(c, w, h, l ? ['#e0e7ff', '#c7d2fe', '#a5b4fc'] : ['#312e81', '#4338ca', '#6366f1']); } },
  { id: 'grain', name: 'Grain', swatch: { dark: 'linear-gradient(135deg,#1e1b4b,#0f172a)', light: 'linear-gradient(135deg,#eef2ff,#f8fafc)' },
    paint: (c, w, h, l) => { linear(c, w, h, l ? ['#eef2ff', '#f8fafc'] : ['#1e1b4b', '#0f172a']); blob(c, w, h, 0.3, 0.25, 0.6, l ? '#c7d2fe99' : '#6366f166'); grain(c, w, h, l ? 0.16 : 0.2, l); } },
];

export function paintBackground(ctx: Ctx, w: number, h: number, light: boolean, id?: string) {
  const bg = SHARE_BACKGROUNDS.find((b) => b.id === id) || SHARE_BACKGROUNDS[0];
  bg.paint(ctx, w, h, light);
}

// ---------------------------------------------------------------------------
// Helper data untuk layout baru
// ---------------------------------------------------------------------------
/** Aset tergabung per simbol (aset tetap tetap per-entri), hanya nilai positif. */
function positiveAssets(data: any) {
  return (data.assets || []).filter((a: any) => Number.isFinite(a.usd) && a.usd > 0);
}
/** Movers 24 jam dari map assetChange (simbol -> %). Aset tetap tak punya harga harian. */
export function shareMovers(data: any) {
  const chg = data.assetChange || {};
  const rows = positiveAssets(data)
    .filter((a: any) => a.origin !== 'asset' && chg[a.asset] !== undefined && chg[a.asset] !== null && Number.isFinite(Number(chg[a.asset])))
    .map((a: any) => ({ asset: a.asset, usd: a.usd, pct: Number(chg[a.asset]) }));
  const sorted = rows.slice().sort((p: any, q: any) => q.pct - p.pct);
  return { best: sorted.filter((x: any) => x.pct > 0).slice(0, 3), worst: sorted.filter((x: any) => x.pct < 0).slice(-3).reverse() };
}
/** Komposisi per sumber (USD) dari origin tiap aset. */
export function shareComposition(data: any) {
  const m: Record<string, number> = { cex: 0, onchain: 0, stock: 0, asset: 0, manual: 0 };
  for (const a of positiveAssets(data)) if (m[a.origin] !== undefined) m[a.origin] += a.usd;
  const total = Object.values(m).reduce((s, v) => s + v, 0);
  const labels: Record<string, string> = { cex: 'Exchange (CEX)', onchain: 'On-chain', stock: 'IDX Stocks', asset: 'Fixed Assets', manual: 'Manual' };
  return { total, rows: Object.keys(m).map((k) => ({ key: k, label: labels[k], usd: m[k], pct: total > 0 ? (m[k] / total) * 100 : 0 })).filter((r) => r.usd > 0) };
}
/** Ambang "bulat" untuk milestone: 1k, 2k, 5k, 10k, 20k, 50k, ... */
function thresholdsUpTo(v: number): number[] {
  const out: number[] = [];
  for (let base = 1000; base <= v; base *= 10) for (const m of [1, 2, 5]) if (base * m <= v) out.push(base * m);
  return out;
}
export function shareMilestone(data: any) {
  const pts = (data.history || []).filter((p: any) => Number.isFinite(p.total_usd) && Number.isFinite(p.captured_at)).sort((a: any, b: any) => a.captured_at - b.captured_at);
  if (!pts.length) return null;
  const end = pts[pts.length - 1];
  let peak = pts[0];
  for (const p of pts) if (p.total_usd > peak.total_usd) peak = p;
  const th = thresholdsUpTo(end.total_usd);
  const threshold = th.length ? th[th.length - 1] : 0;
  const crossed = threshold ? pts.find((p: any) => p.total_usd >= threshold) : null;
  const days = Math.max(1, Math.round((end.captured_at - pts[0].captured_at) / 86400000) + 1);
  return { peak, threshold, crossedAt: crossed ? crossed.captured_at : null, days, since: pts[0].captured_at, end };
}

// ---------------------------------------------------------------------------
// Ekspor: ZIP (store, tanpa kompresi) dan penyambung halaman vertikal
// ---------------------------------------------------------------------------
const CRC_TABLE = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
function crc32(buf: Uint8Array): number { let c = 0xffffffff; for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; }
/** Bangun arsip ZIP dari daftar file (metode store). Cukup untuk beberapa PNG. */
export function makeZip(files: { name: string; data: Uint8Array }[]): Blob {
  const enc = new TextEncoder();
  const parts: Uint8Array[] = []; const central: Uint8Array[] = [];
  let offset = 0;
  const now = new Date();
  const dosTime = ((now.getHours() << 11) | (now.getMinutes() << 5) | (now.getSeconds() >> 1)) & 0xffff;
  const dosDate = (((now.getFullYear() - 1980) << 9) | ((now.getMonth() + 1) << 5) | now.getDate()) & 0xffff;
  const u16 = (v: number) => [v & 0xff, (v >>> 8) & 0xff];
  const u32 = (v: number) => [v & 0xff, (v >>> 8) & 0xff, (v >>> 16) & 0xff, (v >>> 24) & 0xff];
  for (const f of files) {
    const name = enc.encode(f.name); const crc = crc32(f.data);
    const local = new Uint8Array([...u32(0x04034b50), ...u16(20), ...u16(0x0800), ...u16(0), ...u16(dosTime), ...u16(dosDate), ...u32(crc), ...u32(f.data.length), ...u32(f.data.length), ...u16(name.length), ...u16(0), ...name]);
    parts.push(local, f.data);
    central.push(new Uint8Array([...u32(0x02014b50), ...u16(20), ...u16(20), ...u16(0x0800), ...u16(0), ...u16(dosTime), ...u16(dosDate), ...u32(crc), ...u32(f.data.length), ...u32(f.data.length), ...u16(name.length), ...u16(0), ...u16(0), ...u16(0), ...u16(0), ...u32(0), ...u32(offset), ...name]));
    offset += local.length + f.data.length;
  }
  const cdSize = central.reduce((s, c) => s + c.length, 0);
  const eocd = new Uint8Array([...u32(0x06054b50), ...u16(0), ...u16(0), ...u16(files.length), ...u16(files.length), ...u32(cdSize), ...u32(offset), ...u16(0)]);
  return new Blob([...parts, ...central, eocd] as BlobPart[], { type: 'application/zip' });
}
/** Sambung beberapa kanvas secara vertikal (untuk "semua halaman" jadi satu PNG panjang). */
export function stitchVertical(canvases: HTMLCanvasElement[], gap = 24, bg = '#0b1020'): HTMLCanvasElement {
  const out = document.createElement('canvas');
  const w = Math.max(...canvases.map((c) => c.width));
  out.width = w; out.height = canvases.reduce((s, c) => s + c.height, 0) + gap * (canvases.length - 1);
  const ctx = out.getContext('2d')!; ctx.fillStyle = bg; ctx.fillRect(0, 0, out.width, out.height);
  let y = 0;
  for (const c of canvases) { ctx.drawImage(c, Math.floor((w - c.width) / 2), y); y += c.height + gap; }
  return out;
}

// ---------------------------------------------------------------------------
// Renderer utama
// ---------------------------------------------------------------------------
const DEFAULT_TITLES: Record<string, string> = {
  overview: 'The bigger picture.', allocation: 'How it is allocated.', performance: 'A view of the journey.', assets: 'Everything I hold.',
  movers: 'What moved today.', returns: 'The long game.', thennow: 'Then and now.', composition: 'Where it lives.', spotlight: 'One to watch.', milestone: 'A milestone.',
};

export function renderShareCard(canvas: HTMLCanvasElement, data: any, options: any) {
  const sizeDef = SHARE_SIZES[options.size] || SHARE_SIZES.square;
  const W = sizeDef.w, H = sizeDef.h;
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas is unavailable');
  const light = options.theme === 'light';
  const ink = light ? '#15233c' : '#f1f5ff';
  const muted = light ? '#5e6e86' : '#a3b3d0';
  const accent = SHARE_ACCENTS[options.accent] || SHARE_ACCENTS.indigo;
  const colors = accent.colors;
  const family = (SHARE_FONTS[options.font] || SHARE_FONTS.sans).family;
  const lineColor = light ? '#cbd5e1' : '#303b59';
  const up = light ? '#047857' : '#5eead4', down = light ? '#be123c' : '#fda4af';
  const frame = options.frame || 'none';

  // ---- latar + bingkai (koordinat kanvas asli) ----
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, W, H);
  ctx.save();
  if (frame === 'rounded') { const m = 36, r = 56; ctx.beginPath(); ctx.roundRect(m, m, W - m * 2, H - m * 2, r); ctx.clip(); }
  paintBackground(ctx, W, H, light, options.background);
  if (frame === 'border') { ctx.strokeStyle = light ? '#15233c' : '#f1f5ff'; ctx.lineWidth = 14; ctx.strokeRect(22, 22, W - 44, H - 44); }
  if (frame === 'glass') {
    const m = 40; ctx.beginPath(); ctx.roundRect(m, m, W - m * 2, H - m * 2, 40);
    ctx.fillStyle = light ? 'rgba(255,255,255,0.55)' : 'rgba(15,23,42,0.45)'; ctx.fill();
    ctx.strokeStyle = light ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.18)'; ctx.lineWidth = 2; ctx.stroke();
  }

  // ---- pemetaan ke tata letak logis ----
  if (frame === 'none') { ctx.strokeStyle = lineColor; ctx.lineWidth = 1; ctx.strokeRect(28, 28, W - 56, H - 56); }
  const logical = sizeDef.logical;
  const [w, h] = logical === 'story' ? [1080, 1920] : logical === 'landscape' ? [1600, 900] : [1080, 1080];
  if (options.size === 'portrait') ctx.translate(0, (H - h) / 2);
  else if (options.size === 'wide') ctx.scale(W / w, H / h);

  const pad = 76, inner = w - pad * 2;
  const wide = w > h, story = h > w;
  function text(value: string, x: number, y: number, size = 26, color = ink, align: CanvasTextAlign = 'left', max = inner, blur = false) {
    ctx!.font = '500 ' + size + 'px ' + family;
    ctx!.fillStyle = color; ctx!.textAlign = align;
    let clipped = String(value);
    while (ctx!.measureText(clipped).width > max && clipped.length > 1) clipped = clipped.slice(0, -2) + '…';
    if (blur) { ctx!.save(); ctx!.filter = 'blur(7px)'; ctx!.fillText(clipped, x, y); ctx!.restore(); }
    else ctx!.fillText(clipped, x, y);
  }
  const date = (ts: number) => new Date(ts).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

  // ---- nominal: hidden | blur | rounded | exact (kompatibel dengan `amounts` boolean lama) ----
  const mode: string = options.amountMode || (options.amounts ? 'exact' : 'hidden');
  const showMoney = mode !== 'hidden';
  const blurMoney = mode === 'blur';
  const toDisplay = (usd: number) => usd * (data.currency === 'IDR' ? data.idrRate : 1);
  const money = (usd: number) => {
    if (!showMoney) return 'Amounts hidden';
    if (data.currency === 'IDR' && !(data.idrRate > 0)) return 'IDR rate unavailable';
    const v = toDisplay(usd);
    if (mode === 'rounded') return '≈ ' + new Intl.NumberFormat('en-US', { style: 'currency', currency: data.currency, notation: 'compact', maximumSignificantDigits: 2 }).format(v);
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: data.currency, maximumFractionDigits: 0 }).format(v);
  };
  const signed = (v: number, digits = 2) => (v >= 0 ? '+' : '') + v.toFixed(digits) + '%';

  // ---- header ----
  const handle = String(options.handle || '').trim();
  let hx = pad;
  if (options.avatar && options.avatar.width) {
    const r = 22; ctx.save(); ctx.beginPath(); ctx.arc(pad + r, 96, r, 0, Math.PI * 2); ctx.clip();
    ctx.drawImage(options.avatar, pad, 96 - r, r * 2, r * 2); ctx.restore(); hx = pad + r * 2 + 14;
  }
  text(handle ? handle.toUpperCase() : 'W / WORTHLY', hx, 105, 24, muted);
  text(date(data.asOf), w - pad, 105, 23, muted, 'right');
  const title = String(options.title || '').trim() || DEFAULT_TITLES[options.template] || DEFAULT_TITLES.overview;
  text(title, pad, 194, 51);
  const caption = String(options.caption || '').trim();
  if (data.portfolioName) text(String(data.portfolioName).toUpperCase(), w - pad, 160, 20, muted, 'right', inner / 2);

  const rows = positiveAssets(data);
  const total = rows.reduce((s: number, a: any) => s + a.usd, 0);
  const top = rows.slice(0, 5).map((a: any, i: number) => ({ ...a, label: options.names ? a.asset : 'Asset ' + (i + 1) }));
  if (rows.length > 5) top.push({ label: 'Others', usd: rows.slice(5).reduce((s: number, a: any) => s + a.usd, 0) });
  const nameOf = (asset: string, i: number) => (options.names ? asset : 'Asset ' + (i + 1));
  const hline = (y: number) => { ctx.strokeStyle = lineColor; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(pad, y); ctx.lineTo(w - pad, y); ctx.stroke(); };
  let note = '';

  if (options.template === 'assets') {
    const list = shareAssetList(data, options);
    const percent = options.percentages !== false;
    const qty = !!options.quantities;
    const value = showMoney;
    text(list.rows.length + ' holdings · ' + (options.minDollar !== false ? 'Value ≥ US$1' : 'All nonzero holdings'), pad, 255, 26, muted);
    text('PAGE ' + list.page + ' / ' + list.pages, w - pad, 300, 21, muted, 'right');
    const columnCount = Number(qty) + Number(value) + Number(percent);
    const nameWidth = columnCount ? inner * 0.35 : inner;
    const cellWidth = columnCount ? (inner - nameWidth) / columnCount : 0;
    const columns: { label: string; field: string }[] = [];
    if (qty) columns.push({ label: 'AMOUNT', field: 'amount' });
    if (value) columns.push({ label: 'VALUE', field: 'value' });
    if (percent) columns.push({ label: 'SHARE', field: 'percent' });
    text('ASSET', pad, 350, 20, muted);
    columns.forEach((c, i) => text(c.label, pad + nameWidth + cellWidth * (i + 1), 350, 20, muted, 'right', cellWidth - 18));
    if (!list.rows.length) text('No assets match this filter.', pad, 450, 30, muted);
    list.visible.forEach((a: any, i: number) => {
      const y = 405 + i * 70;
      const index = (list.page - 1) * list.perPage + i;
      ctx.fillStyle = colors[index % colors.length]; ctx.fillRect(pad, y - 22, 4, 29);
      text(nameOf(a.asset, index), pad + 20, y, 26, ink, 'left', nameWidth - 36);
      columns.forEach((c, ci) => {
        let content = '—'; let blur = false;
        if (c.field === 'amount' && Number.isFinite(a.amount)) {
          content = a.amount.toLocaleString('en-US', { maximumSignificantDigits: 8 });
          if (a.origin === 'asset' && a.currency) content += ' ' + a.currency;
        }
        if (c.field === 'value') { content = money(a.usd); blur = blurMoney; }
        if (c.field === 'percent' && a.usd >= 0 && list.positiveTotal > 0) content = (a.usd / list.positiveTotal * 100).toFixed(2) + '%';
        text(content, pad + nameWidth + cellWidth * (ci + 1), y, 24, ink, 'right', cellWidth - 18, blur);
      });
      hline(y + 25);
    });
    note = percent ? 'Share = % of all positive holdings, before the filter.' : 'Holdings at the date shown above.';
  } else if (options.template === 'performance' || options.template === 'thennow') {
    const points = (data.history || []).filter((p: any) => Number.isFinite(p.total_usd) && Number.isFinite(p.captured_at)).sort((a: any, b: any) => a.captured_at - b.captured_at);
    const simulated = data.mode === 'holdings';
    const relative = !!options.relative;
    text((simulated ? 'SIMULATED HOLDINGS · ' : 'RECORDED VALUE · ') + data.period + (relative ? ' · INDEXED TO 100' : ''), pad, 250, 24, muted);
    if (points.length < 2) {
      text('Not enough history yet', pad, h / 2, 40);
      text('Choose another period or wait for more snapshots.', pad, h / 2 + 55, 25, muted);
    } else {
      const start = points[0].total_usd, end = points[points.length - 1].total_usd;
      const change = start > 0 ? (end - start) / start * 100 : null;
      const accentColor = end >= start ? up : down;
      const idx = (v: number) => (start > 0 ? (v / start * 100).toFixed(1) : '—');
      const val = (v: number) => (relative ? idx(v) : money(v));
      if (options.template === 'performance') {
        text(change === null ? 'Change unavailable' : signed(change), pad, 350, 76, accentColor);
        text('Portfolio value change · may include cash flows', pad, 400, 24, muted);
        const x = pad, y = story ? 560 : 470, cw = inner, ch = story ? 780 : h - 680;
        const values = points.map((p: any) => p.total_usd);
        let min = Math.min(...values), max = Math.max(...values);
        const range = max - min || Math.max(Math.abs(max) * 0.1, 1);
        min -= range * 0.08; max += range * 0.08;
        const t0 = points[0].captured_at, span = points[points.length - 1].captured_at - t0 || 1;
        const xy = points.map((p: any) => [x + (p.captured_at - t0) / span * cw, y + ch - (p.total_usd - min) / (max - min) * ch]);
        ctx.strokeStyle = light ? '#cbd5e1' : '#33405e'; ctx.lineWidth = 1;
        for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.moveTo(x, y + ch * i / 3); ctx.lineTo(x + cw, y + ch * i / 3); ctx.stroke(); }
        ctx.beginPath(); xy.forEach((p: number[], i: number) => i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]));
        ctx.strokeStyle = accentColor; ctx.lineWidth = 5; ctx.stroke();
        ctx.lineTo(x + cw, y + ch); ctx.lineTo(x, y + ch); ctx.closePath();
        const fill = ctx.createLinearGradient(0, y, 0, y + ch); fill.addColorStop(0, colors[0] + '60'); fill.addColorStop(1, colors[0] + '00'); ctx.fillStyle = fill; ctx.fill();
        text(date(t0), pad, y + ch + 45, 24, muted);
        text(date(points[points.length - 1].captured_at), w - pad, y + ch + 45, 24, muted, 'right');
        if (relative || showMoney) text('Start ' + val(start) + '  /  End ' + val(end), pad, y + ch + 92, 26, ink, 'left', inner, blurMoney && !relative);
      } else {
        // Then vs Now: dua kolom besar + delta
        const colW = wide ? inner / 2 - 40 : inner;
        const y1 = wide ? 430 : story ? 520 : 400;
        const y2 = wide ? 430 : story ? 900 : 640;
        const big = wide ? 56 : story ? 64 : 52;
        text('THEN · ' + date(points[0].captured_at), pad, y1 - 60, 22, muted);
        text(val(start), pad, y1, big, ink, 'left', colW, blurMoney && !relative);
        const x2 = wide ? pad + inner / 2 + 40 : pad;
        text('NOW · ' + date(points[points.length - 1].captured_at), x2, y2 - 60, 22, muted);
        text(val(end), x2, y2, big, ink, 'left', colW, blurMoney && !relative);
        const dy = wide ? 620 : story ? 1180 : 820;
        text(change === null ? '—' : (end >= start ? '▲ ' : '▼ ') + signed(Math.abs(change)).replace('+', ''), pad, dy, 72, accentColor);
        text('over ' + data.period + (simulated ? ' · simulated holdings' : '') + ' · may include cash flows', pad, dy + 44, 24, muted);
      }
    }
    note = simulated ? 'Simulation, not actual past balances.' : 'Snapshots, not investment returns.';
  } else if (options.template === 'movers') {
    const mv = shareMovers(data);
    text('24H CHANGE · HELD ASSETS', pad, 250, 24, muted);
    const col = (label: string, list: any[], x: number, y0: number, colW: number, color: string) => {
      text(label, x, y0, 22, muted);
      if (!list.length) text('—', x, y0 + 60, 30, muted);
      list.forEach((m, i) => {
        const y = y0 + 70 + i * (story ? 110 : 84);
        text(nameOf(m.asset, rows.findIndex((r: any) => r.asset === m.asset)), x, y, 30, ink, 'left', colW - 170);
        text(signed(m.pct), x + colW, y, 34, color, 'right');
        if (showMoney) text(money(m.usd), x, y + 30, 20, muted, 'left', colW, blurMoney);
        hline(y + 48);
      });
    };
    if (wide) { col('TOP GAINERS', mv.best, pad, 330, inner / 2 - 40, up); col('TOP LOSERS', mv.worst, pad + inner / 2 + 40, 330, inner / 2 - 40, down); }
    else { col('TOP GAINERS', mv.best, pad, 330, inner, up); col('TOP LOSERS', mv.worst, pad, story ? 800 : 660, inner, down); }
    note = 'Daily change from exchange prices; fixed assets excluded.';
  } else if (options.template === 'returns') {
    const r = data.returns;
    if (!r || !(r.costBasis > 0)) { text('Return data unavailable', pad, h / 2, 40); text('Deposits or holdings are needed to estimate invested capital.', pad, h / 2 + 55, 24, muted); }
    else {
      const pct = Number(r.pct); const col = r.abs >= 0 ? up : down;
      text('ALL-TIME RETURN' + (r.earliestTs ? ' · SINCE ' + date(r.earliestTs).toUpperCase() : ''), pad, 250, 24, muted);
      text(Number.isFinite(pct) ? signed(pct) : '—', pad, story ? 420 : 360, story ? 110 : 96, col);
      text((r.abs >= 0 ? '+' : '−') + money(Math.abs(r.abs)), pad, story ? 480 : 415, 34, ink, 'left', inner, blurMoney);
      const y0 = story ? 640 : wide ? 540 : 560;
      const items = [['Invested', money(r.costBasis)], ['Current value', money(r.currentValue)], ['Priced items', (r.pricedItems ?? 0) + ' / ' + (r.totalItems ?? 0)]];
      items.forEach(([k, v], i) => { const y = y0 + i * 80; text(k, pad, y, 24, muted); text(v, w - pad, y, 30, ink, 'right', inner / 2, blurMoney && i < 2); hline(y + 26); });
      if (r.unpricedAssets && r.unpricedAssets.length) text('Unpriced: ' + r.unpricedAssets.slice(0, 6).join(', '), pad, y0 + items.length * 80 + 10, 20, muted);
    }
    note = 'Invested = deposits + holdings at entry date; withdrawals not deducted.';
  } else if (options.template === 'composition') {
    const c = shareComposition(data);
    text(showMoney ? money(c.total) : 'BY SOURCE', pad, 260, showMoney ? 48 : 24, showMoney ? ink : muted, 'left', inner, blurMoney);
    const y0 = story ? 420 : 350, gap = story ? 120 : wide ? 88 : 100, barH = 18;
    const keyColor: Record<string, string> = { cex: colors[0], onchain: colors[1], stock: colors[4], asset: colors[2], manual: colors[3] };
    if (!c.rows.length) text('No positive holdings to display', pad, y0, 26, muted);
    c.rows.forEach((r, i) => {
      const y = y0 + i * gap;
      text(r.label, pad, y, 26, ink);
      text(r.pct.toFixed(1) + '%', w - pad, y, 26, ink, 'right');
      if (showMoney) text(money(r.usd), w - pad, y + 30, 20, muted, 'right', inner / 2, blurMoney);
      ctx.fillStyle = lineColor; ctx.fillRect(pad, y + 16, inner, barH);
      ctx.fillStyle = keyColor[r.key] || colors[5]; ctx.fillRect(pad, y + 16, inner * r.pct / 100, barH);
    });
    note = 'Share of positive holdings by data source.';
  } else if (options.template === 'spotlight') {
    const sp = data.spotlight;
    const a = sp ? rows.find((r: any) => r.asset === sp.asset) : null;
    if (!sp || !a) { text('Pick an asset to spotlight', pad, h / 2, 40); text('Choose one in Share Studio.', pad, h / 2 + 55, 25, muted); }
    else {
      const i = rows.findIndex((r: any) => r.asset === sp.asset);
      const chg = data.assetChange && data.assetChange[a.asset];
      text(nameOf(a.asset, i), pad, story ? 330 : 300, 72, ink, 'left', inner);
      text((a.usd / total * 100).toFixed(1) + '% of portfolio' + (showMoney ? ' · ' + money(a.usd) : ''), pad, story ? 380 : 345, 26, muted, 'left', inner, false);
      if (options.quantities && Number.isFinite(a.amount)) text(a.amount.toLocaleString('en-US', { maximumSignificantDigits: 8 }) + (a.origin === 'asset' && a.currency ? ' ' + a.currency : ' units'), pad, story ? 420 : 385, 24, muted);
      if (chg !== undefined && chg !== null) text(signed(Number(chg)) + ' today', w - pad, story ? 330 : 300, 40, Number(chg) >= 0 ? up : down, 'right', inner / 2);
      const candles = (sp.candles || []).filter((k: any) => Number.isFinite(k.c));
      const x = pad, y = story ? 560 : 470, cw = inner, ch = story ? 700 : h - 700;
      if (candles.length < 2) text(a.origin === 'asset' ? 'Fixed asset — no market price history.' : 'No price history available.', pad, y + ch / 2, 26, muted);
      else {
        const vals = candles.map((k: any) => k.c); let min = Math.min(...vals), max = Math.max(...vals);
        const range = max - min || Math.max(Math.abs(max) * 0.1, 1); min -= range * 0.08; max += range * 0.08;
        const col = vals[vals.length - 1] >= vals[0] ? up : down;
        ctx.beginPath(); candles.forEach((k: any, j: number) => { const px = x + j / (candles.length - 1) * cw, py = y + ch - (k.c - min) / (max - min) * ch; j ? ctx.lineTo(px, py) : ctx.moveTo(px, py); });
        ctx.strokeStyle = col; ctx.lineWidth = 5; ctx.stroke();
        ctx.lineTo(x + cw, y + ch); ctx.lineTo(x, y + ch); ctx.closePath();
        const fill = ctx.createLinearGradient(0, y, 0, y + ch); fill.addColorStop(0, col + '55'); fill.addColorStop(1, col + '00'); ctx.fillStyle = fill; ctx.fill();
        const pchg = vals[0] > 0 ? (vals[vals.length - 1] - vals[0]) / vals[0] * 100 : null;
        text('PRICE · ' + (sp.period || '1M') + (pchg === null ? '' : ' · ' + signed(pchg)), pad, y - 20, 22, muted);
        text(date(candles[0].t), pad, y + ch + 40, 22, muted); text(date(candles[candles.length - 1].t), w - pad, y + ch + 40, 22, muted, 'right');
      }
    }
    note = 'Price from exchange data; share = % of positive holdings.';
  } else if (options.template === 'milestone') {
    const m = shareMilestone(data);
    if (!m) { text('No history yet', pad, h / 2, 40); text('Milestones appear once snapshots exist.', pad, h / 2 + 55, 25, muted); }
    else {
      text('DAY ' + m.days + ' OF TRACKING · SINCE ' + date(m.since).toUpperCase(), pad, 250, 24, muted);
      const y0 = story ? 400 : 340;
      if (m.threshold && showMoney) {
        text('Crossed ' + money(m.threshold), pad, y0, story ? 64 : 54, up, 'left', inner, blurMoney);
        text(m.crossedAt ? 'on ' + date(m.crossedAt) : '', pad, y0 + 44, 26, muted);
      } else text(m.threshold ? 'A new threshold crossed' : 'Still climbing', pad, y0, story ? 64 : 54, up);
      const y1 = y0 + (story ? 200 : 150);
      const items: [string, string, boolean][] = [
        ['Peak value', showMoney ? money(m.peak.total_usd) : '—', blurMoney],
        ['Peak date', date(m.peak.captured_at), false],
        ['Now vs peak', m.peak.total_usd > 0 ? signed((m.end.total_usd - m.peak.total_usd) / m.peak.total_usd * 100) : '—', false],
        ['Days tracked', String(m.days), false],
      ];
      items.forEach(([k, v, b], i) => { const y = y1 + i * 80; text(k, pad, y, 24, muted); text(v, w - pad, y, 30, ink, 'right', inner / 2, b); hline(y + 26); });
    }
    note = 'Based on recorded snapshots in the selected period.';
  } else {
    text(options.template === 'overview' ? money(data.total) : 'A portfolio in percentages', pad, 280, options.template === 'overview' && showMoney ? 56 : 28, muted, 'left', inner, options.template === 'overview' && blurMoney);
    const cx = wide ? w * 0.29 : w / 2, cy = wide ? 535 : story ? 665 : 500;
    const radius = story ? 245 : wide ? 175 : 148, stroke = story ? 60 : 42;
    let angle = -Math.PI / 2;
    ctx.lineWidth = stroke;
    if (!total) { ctx.beginPath(); ctx.arc(cx, cy, radius, 0, Math.PI * 2); ctx.strokeStyle = light ? '#cbd5e1' : '#33405e'; ctx.stroke(); }
    top.forEach((a: any, i: number) => { const end = angle + a.usd / total * Math.PI * 2; ctx.beginPath(); ctx.arc(cx, cy, radius, angle, end); ctx.strokeStyle = colors[i % colors.length]; ctx.stroke(); angle = end; });
    text(String(rows.length), cx, cy + 3, 67, ink, 'center');
    text('assets', cx, cy + 44, 24, muted, 'center');
    const lx = wide ? 840 : pad + 16, ly = wide ? 390 : story ? 1060 : 735, lw = wide ? w - lx - pad : inner - 32;
    if (!total) text('No positive holdings to display', lx, ly, 26, muted);
    top.forEach((a: any, i: number) => {
      const yy = ly + i * (story ? 75 : 42);
      ctx.fillStyle = colors[i % colors.length]; ctx.beginPath(); ctx.arc(lx + 7, yy - 8, 7, 0, Math.PI * 2); ctx.fill();
      text(a.label, lx + 30, yy, 26, ink, 'left', lw - 155);
      text((a.usd / total * 100).toFixed(1) + '%', lx + lw, yy, 26, ink, 'right');
    });
    note = 'Allocation uses positive holdings; totals include liabilities.';
  }

  // ---- footer ----
  if (caption) text(caption, pad, h - 122, 24, ink, 'left', inner);
  text(note, pad, h - 88, 21, muted);
  if (options.watermark !== false) {
    text('MY PORTFOLIO / MY PERSPECTIVE', pad, h - 52, 18, muted);
    text(handle ? handle : 'worthly', w - pad, h - 52, 20, muted, 'right', inner / 2);
  }
  ctx.restore();
}
