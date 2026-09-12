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
  const gradient = ctx.createLinearGradient(0, 0, w, h);
  gradient.addColorStop(0, light ? '#f8fafc' : '#101a31');
  gradient.addColorStop(1, light ? '#e0e7ff' : '#1c1640');
  ctx.fillStyle = gradient; ctx.fillRect(0, 0, w, h);
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
