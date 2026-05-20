# Wallet Tracker

Personal crypto / CEX portfolio tracker yang berjalan di **Cloudflare Workers**.

- **Backend:** Hono + Cloudflare D1 (database) + KV (session, rate limit, cache harga)
- **Frontend:** Alpine.js + Tailwind CSS + Chart.js (semua via CDN), responsif
- **CEX:** Binance & Bybit (saldo SPOT / FUTURES / EARN / FUNDING + riwayat deposit) via API resmi
- **On-chain:** TRON, Ethereum, BSC (native + token) via QuickNode
- **Sinkronisasi otomatis:** Cron Trigger tiap 2 menit
- **Keamanan:** login single-user (PBKDF2 600k iterasi), sesi httpOnly+Secure+SameSite=Strict,
  rate-limit login, proteksi CSRF, security headers, kredensial CEX/RPC **dienkripsi AES-GCM** di D1.

## Arsitektur singkat

```
Cron (2 mnt) ─┐
              ├─► syncAll() ─► tiap account: ambil saldo + deposit ─► D1
HTTP request ─┘                 └─► snapshot nilai portofolio (interval) ─► chart

Frontend (Alpine) ─► /api/* (Hono, butuh sesi) ─► D1 / KV
Harga: ticker publik Binance (crypto) + Frankfurter/ECB (fiat) ─► konversi ke USD
```

| Folder | Isi |
|---|---|
| `src/lib` | kripto/keamanan, db, session, auth middleware, rate limit |
| `src/services/cex` | klien Binance & Bybit (signed request) |
| `src/services/onchain` | klien EVM (ETH/BSC) & TRON via QuickNode |
| `src/services/prices` | konversi harga ke USD + cache |
| `src/services/sync.ts` | orkestrator sinkronisasi + snapshot |
| `src/routes` | endpoint API (auth, portfolios, accounts, holdings, dashboard) |
| `src/frontend` | halaman login + app shell (HTML string) |
| `migrations` | skema D1 |

## Setup

### 1. Prasyarat
- Node.js 18+
- Akun Cloudflare + `wrangler` (login: `npx wrangler login`)

### 2. Install
```powershell
npm install
```

### 3. Buat D1 & KV, lalu isi id di wrangler.toml
```powershell
npm run db:create   # salin "database_id" ke wrangler.toml
npm run kv:create   # salin "id" ke wrangler.toml
```

### 4. Set secret
```powershell
# MASTER_KEY = base64 dari 32 byte acak (kunci enkripsi kredensial). JANGAN hilang/ganti
# setelah ada data tersimpan, atau kredensial lama tak bisa didekripsi.
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))" | npx wrangler secret put MASTER_KEY

# Opsional (default endpoint on-chain; bisa juga diisi per-account lewat UI):
npx wrangler secret put QUICKNODE_ETH_URL
npx wrangler secret put QUICKNODE_BSC_URL
npx wrangler secret put QUICKNODE_TRON_URL
```

Untuk dev lokal, salin `.dev.vars.example` → `.dev.vars` dan isi `MASTER_KEY`.

### 5. Migrasi database
```powershell
npm run db:migrate:local     # untuk `wrangler dev`
npm run db:migrate:remote    # untuk produksi
```

### 6. Jalankan
```powershell
npm run dev                  # lokal
npm run deploy               # deploy ke Cloudflare
```

Buka aplikasi → akan diminta **setup user pertama** (username + password ≥ 10 karakter).

## Menambah sumber data

- **Binance / Bybit:** menu *Accounts* → pilih exchange → tempel **API key read-only**
  (matikan izin trade & withdraw di dashboard exchange). Key langsung dienkripsi.
- **On-chain (ETH/BSC/Tron):** menu *Accounts* → pilih jaringan → isi address wallet,
  (opsional) URL QuickNode, dan daftar token TRC20/ERC20/BEP20 yang ingin ditrack (contract, simbol, decimals).
- **Manual:** menu *Holding Manual* → mis. `IDR 100000000` atau `USD 300`. Otomatis dikonversi ke USD.

## Catatan keamanan

- Gunakan **API key read-only** untuk CEX. App ini tidak pernah melakukan trade/withdraw.
- `MASTER_KEY` hanya hidup sebagai Worker Secret, tidak pernah masuk ke D1/kode.
- Sesi disimpan server-side di KV dan bisa dicabut.
- CSP mengizinkan CDN Tailwind/Alpine/Chart.js (butuh `unsafe-eval`/`unsafe-inline`) — konsekuensi
  dari syarat "full CDN". Untuk pengetatan, frontend bisa dipindah ke build lokal + Workers Assets.

## Verifikasi endpoint API

Detail signing/endpoint Binance & Bybit dapat berubah. Modul di `src/services/cex` sudah mengikuti
dokumentasi resmi terakhir; bila ada perubahan response, sesuaikan parser di file terkait.
