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
