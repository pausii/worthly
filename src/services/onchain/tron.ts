import type { NormalizedBalance, OnchainConfig } from '../../types';

// TRON pakai HTTP API TronGrid (https://api.trongrid.io).
// TRX: POST /wallet/getaccount. TRC20: POST /wallet/triggerconstantcontract (balanceOf).

const B58_ALPHABET = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';

/** Decode base58 -> bytes (tanpa validasi checksum; cukup untuk ambil hex address). */
function base58Decode(str: string): Uint8Array {
  let num = 0n;
  for (const ch of str) {
    const idx = B58_ALPHABET.indexOf(ch);
    if (idx < 0) throw new Error(`Karakter base58 tidak valid: ${ch}`);
    num = num * 58n + BigInt(idx);
  }
  const bytes: number[] = [];
  while (num > 0n) {
    bytes.unshift(Number(num & 0xffn));
    num >>= 8n;
  }
  // leading '1' di base58 == leading zero byte
  for (const ch of str) {
    if (ch === '1') bytes.unshift(0);
    else break;
  }
  return new Uint8Array(bytes);
}

/** Address TRON (T...) -> hex 20 byte (tanpa prefix 0x41). */
function tronAddressToHex20(address: string): string {
  const decoded = base58Decode(address); // 0x41 + 20 byte + 4 checksum
  const body = decoded.slice(1, 21); // ambil 20 byte address
  let hex = '';
  for (const b of body) hex += b.toString(16).padStart(2, '0');
  return hex;
}

function formatUnits(raw: bigint, decimals: number): number {
  if (decimals === 0) return Number(raw);
  const base = 10n ** BigInt(decimals);
  const whole = raw / base;
  const frac = (raw % base).toString().padStart(decimals, '0');
  return parseFloat(`${whole}.${frac}`);
}

async function post<T>(url: string, path: string, body: unknown, apiKey?: string): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  };
  if (apiKey) headers['TRON-PRO-API-KEY'] = apiKey; // dipakai TronGrid
  const res = await fetch(`${url.replace(/\/$/, '')}${path}`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`TRON ${path} ${res.status}`);
  return (await res.json()) as T;
}

export async function getTronBalances(
  url: string,
  config: OnchainConfig,
  apiKey?: string,
): Promise<NormalizedBalance[]> {
  const out: NormalizedBalance[] = [];
  const address = config.address;

  if (config.trackNative) {
    const acc = await post<{ balance?: number }>(url, '/wallet/getaccount', {
      address,
      visible: true,
    }, apiKey);
    const total = (acc.balance ?? 0) / 1e6; // sun -> TRX
    if (total > 0) out.push({ walletType: 'onchain', asset: 'TRX', free: total, locked: 0, total });
  }

  const holderHex = tronAddressToHex20(address).padStart(64, '0');
  for (const token of config.tokens ?? []) {
    try {
      const result = await post<{ constant_result?: string[] }>(url, '/wallet/triggerconstantcontract', {
        owner_address: address,
        contract_address: token.contract,
        function_selector: 'balanceOf(address)',
        parameter: holderHex,
        visible: true,
      }, apiKey);
      const hex = result.constant_result?.[0];
      if (hex) {
        const total = formatUnits(BigInt('0x' + hex), token.decimals);
        if (total > 0)
          out.push({ walletType: 'onchain', asset: token.symbol.toUpperCase(), free: total, locked: 0, total });
      }
    } catch {
      // token bermasalah — lanjut
    }
  }
  return out;
}
