import type { Env } from '../types';
import { queryAll } from '../lib/db';
import { classifyAsset, getDailyCloses, getUsdRates } from './prices';

const DAY_MS = 24 * 60 * 60 * 1000;

interface DepositRow {
  asset: string;
  amount: number;
  ts: number;
}
interface ManualRow {
  currency: string;
  amount: number;
  created_at: number;
}
interface FixedRow {
  currency: string;
  purchase_price: number;
  purchase_date: number;
}

export interface CostBasisResult {
  costBasis: number; // total modal masuk (USD) dinilai pada tanggal masuk
  pricedItems: number; // berapa item (deposit + manual) berhasil dinilai
  totalItems: number; // total item yang dipertimbangkan
  unpricedAssets: string[]; // aset yang tak bisa dinilai historis (mis. tak punya pair USDT)
  earliestTs: number; // tanggal masuk paling awal (0 bila tak ada)
  computedAt: number;
}

/**
 * Hitung cost basis (modal masuk) seluruh portofolio.
 *
 * Cost basis = Σ (jumlah × harga aset pada TANGGAL MASUK), digabung dari:
 *   - deposit CEX/on-chain (tabel `deposits`, kecuali status 'pending')
 *   - holding manual (tabel `manual_holdings`, termasuk amount negatif = arah keluar)
 *   - aset tetap (tabel `fixed_assets`): harga beli pada tanggal beli — BUKAN nilai taksiran kini
 *
 * Penilaian harga per tanggal:
 *   - stablecoin → 1 USD
 *   - fiat       → kurs USD TERKINI (aproksimasi; fiat relatif stabil)
 *   - crypto     → close harian Binance pada hari itu (carry-forward dari close terakhir
 *                  yang diketahui bila hari persisnya kosong; di-clamp ke close terawal
 *                  bila tanggal lebih tua dari data kline yang tersedia)
 *
 * Catatan keterbatasan (sengaja, demi kesederhanaan & hemat subrequest):
 *   - TIDAK memperhitungkan penarikan/penjualan — hanya arus masuk. Jadi ini aproksimasi
 *     "modal yang pernah masuk", bukan akuntansi lot FIFO/HPP penuh.
 *   - Deposit yang lebih tua dari jangkauan kline (~1000 hari) dinilai pada close terawal.
 */
export async function computeCostBasis(env: Env): Promise<CostBasisResult> {
  const [deposits, manuals, fixed] = await Promise.all([
    queryAll<DepositRow>(
      env,
      `SELECT asset, amount, ts FROM deposits WHERE status != 'pending' AND amount > 0`,
    ),
    queryAll<ManualRow>(env, `SELECT currency, amount, created_at FROM manual_holdings`),
    queryAll<FixedRow>(env, `SELECT currency, purchase_price, purchase_date FROM fixed_assets`),
  ]);

  const items = [
    ...deposits.map((d) => ({ asset: d.asset.toUpperCase(), amount: d.amount, ts: d.ts })),
    ...manuals.map((m) => ({ asset: m.currency.toUpperCase(), amount: m.amount, ts: m.created_at })),
    ...fixed.map((f) => ({ asset: f.currency.toUpperCase(), amount: f.purchase_price, ts: f.purchase_date })),
  ];
  const totalItems = items.length;
  if (totalItems === 0) {
    return { costBasis: 0, pricedItems: 0, totalItems: 0, unpricedAssets: [], earliestTs: 0, computedAt: Date.now() };
  }

  // Pisahkan aset crypto (butuh harga historis) vs stable/fiat (kurs konstan/terkini).
  const cryptoSyms = new Set<string>();
  const constSyms = new Set<string>();
  for (const it of items) {
    if (classifyAsset(it.asset) === 'crypto') cryptoSyms.add(it.asset);
    else constSyms.add(it.asset);
  }

  // Kurs USD terkini untuk stable/fiat (stable di-handle sebagai 1 oleh getUsdRates).
  const constRates = constSyms.size ? await getUsdRates(env, [...constSyms]) : {};

  // Klines harian per crypto → map (UTC midnight ms) -> close, plus daftar hari urut menaik.
  const hist = new Map<string, { days: number[]; closeByDay: Map<number, number> }>();
  await Promise.all(
    [...cryptoSyms].map(async (sym) => {
      const pts = await getDailyCloses(env, sym + 'USDT', 1000);
      const closeByDay = new Map<number, number>();
      for (const p of pts) closeByDay.set(Math.floor(p.t / DAY_MS) * DAY_MS, p.c);
      const days = [...closeByDay.keys()].sort((a, b) => a - b);
      hist.set(sym, { days, closeByDay });
    }),
  );

  const priceAt = (sym: string, ts: number): number | null => {
    const kind = classifyAsset(sym);
    if (kind === 'stable') return 1;
    if (kind === 'fiat') return constRates[sym] ?? null; // aproksimasi: kurs terkini
    const h = hist.get(sym);
    if (!h || h.days.length === 0) return null;
    const day = Math.floor(ts / DAY_MS) * DAY_MS;
    if (day <= h.days[0]) return h.closeByDay.get(h.days[0]) ?? null;
    // Hari terakhir yang diketahui ≤ tanggal target (carry-forward).
    let best = h.days[0];
    for (const d of h.days) {
      if (d <= day) best = d;
      else break;
    }
    return h.closeByDay.get(best) ?? null;
  };

  let costBasis = 0;
  let pricedItems = 0;
  let earliestTs = Infinity;
  const unpriced = new Set<string>();
  for (const it of items) {
    const px = priceAt(it.asset, it.ts);
    if (px === null || !isFinite(px) || px <= 0) {
      unpriced.add(it.asset);
      continue;
    }
    costBasis += it.amount * px;
    pricedItems++;
    if (it.ts < earliestTs) earliestTs = it.ts;
  }

  return {
    costBasis,
    pricedItems,
    totalItems,
    unpricedAssets: [...unpriced],
    earliestTs: earliestTs === Infinity ? 0 : earliestTs,
    computedAt: Date.now(),
  };
}
