# Worthly

Personal crypto / CEX portfolio tracker yang berjalan di **Cloudflare Workers**.

- **Backend:** Hono + Cloudflare D1 (database) + KV (session, rate limit, cache harga)
- **Frontend:** Alpine.js + Tailwind CSS + ApexCharts, **self-hosted** (di-build lokal ke `public/`, disajikan via Workers Assets — bukan CDN), responsif + PWA
- **CEX:** Binance & Bybit (saldo SPOT / FUTURES / EARN / FUNDING + riwayat deposit) via API resmi
- **On-chain:** Ethereum & BSC (native + token) via Alchemy, TRON via TronGrid, Bitcoin
- **Saham IDX:** posisi saham Bursa Efek Indonesia (harga via Yahoo Finance) + untung/rugi (cost basis)
- **AI Insight:** ringkasan portofolio via Cloudflare Workers AI
- **Sinkronisasi otomatis:** Cron Trigger tiap 10 menit (round-robin per batch account)
- **Keamanan:** login single-user (PBKDF2-HMAC-SHA256 100k iterasi + pepper), sesi httpOnly+Secure+SameSite=Strict,
  rate-limit login, proteksi CSRF, security headers + CSP ketat (nonce per-request), kredensial CEX/RPC **dienkripsi AES-GCM** di D1.

## Arsitektur singkat

```
Cron (10 mnt) ─┐
              ├─► syncAll() ─► tiap account (per batch): ambil saldo + deposit ─► D1
HTTP request ─┘                 └─► snapshot nilai portofolio (interval) ─► chart

Frontend (Alpine, self-hosted) ─► /api/* (Hono, butuh sesi) ─► D1 / KV
Harga: ticker publik Binance (crypto) + Frankfurter/ECB (fiat) ─► konversi ke USD
```

| Folder | Isi |
|---|---|
| `src/lib` | kripto/keamanan, db, session, auth middleware, rate limit, cooldown, events |
| `src/services/cex` | klien Binance & Bybit (signed request) |
| `src/services/onchain` | klien EVM (ETH/BSC, Alchemy), TRON (TronGrid), Bitcoin |
| `src/services/prices` | konversi harga ke USD + cache (crypto Binance, fiat Frankfurter, saham Yahoo) |
| `src/services/sync.ts` | orkestrator sinkronisasi + snapshot |
| `src/services/valuation.ts`, `overview.ts`, `returns.ts` | valuasi portofolio, ringkasan, perhitungan return |
| `src/routes` | endpoint API (auth, portfolios, accounts, holdings, dashboard, export, system) |
| `src/frontend` | halaman login + app shell + PWA (HTML string) |
| `scripts/build-frontend.mjs` | build aset self-host → `public/` (Tailwind, Alpine, ApexCharts) |
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
# EVM (ETH/BSC) pakai Alchemy, TRON pakai TronGrid.
npx wrangler secret put RPC_ETH_URL        # mis. https://eth-mainnet.g.alchemy.com/v2/KEY
npx wrangler secret put RPC_BSC_URL        # mis. https://bnb-mainnet.g.alchemy.com/v2/KEY
npx wrangler secret put RPC_TRON_URL       # mis. https://api.trongrid.io
npx wrangler secret put RPC_TRON_API_KEY   # opsional, TronGrid API key (hindari rate-limit)

# Opsional lain:
npx wrangler secret put COINGECKO_API_KEY  # opsional, sumber harga tambahan
npx wrangler secret put BINANCE_PROXY_URL  # opsional, bypass geo-block Binance (http://user:pass@host:port)
```

Untuk dev lokal, salin `.dev.vars.example` → `.dev.vars` dan isi `MASTER_KEY`.

### 5. Migrasi database
```powershell
npm run db:migrate:local     # untuk `wrangler dev`
npm run db:migrate:remote    # untuk produksi
```

### 6. Jalankan
```powershell
npm run dev                  # build aset + lokal (wrangler dev)
npm run deploy               # build aset + deploy ke Cloudflare
```

> `dev` dan `deploy` otomatis menjalankan `npm run build:assets` (Tailwind → `public/app.css`,
> Alpine & ApexCharts → `public/vendor/`). Folder `public/` di-gitignore.

Buka aplikasi → akan diminta **setup user pertama** (username + password ≥ 10 karakter).

## Menambah sumber data

- **Binance / Bybit:** menu *Accounts* → pilih exchange → tempel **API key read-only**
  (matikan izin trade & withdraw di dashboard exchange). Key langsung dienkripsi.
- **On-chain (BTC/ETH/BSC/Tron):** menu *Accounts* → pilih jaringan → isi address wallet,
  (opsional) URL RPC (Alchemy untuk EVM / TronGrid untuk TRON), dan daftar token ERC20/BEP20/TRC20 yang ingin ditrack (contract, simbol, decimals).
- **Saham IDX:** menu *Accounts* → pilih **Saham IDX** → daftar posisi: ticker (mis. `BBCA`), jumlah **lot**
  (1 lot = 100 lembar), dan harga beli rata-rata (IDR per lembar). Tanpa API key — harga pasar diambil dari
  Yahoo Finance, untung/rugi dihitung dari cost basis. Lihat tab *Saham IDX* untuk rincian P/L.
- **Manual:** menu *Holding Manual* → mis. `IDR 100000000` atau `USD 300`. Otomatis dikonversi ke USD.

## Catatan keamanan

- Gunakan **API key read-only** untuk CEX. App ini tidak pernah melakukan trade/withdraw.
- `MASTER_KEY` hanya hidup sebagai Worker Secret, tidak pernah masuk ke D1/kode. Password di-pepper
  dengan `MASTER_KEY` (HMAC) sebelum PBKDF2.
- PBKDF2 dibatasi **100.000 iterasi** (batas maksimum Cloudflare Workers Web Crypto).
- Sesi disimpan server-side di KV dan bisa dicabut.
- CSP diperketat: tanpa origin pihak ketiga, skrip inline diizinkan via **nonce per-request**.
  Aset Tailwind/Alpine/ApexCharts di-self-host (bukan CDN). `unsafe-eval` masih dipertahankan
  karena build standar Alpine mengevaluasi ekspresi atribut via `Function()`.

## Verifikasi endpoint API

Detail signing/endpoint Binance & Bybit dapat berubah. Modul di `src/services/cex` sudah mengikuti
dokumentasi resmi terakhir; bila ada perubahan response, sesuaikan parser di file terkait.
