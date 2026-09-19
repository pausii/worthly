// Browser renderer, bundled as WorthlyShare by build-frontend.mjs.
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

export function renderShareCard(canvas: HTMLCanvasElement, data: any, options: any) {
  const sizes: Record<string, number[]> = { square: [1080, 1080], story: [1080, 1920], landscape: [1600, 900] };
  const [w, h] = sizes[options.size] || sizes.square;
  canvas.width = w; canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas is unavailable');
  const light = options.theme === 'light';
  const ink = light ? '#15233c' : '#f1f5ff';
  const muted = light ? '#5e6e86' : '#a3b3d0';
  const colors = ['#818cf8', '#2dd4bf', '#38bdf8', '#fbbf24', '#f472b6', '#94a3b8'];
  const pad = 76, inner = w - pad * 2;
  paintBackground(ctx, w, h, light, options.background);
  ctx.strokeStyle = light ? '#cbd5e1' : '#303b59';
  ctx.lineWidth = 1;
  ctx.strokeRect(28, 28, w - 56, h - 56);
  function text(value: string, x: number, y: number, size = 26, color = ink, align: CanvasTextAlign = 'left', max = inner) {
    ctx!.font = '500 ' + size + 'px system-ui, sans-serif';
    ctx!.fillStyle = color; ctx!.textAlign = align;
    let clipped = String(value);
    while (ctx!.measureText(clipped).width > max && clipped.length > 1) clipped = clipped.slice(0, -2) + '…';
    ctx!.fillText(clipped, x, y);
  }
  const date = (ts: number) => new Date(ts).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  const money = (usd: number) => {
    if (!options.amounts) return 'Amounts hidden';
    if (data.currency === 'IDR' && !(data.idrRate > 0)) return 'IDR rate unavailable';
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: data.currency, maximumFractionDigits: 0 }).format(usd * (data.currency === 'IDR' ? data.idrRate : 1));
  };
  text('W / WORTHLY', pad, 105, 24, muted);
  text(date(data.asOf), w - pad, 105, 23, muted, 'right');
  const titles: Record<string, string> = { overview: 'The bigger picture.', allocation: 'How it is allocated.', performance: 'A view of the journey.', assets: 'Everything I hold.' };
  text(titles[options.template] || titles.overview, pad, 194, 51);
  const rows = data.assets.filter((a: any) => Number.isFinite(a.usd) && a.usd > 0);
  const total = rows.reduce((s: number, a: any) => s + a.usd, 0);
  const top = rows.slice(0, 5).map((a: any, i: number) => ({ ...a, label: options.names ? a.asset : 'Asset ' + (i + 1) }));
  if (rows.length > 5) top.push({ label: 'Others', usd: rows.slice(5).reduce((s: number, a: any) => s + a.usd, 0) });
  const wide = w > h;
  const story = h > w;
  if (options.template === 'assets') {
    const list = shareAssetList(data, options);
    const percent = options.percentages !== false;
    const qty = !!options.quantities;
    const value = !!options.amounts;
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
      text(options.names ? a.asset : 'Asset ' + (index + 1), pad + 20, y, 26, ink, 'left', nameWidth - 36);
      columns.forEach((c, ci) => {
        let content = '—';
        if (c.field === 'amount' && Number.isFinite(a.amount)) {
          content = a.amount.toLocaleString('en-US', { maximumSignificantDigits: 8 });
          if (a.origin === 'asset' && a.currency) content += ' ' + a.currency;
        }
        if (c.field === 'value') content = money(a.usd);
        if (c.field === 'percent' && a.usd >= 0 && list.positiveTotal > 0) content = (a.usd / list.positiveTotal * 100).toFixed(2) + '%';
        text(content, pad + nameWidth + cellWidth * (ci + 1), y, 24, ink, 'right', cellWidth - 18);
      });
      ctx.strokeStyle = light ? '#cbd5e1' : '#303b59'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(pad, y + 25); ctx.lineTo(w - pad, y + 25); ctx.stroke();
    });
  } else if (options.template === 'performance') {
    const points = data.history.filter((p: any) => Number.isFinite(p.total_usd) && Number.isFinite(p.captured_at)).sort((a: any, b: any) => a.captured_at - b.captured_at);
    const simulated = data.mode === 'holdings';
    text(simulated ? 'SIMULATED HOLDINGS · ' + data.period : 'RECORDED VALUE · ' + data.period, pad, 250, 24, muted);
    if (points.length < 2) {
      text('Not enough history yet', pad, h / 2, 40);
      text('Choose another period or wait for more snapshots.', pad, h / 2 + 55, 25, muted);
    } else {
      const start = points[0].total_usd, end = points[points.length - 1].total_usd;
      const change = start > 0 ? (end - start) / start * 100 : null;
      const accent = end >= start ? (light ? '#047857' : '#5eead4') : (light ? '#be123c' : '#fda4af');
      text(change === null ? 'Change unavailable' : (change >= 0 ? '+' : '') + change.toFixed(2) + '%', pad, 350, 76, accent);
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
      ctx.strokeStyle = accent; ctx.lineWidth = 5; ctx.stroke();
      ctx.lineTo(x + cw, y + ch); ctx.lineTo(x, y + ch); ctx.closePath();
      const fill = ctx.createLinearGradient(0, y, 0, y + ch); fill.addColorStop(0, light ? '#818cf850' : '#818cf860'); fill.addColorStop(1, '#818cf800'); ctx.fillStyle = fill; ctx.fill();
      text(date(t0), pad, y + ch + 45, 24, muted);
      text(date(points[points.length - 1].captured_at), w - pad, y + ch + 45, 24, muted, 'right');
      if (options.amounts) text('Start ' + money(start) + '  /  End ' + money(end), pad, y + ch + 92, 26);
    }
  } else {
    text(options.template === 'overview' ? money(data.total) : 'A portfolio in percentages', pad, 280, options.template === 'overview' && options.amounts ? 56 : 28, muted);
    const cx = wide ? w * 0.29 : w / 2, cy = wide ? 535 : story ? 665 : 500;
    const radius = story ? 245 : wide ? 175 : 148, stroke = story ? 60 : 42;
    let angle = -Math.PI / 2;
    ctx.lineWidth = stroke;
    if (!total) { ctx.beginPath(); ctx.arc(cx, cy, radius, 0, Math.PI * 2); ctx.strokeStyle = light ? '#cbd5e1' : '#33405e'; ctx.stroke(); }
    top.forEach((a: any, i: number) => { const end = angle + a.usd / total * Math.PI * 2; ctx.beginPath(); ctx.arc(cx, cy, radius, angle, end); ctx.strokeStyle = colors[i]; ctx.stroke(); angle = end; });
    text(String(rows.length), cx, cy + 3, 67, ink, 'center');
    text('assets', cx, cy + 44, 24, muted, 'center');
    const lx = wide ? 840 : pad + 16, ly = wide ? 390 : story ? 1060 : 735, lw = wide ? w - lx - pad : inner - 32;
    if (!total) text('No positive holdings to display', lx, ly, 26, muted);
    top.forEach((a: any, i: number) => {
      const yy = ly + i * (story ? 75 : 42);
      ctx.fillStyle = colors[i]; ctx.beginPath(); ctx.arc(lx + 7, yy - 8, 7, 0, Math.PI * 2); ctx.fill();
      text(a.label, lx + 30, yy, 26, ink, 'left', lw - 155);
      text((a.usd / total * 100).toFixed(1) + '%', lx + lw, yy, 26, ink, 'right');
    });
  }
  text(options.template === 'assets' ? (options.percentages !== false ? 'Share = % of all positive holdings, before the filter.' : 'Holdings at the date shown above.') : options.template === 'performance' ? (data.mode === 'holdings' ? 'Simulation, not actual past balances.' : 'Snapshots, not investment returns.') : 'Allocation uses positive holdings; totals include liabilities.', pad, h - 88, 21, muted);
  text('MY PORTFOLIO / MY PERSPECTIVE', pad, h - 52, 18, muted);
  text('worthly', w - pad, h - 52, 20, muted, 'right');
}
