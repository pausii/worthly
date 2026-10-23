import assert from 'node:assert/strict';
import { build } from 'esbuild';

const bundle = await build({ entryPoints: ['src/services/onchain/evm.ts'], bundle: true, platform: 'node', format: 'esm', write: false });
const { normalizeEvmToken } = await import('data:text/javascript;base64,' + Buffer.from(bundle.outputFiles[0].text).toString('base64'));

// aToken Aave v3 (berbagai chain) -> aset dasar di dompet defi
assert.deepEqual(normalizeEvmToken('aEthUSDT'), { asset: 'USDT', walletType: 'defi' });
assert.deepEqual(normalizeEvmToken('aBnbUSDC'), { asset: 'USDC', walletType: 'defi' });
assert.deepEqual(normalizeEvmToken('aArbWETH'), { asset: 'ETH', walletType: 'defi' });
assert.deepEqual(normalizeEvmToken('aEthWBTC'), { asset: 'BTC', walletType: 'defi' });
assert.deepEqual(normalizeEvmToken('aBnbBTCB'), { asset: 'BTC', walletType: 'defi' });
// aToken Aave v2
assert.deepEqual(normalizeEvmToken('aUSDT'), { asset: 'USDT', walletType: 'defi' });
// Debt token = utang, dilewati
assert.equal(normalizeEvmToken('variableDebtEthUSDT'), null);
assert.equal(normalizeEvmToken('stableDebtUSDC'), null);
// Token biasa & terbungkus
assert.deepEqual(normalizeEvmToken('USDT'), { asset: 'USDT', walletType: 'onchain' });
assert.deepEqual(normalizeEvmToken('WETH'), { asset: 'ETH', walletType: 'onchain' });
assert.deepEqual(normalizeEvmToken('BTCB'), { asset: 'BTC', walletType: 'onchain' });
// Simbol yang kebetulan diawali huruf a kecil tapi bukan aToken (huruf kedua kecil) tetap token biasa
assert.deepEqual(normalizeEvmToken('ape'), { asset: 'APE', walletType: 'onchain' });
assert.equal(normalizeEvmToken(''), null);
console.log('EVM token normalization: Aave aTokens, debt tokens, wrapped assets passed.');
