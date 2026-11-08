import assert from 'node:assert/strict';
import { createHash, randomBytes } from 'node:crypto';
import { build } from 'esbuild';

const bundle = await build({ entryPoints: ['src/services/cex/cryptomus.ts'], bundle: true,
  platform: 'node', format: 'esm', write: false });
const mod = await import('data:text/javascript;base64,' + Buffer.from(bundle.outputFiles[0].text).toString('base64'));
const { md5Hex, cryptomusSign, parseCryptomusBalances, getAllBalances } = mod;

// 1) MD5 cocok dengan modul crypto Node untuk panjang dari 0 sampai melewati beberapa blok 64 byte,
//    termasuk batas padding (55, 56, 63, 64 byte) dan UTF-8 multibyte.
const ref = (s) => createHash('md5').update(s, 'utf8').digest('hex');
assert.equal(md5Hex(''), 'd41d8cd98f00b204e9800998ecf8427e');
assert.equal(md5Hex('abc'), '900150983cd24fb0d6963f7d28e17f72');
for (let n = 0; n <= 300; n++) {
  const s = 'x'.repeat(n);
  assert.equal(md5Hex(s), ref(s), `len ${n}`);
}
for (let i = 0; i < 200; i++) {
  const s = randomBytes(1 + (i % 120)).toString('base64');
  assert.equal(md5Hex(s), ref(s));
}
assert.equal(md5Hex('Ünïcödé — 日本語 🚀'), ref('Ünïcödé — 日本語 🚀'));

// 2) Signature: tanpa body = md5(apiKey); dengan body = md5(base64(body) + apiKey).
assert.equal(cryptomusSign('dummy-key'), ref('dummy-key'));
const body = JSON.stringify({ order_id: 'x1', amount: '10' });
assert.equal(cryptomusSign('dummy-key', body), ref(Buffer.from(body).toString('base64') + 'dummy-key'));

// 3) Parsing: hanya saldo > 0, kode huruf besar, duplikat dijumlahkan, nilai rusak diabaikan.
const parsed = parseCryptomusBalances([
  { uuid: 'a', balance: '0.00000000', currency_code: 'DASH' },
  { uuid: 'b', balance: '505.5', currency_code: 'usdt' },
  { uuid: 'c', balance: '4.5', currency_code: 'USDT' },
  { uuid: 'd', balance: 'abc', currency_code: 'BTC' },
  { uuid: 'e', balance: '0.001', currency_code: 'LTC' },
  { uuid: 'f', balance: '1', currency_code: '' },
], 'funding');
assert.deepEqual(parsed.map(p => [p.asset, p.total, p.walletType]), [['USDT', 510, 'funding'], ['LTC', 0.001, 'funding']]);
assert.equal(parsed[0].locked, 0);

// 4) getAllBalances dengan fetch tiruan (data sintetis): header, metode, pemetaan grup, dan error.
const realFetch = globalThis.fetch;
const calls = [];
let respond = () => ({ state: 0, result: [{ balance: { merchant: [{ uuid: 'm', balance: '2', currency_code: 'ETH' }], user: [] } }] });
globalThis.fetch = async (url, init) => {
  calls.push({ url, init });
  const r = respond();
  return new Response(JSON.stringify(r), { status: 200, headers: { 'Content-Type': 'application/json' } });
};
try {
  const res = await getAllBalances({ merchantId: 'MERCHANT-DUMMY', apiKey: 'dummy-key' });
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, 'https://api.cryptomus.com/v1/balance');
  assert.equal(calls[0].init.method, 'POST');
  assert.equal(calls[0].init.headers.merchant, 'MERCHANT-DUMMY');
  assert.equal(calls[0].init.headers.sign, ref('dummy-key'));
  assert.deepEqual(res.synced, ['funding', 'spot']);
  assert.deepEqual(res.balances.map(b => [b.asset, b.walletType]), [['ETH', 'funding']]);
  assert.deepEqual(res.failures, []);

  // Grup user tidak ada: hanya funding yang dianggap tersinkron, spot tidak dianggap kosong.
  respond = () => ({ state: 0, result: [{ balance: { merchant: [] } }] });
  const partial = await getAllBalances({ merchantId: 'M', apiKey: 'k' });
  assert.deepEqual(partial.synced, ['funding']);

  // state != 0 harus melempar error agar saldo lama dipertahankan.
  respond = () => ({ state: 1, message: 'Forbidden' });
  await assert.rejects(getAllBalances({ merchantId: 'M', apiKey: 'k' }), /state=1: Forbidden/);

  // Respons tanpa data dompet juga harus gagal, bukan dianggap kosong.
  respond = () => ({ state: 0, result: [{}] });
  await assert.rejects(getAllBalances({ merchantId: 'M', apiKey: 'k' }), /tidak berisi data dompet/);
} finally {
  globalThis.fetch = realFetch;
}
console.log('Cryptomus: MD5 matches Node crypto, signature, parsing, sync fetch and error paths passed.');
