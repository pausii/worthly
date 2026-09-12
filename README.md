# Worthly

All-in-one personal net worth & multi-asset portfolio tracker (Crypto CEX, On-chain, Saham IDX, & Aset Tetap) yang berjalan *serverless* di **Cloudflare Workers**.

![Worthly Preview](.github/assets/preview.png)

- **Backend:** Hono + Cloudflare D1 (database) + KV (session, rate limit, cache harga)
- **Frontend:** Alpine.js + Tailwind CSS + ApexCharts, **self-hosted** (di-build lokal ke `public/`, disajikan via Workers Assets — bukan CDN), responsif + PWA
- **CEX:** Binance & Bybit (saldo SPOT / FUTURES / EARN / FUNDING + riwayat deposit) via API resmi
- **On-chain:** Ethereum & BSC (native + token) via Alchemy, TRON via TronGrid, Solana (SOL + SPL seperti USDT) via JSON-RPC, Bitcoin
- **Saham IDX:** posisi saham Bursa Efek Indonesia (harga via Yahoo Finance) + untung/rugi (cost basis)
- **Aset tetap:** properti / kendaraan / emas fisik — harga beli sebagai cost basis, nilai kini ditaksir manual dengan riwayat valuasi
- **AI Insight:** ringkasan portofolio via Cloudflare Workers AI
- **Sinkronisasi otomatis:** Cron Trigger tiap 10 menit (round-robin per batch account)
- **Keamanan:** login single-user (PBKDF2-HMAC-SHA256 100k iterasi + pepper), sesi httpOnly+Secure+SameSite=Strict,
  rate-limit login, proteksi CSRF, security headers + CSP ketat (nonce per-request), kredensial CEX/RPC **dienkripsi AES-GCM** di D1.

## Arsitektur singkat

```
Cron (10 mnt) ─┐
              ├─► syncAll() ─► tiap account (per batch): ambil saldo + deposit ─► D1
HTTP request ─┘                 └─► snapshot nilai portofolio (interval) ─► chart

Frontend (Alpine, self-hosted) ─► /graphql (Hono + GraphQL Yoga, butuh sesi) ─► D1 / KV
Harga: ticker publik Binance (crypto) + Frankfurter/ECB (fiat) ─► konversi ke USD
```

| Folder | Isi |
|---|---|
| `src/lib` | kripto/keamanan, db, session, auth middleware, rate limit, cooldown, events |
| `src/services/cex` | klien Binance & Bybit (signed request) |
| `src/services/onchain` | klien EVM (ETH/BSC, Alchemy), TRON (TronGrid), Solana (JSON-RPC), Bitcoin |
| `src/services/prices` | konversi harga ke USD + cache (crypto Binance, fiat Frankfurter, saham Yahoo) |
| `src/services/sync.ts` | orkestrator sinkronisasi + snapshot |
| `src/services/valuation.ts`, `overview.ts`, `returns.ts` | valuasi portofolio, ringkasan, perhitungan return |
| `src/graphql` | skema GraphQL, resolver, auth plugin, konteks, GraphiQL gate |
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
# EVM (ETH/BSC) pakai Alchemy, TRON pakai TronGrid, Solana pakai JSON-RPC apa pun.
npx wrangler secret put RPC_ETH_URL        # mis. https://eth-mainnet.g.alchemy.com/v2/KEY
npx wrangler secret put RPC_BSC_URL        # mis. https://bnb-mainnet.g.alchemy.com/v2/KEY
npx wrangler secret put RPC_TRON_URL       # mis. https://api.trongrid.io
npx wrangler secret put RPC_TRON_API_KEY   # opsional, TronGrid API key (hindari rate-limit)
npx wrangler secret put RPC_SOL_URL         # disarankan, mis. Helius (api.mainnet-beta.solana.com memblokir IP Workers)

