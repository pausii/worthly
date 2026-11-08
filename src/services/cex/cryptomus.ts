import type { CexBalanceFetch, CryptomusCredentials, NormalizedBalance, WalletType } from '../../types';

const BASE = 'https://api.cryptomus.com';

/**
 * Signature Cryptomus: md5(base64(body) + apiKey).
 * Request tanpa body memakai string kosong, sehingga signature-nya md5(apiKey).
 */
export function cryptomusSign(apiKey: string, body = ''): string {
  return md5Hex(base64Utf8(body) + apiKey);
}

/** Base64 dari string UTF-8 (tanpa Buffer, agar tetap jalan di Workers dan tanpa @types/node). */
function base64Utf8(s: string): string {
  if (!s) return '';
  let bin = '';
  for (const b of new TextEncoder().encode(s)) bin += String.fromCharCode(b);
  return btoa(bin);
}

/**
 * MD5 (RFC 1321) murni TypeScript. WebCrypto Workers tidak menyediakan MD5, dan Cryptomus
 * mewajibkannya untuk signature. Diuji terhadap modul crypto Node pada tes.
 */
export function md5Hex(input: string): string {
  const bytes = new TextEncoder().encode(input);
  const bitLen = bytes.length * 8;
  const size = (Math.floor((bytes.length + 8) / 64) + 1) * 64;
  const buf = new Uint8Array(size);
  buf.set(bytes);
  buf[bytes.length] = 0x80;
  const view = new DataView(buf.buffer);
  view.setUint32(size - 8, bitLen >>> 0, true);
  view.setUint32(size - 4, Math.floor(bitLen / 0x100000000), true);

  const S = [7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22,
    5, 9, 14, 20, 5, 9, 14, 20, 5, 9, 14, 20, 5, 9, 14, 20,
    4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23,
    6, 10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21];
  const K = Array.from({ length: 64 }, (_, i) => Math.floor(Math.abs(Math.sin(i + 1)) * 0x100000000) >>> 0);

  let a0 = 0x67452301;
  let b0 = 0xefcdab89;
  let c0 = 0x98badcfe;
  let d0 = 0x10325476;
  const M = new Uint32Array(16);
  for (let off = 0; off < size; off += 64) {
    for (let j = 0; j < 16; j++) M[j] = view.getUint32(off + j * 4, true);
    let A = a0;
    let B = b0;
    let C = c0;
    let D = d0;
    for (let i = 0; i < 64; i++) {
      let F: number;
      let g: number;
      if (i < 16) {
        F = (B & C) | (~B & D);
        g = i;
      } else if (i < 32) {
        F = (D & B) | (~D & C);
        g = (5 * i + 1) % 16;
      } else if (i < 48) {
        F = B ^ C ^ D;
        g = (3 * i + 5) % 16;
      } else {
        F = C ^ (B | ~D);
        g = (7 * i) % 16;
      }
      F = (F + A + K[i] + M[g]) >>> 0;
      A = D;
      D = C;
      C = B;
      B = (B + ((F << S[i]) | (F >>> (32 - S[i])))) >>> 0;
    }
    a0 = (a0 + A) >>> 0;
    b0 = (b0 + B) >>> 0;
    c0 = (c0 + C) >>> 0;
    d0 = (d0 + D) >>> 0;
  }
  const out = new DataView(new ArrayBuffer(16));
  out.setUint32(0, a0, true);
  out.setUint32(4, b0, true);
  out.setUint32(8, c0, true);
  out.setUint32(12, d0, true);
  return Array.from(new Uint8Array(out.buffer), (b) => b.toString(16).padStart(2, '0')).join('');
}

interface BalanceItem {
  uuid: string;
  balance: string;
  currency_code: string;
  balance_usd?: string;
}

interface BalanceResponse {
  state: number;
  message?: string;
  result?: Array<{ balance?: { merchant?: BalanceItem[]; user?: BalanceItem[] } }>;
}

/**
 * Ubah satu grup dompet menjadi saldo ternormalisasi. Hanya saldo di atas nol yang disimpan.
 * Kode mata uang dinormalkan ke huruf besar; duplikat dalam satu grup dijumlahkan karena
 * tabel balances unik per (account, wallet_type, asset).
 */
export function parseCryptomusBalances(items: BalanceItem[] | undefined, walletType: WalletType): NormalizedBalance[] {
  const out = new Map<string, NormalizedBalance>();
  for (const it of items ?? []) {
    const total = parseFloat(it.balance || '0');
    if (!(total > 0) || !it.currency_code) continue;
    const asset = it.currency_code.toUpperCase();
    const prev = out.get(asset);
    if (prev) {
      prev.total += total;
      prev.free += total;
    } else {
      out.set(asset, { walletType, asset, free: total, locked: 0, total });
    }
  }
  return [...out.values()];
}

async function fetchBalance(creds: CryptomusCredentials): Promise<BalanceResponse> {
  const res = await fetch(`${BASE}/v1/balance`, {
    method: 'POST',
    headers: {
      merchant: creds.merchantId,
      sign: cryptomusSign(creds.apiKey),
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
  });
  const data = (await res.json().catch(() => null)) as BalanceResponse | null;
  if (!data) throw new Error(`Cryptomus /v1/balance HTTP ${res.status} (respons tidak valid)`);
  if (data.state !== 0) {
    throw new Error(`Cryptomus /v1/balance HTTP ${res.status}, state=${data.state ?? '-'}: ${data.message ?? 'gagal'}`);
  }
  return data;
}

/**
 * Ambil saldo satu merchant. Grup `merchant` (Business) dipetakan ke `funding`, grup `user`
 * (Personal) ke `spot`. Satu panggilan mengembalikan keduanya, jadi kegagalan apa pun melempar
 * error: saldo lama tetap tersimpan dan tidak ada dompet yang dianggap kosong.
 */
export async function getAllBalances(creds: CryptomusCredentials): Promise<CexBalanceFetch> {
  const data = await fetchBalance(creds);
  const bal = data.result?.[0]?.balance;
  if (!bal || (!Array.isArray(bal.merchant) && !Array.isArray(bal.user))) {
    throw new Error('Cryptomus: respons saldo tidak berisi data dompet');
  }
  const synced: WalletType[] = [];
  if (Array.isArray(bal.merchant)) synced.push('funding');
  if (Array.isArray(bal.user)) synced.push('spot');
  return {
    balances: [...parseCryptomusBalances(bal.merchant, 'funding'), ...parseCryptomusBalances(bal.user, 'spot')],
    synced,
    failures: [],
  };
}
