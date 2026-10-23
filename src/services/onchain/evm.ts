import type { NormalizedBalance, OnchainConfig, WalletType } from '../../types';

// Simbol on-chain -> simbol harga. Token terbungkus dinilai seperti aset dasarnya.
const PRICE_ALIAS: Record<string, string> = { WETH: 'ETH', WBTC: 'BTC', BTCB: 'BTC', WBNB: 'BNB' };

/**
 * Normalisasi simbol token hasil auto-deteksi menjadi { asset, walletType }.
 * - aToken Aave (v3: aEthUSDT/aBnbUSDT/aArbUSDC…, v2: aUSDT) = posisi supply, saldo 1:1 dengan
 *   aset dasarnya -> disimpan sebagai aset dasar di dompet 'defi' agar ikut ternilai.
 * - Debt token Aave (variableDebt…/stableDebt…) adalah utang, bukan aset -> null (dilewati).
 * - Token terbungkus (WETH/WBTC/BTCB) dinilai seperti aset dasarnya.
 */
export function normalizeEvmToken(rawSymbol: string): { asset: string; walletType: WalletType } | null {
  const sym = (rawSymbol || '').trim();
  if (!sym) return null;
  if (/^(variable|stable)Debt/i.test(sym)) return null;
  const aave = /^a(?:Eth|Bnb|Arb|Opt|Pol|Base|Ava|Gno|Met|Lin|Scr|Zk|Son|Cel)?([A-Za-z0-9.]{2,})$/.exec(sym);
  if (aave && /^[A-Z]/.test(aave[1])) {
    const under = aave[1].toUpperCase();
    return { asset: PRICE_ALIAS[under] ?? under, walletType: 'defi' };
  }
  const up = sym.toUpperCase();
  return { asset: PRICE_ALIAS[up] ?? up, walletType: 'onchain' };
}

// ETH & BSC pakai JSON-RPC standar (Ethereum) lewat endpoint Alchemy.

async function rpc<T>(url: string, method: string, params: unknown[]): Promise<T> {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
  });
  const data = (await res.json()) as { result?: T; error?: { message: string } };
  if (data.error) throw new Error(`RPC ${method}: ${data.error.message}`);
  return data.result as T;
}

/** Konversi nilai hex (wei-like) ke number desimal dengan `decimals`. */
function formatUnits(hex: string, decimals: number): number {
  const value = BigInt(hex === '0x' || !hex ? '0x0' : hex);
  if (decimals === 0) return Number(value);
  const base = 10n ** BigInt(decimals);
  const whole = value / base;
  const frac = value % base;
  const fracStr = frac.toString().padStart(decimals, '0');
  return parseFloat(`${whole}.${fracStr}`);
}

function balanceOfData(address: string): string {
  // selector keccak256("balanceOf(address)")[:4] = 0x70a08231
  const clean = address.toLowerCase().replace(/^0x/, '');
  return '0x70a08231' + clean.padStart(64, '0');
}

export async function getEvmBalances(
  url: string,
  config: OnchainConfig,
  nativeSymbol: string,
): Promise<NormalizedBalance[]> {
  const out: NormalizedBalance[] = [];
  const address = config.address;

  if (config.trackNative) {
    const hex = await rpc<string>(url, 'eth_getBalance', [address, 'latest']);
    const total = formatUnits(hex, 18);
    if (total > 0) out.push({ walletType: 'onchain', asset: nativeSymbol, free: total, locked: 0, total });
  }

  // Token di sini dipilih eksplisit lewat UI, jadi kegagalannya di-propagate: account ditandai
  // `error` dan saldo lama dipertahankan, alih-alih tertulis nol tanpa jejak.
  // (Token hasil auto-deteksi ditangani terpisah di getEvmAutoBalances yang memang toleran.)
  for (const token of config.tokens ?? []) {
    let hex: string;
    try {
      hex = await rpc<string>(url, 'eth_call', [
        { to: token.contract, data: balanceOfData(address) },
        'latest',
      ]);
    } catch (e) {
      throw new Error(`${token.symbol.toUpperCase()}: ${e instanceof Error ? e.message : String(e)}`);
    }
    const total = formatUnits(hex, token.decimals);
    if (total > 0)
      out.push({
        walletType: token.wallet ?? 'onchain',
        asset: (token.priceAs || token.symbol).toUpperCase(),
        free: total,
        locked: 0,
        total,
      });
  }
  return out;
}

/**
 * Auto-deteksi semua token ERC-20/BEP-20 non-zero milik address.
 * Memakai method khusus Alchemy (`alchemy_getTokenBalances` + `alchemy_getTokenMetadata`).
 * Bila endpoint bukan Alchemy / tak mendukung, kembalikan kosong (di-skip).
 */
export async function getEvmAutoBalances(url: string, address: string): Promise<NormalizedBalance[]> {
  const out: NormalizedBalance[] = [];
  let res: { tokenBalances?: Array<{ contractAddress: string; tokenBalance: string | null }> };
  try {
    res = await rpc(url, 'alchemy_getTokenBalances', [address]);
  } catch {
    return out;
  }
  const nonzero = (res.tokenBalances ?? []).filter((t) => {
    if (!t.tokenBalance) return false;
    try {
      return BigInt(t.tokenBalance) > 0n;
    } catch {
      return false;
    }
  });
  // Batasi jumlah agar panggilan metadata tidak berlebihan (token spam/airdrop bisa banyak).
  for (const t of nonzero.slice(0, 50)) {
    try {
      const meta = await rpc<{ symbol?: string; decimals?: number }>(url, 'alchemy_getTokenMetadata', [
        t.contractAddress,
      ]);
      if (!meta || !meta.symbol || meta.decimals == null) continue;
      const total = formatUnits(t.tokenBalance as string, meta.decimals);
      const norm = normalizeEvmToken(meta.symbol);
      if (total > 0 && norm) out.push({ walletType: norm.walletType, asset: norm.asset, free: total, locked: 0, total });
    } catch {
      // token bermasalah — lanjut
    }
  }
  return out;
}