# Opsional lain:
npx wrangler secret put COINGECKO_API_KEY  # opsional, sumber harga tambahan
npx wrangler secret put BINANCE_PROXY_URL  # opsional, bypass geo-block Binance (http://user:pass@host:port)
npx wrangler secret put GRAPHIQL_PASSWORD  # opsional, password proteksi untuk membuka konsol /graphql
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
npm run deploy               # typecheck + build aset + migration remote + deploy
```

> `dev` dan `deploy` otomatis menjalankan `npm run build:assets` (Tailwind → `public/app.css`,
> Alpine & ApexCharts → `public/vendor/`). Folder `public/` di-gitignore.

`deploy` menjalankan migration remote sebelum Worker diunggah dan berhenti bila migration gagal.
Migration `0004_fixed_assets.sql` harus ikut di-commit; tabelnya wajib tersedia bagi Worker baru.
Untuk memeriksa bundle tanpa mengubah produksi, gunakan `npm run build:assets` lalu
`npx wrangler deploy --dry-run` (jangan gunakan `npm run deploy` untuk dry-run).
Tes regresi aset tetap: `npm run test:fixed-assets` (Node.js 22.13+ dengan `node:sqlite`).

Buka aplikasi → akan diminta **setup user pertama** (username + password ≥ 10 karakter).

## Menambah sumber data

- **Binance / Bybit:** menu *Accounts* → pilih exchange → tempel **API key read-only**
  (matikan izin trade & withdraw di dashboard exchange). Key langsung dienkripsi.
- **On-chain (BTC/ETH/BSC/Tron/Solana):** menu *Accounts* → pilih jaringan → isi address wallet,
  (opsional) URL RPC (Alchemy untuk EVM / TronGrid untuk TRON / JSON-RPC untuk Solana), dan daftar token
  ERC20/BEP20/TRC20/SPL yang ingin ditrack (contract atau mint, simbol, decimals). Solana: SOL native + USDT
  (mint `Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB`) tersedia sebagai preset. Untuk Solana isi RPC URL
  (mis. Helius) atau set `RPC_SOL_URL` — endpoint publik cadangan sering kena rate-limit.
- **Saham IDX:** menu *Accounts* → pilih **Saham IDX** → daftar posisi: ticker (mis. `BBCA`), jumlah **lot**
  (1 lot = 100 lembar), dan harga beli rata-rata (IDR per lembar). Tanpa API key — harga pasar diambil dari
  Yahoo Finance, untung/rugi dihitung dari cost basis. Lihat tab *Saham IDX* untuk rincian P/L.
- **Manual:** menu *Holding Manual* → mis. `IDR 100000000` atau `USD 300`. Otomatis dikonversi ke USD.
- **Aset tetap:** menu *Fixed Assets* → tambah aset (jenis, label, mata uang, harga beli, tanggal beli, nilai kini).
  Tidak ada feed harga: nilai diperbarui lewat **Update value** yang menyimpan riwayat valuasi (sumber: NJOP,
  appraisal, dll). Harga beli dipakai untuk *cost basis* / all-time return; valuasi terbaru masuk ke nilai
  portofolio dan tampil sebagai kategori *Fixed Assets* di chart komposisi. Karena nilainya besar dan tidak
  likuid, pertimbangkan menaruhnya di portofolio terpisah agar tidak mendominasi chart.
  Mata uang dikunci setelah pembuatan agar nominal riwayat tidak berubah arti. Nilai kini awal
  dicatat pada waktu input; sebelum itu harga beli berlaku sejak tanggal beli. Chart simulasi
  memakai riwayat taksiran aset tetap (nol sebelum pembelian), dengan kurs fiat terkini sebagai
  aproksimasi. Chart snapshot tetap menunjukkan saldo yang benar-benar tercatat saat itu.

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

## Lisensi

Proyek ini dilisensikan di bawah [Lisensi MIT](LICENSE).

Hak Cipta (c) 2026 AHMAD PAUSI.
