import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync, readdirSync } from 'node:fs';
import { build } from 'esbuild';

// Bundle in memory so tests use the real resolver without modifying build output.
const compiled = await build({ entryPoints: ['src/graphql/resolvers.ts'], bundle: true,
  platform: 'node', format: 'esm', write: false });
const { resolvers } = await import('data:text/javascript;base64,' + Buffer.from(compiled.outputFiles[0].text).toString('base64'));
const db = new DatabaseSync(':memory:');
db.exec('PRAGMA foreign_keys=ON');
for (const file of readdirSync('migrations').filter(f => f.endsWith('.sql')).sort()) {
  db.exec(readFileSync('migrations/' + file, 'utf8'));
}
db.exec("INSERT INTO portfolios (name,created_at,updated_at) VALUES ('Test',1,1)");
const DB = {
  prepare(sql) {
    return { bind(...args) {
      return {
        first: async () => db.prepare(sql).get(...args) ?? null,
        all: async () => ({ results: db.prepare(sql).all(...args) }),
        run: async () => { const r = db.prepare(sql).run(...args); return { meta: { last_row_id: Number(r.lastInsertRowid), changes: r.changes } }; },
      };
    } };
  },
  async batch(statements) {
    db.exec('BEGIN');
    try { const results = []; for (const s of statements) results.push(await s.run()); db.exec('COMMIT'); return results; }
    catch (error) { db.exec('ROLLBACK'); throw error; }
  },
};
const ctx = { env: { DB, KV: { get: async () => null, put: async () => {} } } };
const originalFetch = globalThis.fetch;
globalThis.fetch = async () => { throw new Error('Network disabled in tests'); };
const originalError = console.error;
console.error = () => {};
try {
  const day = 86400000;
  const today = Math.floor(Date.now() / day) * day;
  const input = { portfolio_id: 1, kind: 'property', label: 'House', currency: 'USD',
    purchase_price: 100, purchase_date: today - 2 * day, initial_value: 200 };
  const { id } = await resolvers.Mutation.createFixedAsset(null, { input }, ctx);
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM fixed_asset_valuations WHERE asset_id=?').get(id).n, 1);
  await assert.rejects(resolvers.Mutation.updateFixedAsset(null, { id, input: { currency: 'IDR' } }, ctx), /Currency cannot/);
  await assert.rejects(resolvers.Mutation.updateFixedAsset(null, { id, input: { label: ' ' } }, ctx), /Label is required/);
  const { points } = await resolvers.Query.assetHistory(null, { days: '4' }, ctx);
  assert.deepEqual(points.map(p => p.total_usd), [0, 100, 100, 200]);
  await resolvers.Mutation.addFixedAssetValuation(null, { id, input: { value: 150, valued_at: today - day } }, ctx);
  const updated = await resolvers.Query.assetHistory(null, { days: '4' }, ctx);
  assert.deepEqual(updated.points.map(p => p.total_usd), [0, 100, 150, 200]);
  db.exec("CREATE TRIGGER fail_valuation BEFORE INSERT ON fixed_asset_valuations BEGIN SELECT RAISE(ABORT, 'test rollback'); END");
  await assert.rejects(resolvers.Mutation.createFixedAsset(null, { input }, ctx), /test rollback/);
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM fixed_assets').get().n, 1);
  db.exec('DROP TRIGGER fail_valuation');
  await resolvers.Mutation.deleteFixedAsset(null, { id }, ctx);
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM fixed_asset_valuations').get().n, 0);
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM fixed_assets').get().n, 0);
  console.log('Fixed assets: migration, CRUD, currency lock, empty label, dated history, rollback and cascade passed.');
} finally {
  globalThis.fetch = originalFetch;
  console.error = originalError;
  db.close();
}
