// Kriptografi pakai WebCrypto bawaan Workers (tanpa dependency eksternal).
// - Hash password: PBKDF2-HMAC-SHA256 (default 600k iterasi, rekomendasi OWASP).
// - Enkripsi kredensial: AES-GCM 256 dengan master key dari Worker Secret.
// - Tanda tangan API exchange: HMAC-SHA256.

// Cloudflare Workers membatasi PBKDF2 maksimal 100.000 iterasi.
const PBKDF2_ITERATIONS = 100_000;
const encoder = new TextEncoder();
const decoder = new TextDecoder();

export function b64encode(buf: ArrayBuffer | Uint8Array): string {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  let s = '';
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
  return btoa(s);
}

// Tipe kembalian dipersempit ke Uint8Array<ArrayBuffer> (memang ArrayBuffer-backed) agar
// kompatibel dengan BufferSource ketat dari lib DOM yang ikut tertarik dependensi graphql-yoga.
export function b64decode(str: string): Uint8Array<ArrayBuffer> {
  const bin = atob(str);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

export function b64urlencode(buf: ArrayBuffer | Uint8Array): string {
  return b64encode(buf).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/** Token acak URL-safe untuk session id / csrf. */
export function randomToken(bytes = 32): string {
  return b64urlencode(crypto.getRandomValues(new Uint8Array(bytes)));
}

/** Bandingkan string dengan waktu konstan (mencegah timing attack). */
export function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}

export interface PasswordHash {
  hash: string;
  salt: string;
  iterations: number;
}

/**
 * Terapkan "pepper" (rahasia server) sebelum PBKDF2. Pepper = MASTER_KEY (Worker Secret).
 * Tujuannya: walau DB bocor, hash tak bisa di-brute-force tanpa secret ini.
 */
async function applyPepper(password: string, pepper: string): Promise<string> {
  if (!pepper) return password;
  return hmacSha256Hex(pepper, password);
}

export async function hashPassword(
  password: string,
  saltB64?: string,
  iterations = PBKDF2_ITERATIONS,
  pepper = '',
): Promise<PasswordHash> {
  const input = await applyPepper(password, pepper);
  const salt = saltB64 ? b64decode(saltB64) : crypto.getRandomValues(new Uint8Array(16));
  const baseKey = await crypto.subtle.importKey('raw', encoder.encode(input), 'PBKDF2', false, [
    'deriveBits',
  ]);
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt, iterations, hash: 'SHA-256' },
    baseKey,
    256,
  );
  return { hash: b64encode(bits), salt: b64encode(salt), iterations };
}

export async function verifyPassword(
  password: string,
  storedHashB64: string,
  saltB64: string,
  iterations: number,
  pepper = '',
): Promise<boolean> {
  const { hash } = await hashPassword(password, saltB64, iterations, pepper);
  return timingSafeEqual(hash, storedHashB64);
}

async function importAesKey(masterKeyB64: string): Promise<CryptoKey> {
  const raw = b64decode(masterKeyB64);
  if (raw.length !== 32) {
    throw new Error('MASTER_KEY harus base64 dari tepat 32 byte (256-bit).');
  }
  return crypto.subtle.importKey('raw', raw, { name: 'AES-GCM' }, false, ['encrypt', 'decrypt']);
}

/** Enkripsi string -> base64(iv[12] || ciphertext+tag). */
export async function encryptSecret(plaintext: string, masterKeyB64: string): Promise<string> {
  const key = await importAesKey(masterKeyB64);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, encoder.encode(plaintext));
  const combined = new Uint8Array(iv.length + ct.byteLength);
  combined.set(iv, 0);
  combined.set(new Uint8Array(ct), iv.length);
  return b64encode(combined);
}

export async function decryptSecret(payloadB64: string, masterKeyB64: string): Promise<string> {
  const key = await importAesKey(masterKeyB64);
  const data = b64decode(payloadB64);
  const iv = data.slice(0, 12);
  const ct = data.slice(12);
  const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, ct);
  return decoder.decode(pt);
}

/** HMAC-SHA256 -> hex (dipakai Binance & Bybit untuk tanda tangan request). */
export async function hmacSha256Hex(secret: string, message: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const sig = await crypto.subtle.sign('HMAC', key, encoder.encode(message));
  const bytes = new Uint8Array(sig);
  let hex = '';
  for (let i = 0; i < bytes.length; i++) hex += bytes[i].toString(16).padStart(2, '0');
  return hex;
}
