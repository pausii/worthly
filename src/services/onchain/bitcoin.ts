import type { NormalizedBalance, NormalizedDeposit } from '../../types';

// Bitcoin (read-only) lewat Data API blockchain.com (blockchain.info).
// - Mendukung address tunggal ATAU xpub/ypub/zpub (blockchain.com derive otomatis semua alamat HD).
// - Endpoint `multiaddr`: saldo gabungan + riwayat transaksi. Hanya baca, tanpa fitur transaksi.
//   Docs: https://www.blockchain.com/explorer/api/blockchain_api

const DEFAULT_BASE = 'https://blockchain.info';
const SATS = 1e8;

interface MultiaddrResp {
  wallet?: { final_balance?: number; n_tx?: number; total_received?: number; total_sent?: number };
  addresses?: { address: string; final_balance?: number }[];
  txs?: {
    hash: string;
    time?: number; // epoch detik
    result?: number; // efek bersih ke wallet yang diminta (satoshi, bertanda). >0 = masuk.
    block_height?: number | null;
  }[];
}

async function getMultiaddr(
  base: string,
  active: string,
  n: number,
  offset: number,
  apiCode?: string,
): Promise<MultiaddrResp> {
  const u = new URL(`${base.replace(/\/$/, '')}/multiaddr`);
  u.searchParams.set('active', active); // address ATAU xpub
  u.searchParams.set('n', String(n)); // jumlah tx (0 = saldo saja)
  u.searchParams.set('offset', String(offset));
  if (apiCode) u.searchParams.set('api_code', apiCode); // opsional, hindari rate-limit
  const res = await fetch(u.toString(), { headers: { Accept: 'application/json' } });
  if (!res.ok) throw new Error(`blockchain.com multiaddr ${res.status}`);
  return (await res.json()) as MultiaddrResp;
}

/** Saldo BTC untuk satu address atau xpub. xpub → blockchain.com gabungkan semua alamat turunan. */
export async function getBitcoinBalances(
  active: string,
  base = DEFAULT_BASE,
  apiCode?: string,
): Promise<NormalizedBalance[]> {
  const data = await getMultiaddr(base, active, 0, 0, apiCode);
  const sats =
    data.wallet?.final_balance ?? (data.addresses ?? []).reduce((s, a) => s + (a.final_balance ?? 0), 0);
  const total = sats / SATS;
  if (total <= 0) return [];
  return [{ walletType: 'onchain', asset: 'BTC', free: total, locked: 0, total }];
}

/**
 * Riwayat BTC masuk (deposit) untuk address/xpub sejak `sinceMs`.
 * Paginasi mundur (terbaru → lama) dan berhenti begitu melewati cursor, agar hemat subrequest/CPU.
 */
export async function getBitcoinDeposits(
  active: string,
  sinceMs: number,
  base = DEFAULT_BASE,
  apiCode?: string,
): Promise<NormalizedDeposit[]> {
  const out: NormalizedDeposit[] = [];
  const PAGE = 100;
  const MAX_PAGES = 20; // batas aman (maks 2000 tx per sync) — sisanya tertangkap sync berikutnya
  for (let page = 0; page < MAX_PAGES; page++) {
    const data = await getMultiaddr(base, active, PAGE, page * PAGE, apiCode);
    const txs = data.txs ?? [];
    if (txs.length === 0) break;
    let oldestMs = Infinity;
    for (const tx of txs) {
      const ts = (tx.time ?? 0) * 1000;
      if (ts < oldestMs) oldestMs = ts;
      if (ts <= sinceMs) continue;
      const result = tx.result ?? 0;
      if (result <= 0) continue; // hanya transaksi masuk (received)
      out.push({
        txId: tx.hash,
        asset: 'BTC',
        amount: result / SATS,
        network: 'BTC',
        address: active,
        status: (tx.block_height ?? 0) > 0 ? 'completed' : 'pending',
        ts,
      });
    }
    if (oldestMs <= sinceMs) break; // sudah melewati cursor
    if (txs.length < PAGE) break; // halaman terakhir
  }
  return out;
}
