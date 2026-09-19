import assert from 'node:assert/strict';
import { build } from 'esbuild';

const bundle = await build({ entryPoints: ['src/frontend/share-card.ts'], bundle: true,
  platform: 'node', format: 'esm', write: false, keepNames: true });
const { shareAssetList, renderShareCard } = await import('data:text/javascript;base64,' + Buffer.from(bundle.outputFiles[0].text).toString('base64'));
const data = { assets: [
  { asset: 'Dust', usd: 0.99, amount: 20 },
  { asset: 'Boundary', usd: 1, amount: 10 },
  { asset: 'Large', usd: 100, amount: 3 },
  { asset: 'Unpriced', usd: 0, amount: 2 },
  { asset: 'Empty', usd: 0, amount: 0 },
  { asset: 'Debt', usd: -5, amount: -5 },
], asOf: 1700000000000, currency: 'USD', total: 96.99, history: [] };
const list = shareAssetList(data, {});
assert.deepEqual(list.rows.map(a => a.asset), ['Large', 'Boundary']);
assert.equal(list.positiveTotal, 101.99);
assert.deepEqual(shareAssetList(data, { order: 'value-asc' }).rows.map(a => a.asset), ['Boundary', 'Large']);
assert.deepEqual(shareAssetList(data, { order: 'name-asc' }).rows.map(a => a.asset), ['Boundary', 'Large']);
assert.equal(shareAssetList(data, { minDollar: false }).rows.length, 5);
assert.equal(data.assets[0].asset, 'Dust'); // sorting must not mutate the snapshot
const many = { assets: Array.from({ length: 51 }, (_, i) => ({ asset: 'Asset ' + i, usd: i + 1, amount: i + 1 })) };
for (const size of ['square', 'story', 'landscape']) {
  const initial = shareAssetList(many, { size });
  const seen = [];
  for (let page = 1; page <= initial.pages; page++) seen.push(...shareAssetList(many, { size, page }).visible);
  assert.equal(new Set(seen.map(a => a.asset)).size, 51);
  assert.equal(shareAssetList(many, { size, page: 999 }).page, initial.pages);
}
const drawn = [];
const gradient = { addColorStop() {} };
const ctx = new Proxy({}, { get: (_, key) => key === 'measureText' ? s => ({ width: String(s).length * 8 })
  : key === 'fillText' ? s => drawn.push(String(s))
  : key === 'createLinearGradient' ? () => gradient : () => {} });
const canvas = { getContext: () => ctx };
renderShareCard(canvas, data, { template: 'assets', percentages: false, quantities: false, amounts: false, names: false });
assert(!drawn.includes('Large'));
assert(!drawn.includes('AMOUNT'));
assert(!drawn.includes('VALUE'));
assert(!drawn.includes('SHARE'));
assert(!drawn.some(s => s.endsWith('%')));
drawn.length = 0;
renderShareCard(canvas, data, { template: 'assets', percentages: true, quantities: true, amounts: true, names: true });
assert(drawn.includes('Large'));
assert(drawn.includes('$100'));
assert(drawn.includes((100 / 101.99 * 100).toFixed(2) + '%'));
assert(drawn.includes('3'));
console.log('Share assets: filter boundary, sorting, percentage denominator, pagination and privacy passed.');

// ---- layout baru + ekspor ----
const { shareMovers, shareComposition, shareMilestone, makeZip, SHARE_TEMPLATES, SHARE_SIZES } = await import('data:text/javascript;base64,' + Buffer.from(bundle.outputFiles[0].text).toString('base64'));
const rich = { assets: [ { asset: 'BTC', origin: 'cex', usd: 500, amount: 0.01 }, { asset: 'ETH', origin: 'onchain', usd: 300, amount: 0.1 }, { asset: 'BBCA', origin: 'stock', usd: 200, amount: 100 }, { asset: 'Rumah', origin: 'asset', usd: 1000, amount: 1 }, { asset: 'USD', origin: 'manual', usd: 50, amount: 50 }, { asset: 'DOGE', origin: 'cex', usd: 0.5, amount: 5 } ],
  assetChange: { BTC: 2.5, ETH: -1.2, BBCA: 0.4, DOGE: 9, Rumah: 50 }, history: [ { captured_at: 1, total_usd: 900 }, { captured_at: 2, total_usd: 2600 }, { captured_at: 3, total_usd: 2050 } ] };
const mv = shareMovers(rich);
assert.deepEqual(mv.best.map(m => m.asset), ['DOGE', 'BTC', 'BBCA']); // fixed asset (Rumah) excluded even with a change value
assert.deepEqual(mv.worst.map(m => m.asset), ['ETH']);
const comp = shareComposition(rich);
assert.equal(comp.total, 2050.5);
assert.deepEqual(comp.rows.map(r => r.key), ['cex', 'onchain', 'stock', 'asset', 'manual']);
assert.ok(Math.abs(comp.rows.reduce((s, r) => s + r.pct, 0) - 100) < 1e-9);
const ms = shareMilestone(rich);
assert.equal(ms.threshold, 2000); // highest round threshold <= current 2050
assert.equal(ms.crossedAt, 2); // first point >= 2000
assert.equal(ms.peak.total_usd, 2600);
assert.equal(shareMilestone({ history: [] }), null);
assert.equal(SHARE_TEMPLATES.length, 10);
assert.deepEqual(Object.keys(SHARE_SIZES), ['square', 'portrait', 'story', 'landscape', 'wide']);
const zipBlob = makeZip([{ name: 'a.txt', data: new TextEncoder().encode('hello zip') }, { name: 'dir/b.bin', data: new Uint8Array([0, 1, 2, 3, 255]) }]);
const zip = new Uint8Array(await zipBlob.arrayBuffer());
const sig = (o) => zip[o] | (zip[o + 1] << 8) | (zip[o + 2] << 16) | (zip[o + 3] << 24);
assert.equal(sig(0) >>> 0, 0x04034b50); // local file header
assert.equal(sig(zip.length - 22) >>> 0, 0x06054b50); // end of central directory
assert.equal(zip[zip.length - 22 + 10] | (zip[zip.length - 22 + 11] << 8), 2); // 2 entries
assert.ok(Buffer.from(zip).includes(Buffer.from('hello zip')));
// Render semua template dengan mock canvas: tidak boleh melempar; nama tersembunyi tetap tersembunyi.
for (const t of SHARE_TEMPLATES) {
  drawn.length = 0;
  renderShareCard(canvas, { ...rich, total: 2050.5, asOf: 1700000000000, currency: 'USD', mode: 'snapshot', period: '1M', returns: { costBasis: 1000, currentValue: 2050, abs: 1050, pct: 105, earliestTs: 1, pricedItems: 1, totalItems: 1, unpricedAssets: [] }, spotlight: { asset: 'BTC', candles: [{ t: 1, c: 1 }, { t: 2, c: 2 }] } },
    { template: t.id, names: false, amountMode: 'hidden', size: 'wide', frame: 'glass', font: 'serif', handle: 'me', title: 'Custom', caption: 'cap', watermark: false });
  assert(!drawn.includes('BTC'), t.id + ' must not draw asset names when hidden');
  assert(drawn.includes('Custom'), t.id + ' must draw custom title');
  assert(!drawn.includes('worthly'), t.id + ' must respect watermark=false');
}
console.log('Share layouts: movers, composition, milestone, zip, and privacy across all templates passed.');
