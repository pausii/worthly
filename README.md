# Worthly

All-in-one personal net worth & multi-asset portfolio tracker (Crypto CEX, On-chain, Saham IDX, & Aset Tetap) yang berjalan *serverless* di **Cloudflare Workers**.

![Worthly Preview](.github/assets/preview.png)

- **Backend:** Hono + GraphQL Yoga + Cloudflare D1 (database) + KV (session, rate limit, cache harga)
- **Frontend:** Alpine.js + Tailwind CSS + ApexCharts, **self-hosted** (di-build lokal ke `public/`, disajikan via Workers Assets — bukan CDN), responsif, dark mode, PWA dengan deteksi update otomatis
- **CEX:** Binance & Bybit (saldo SPOT / FUTURES / EARN / FUNDING + riwayat deposit) via API resmi
- **On-chain:** Ethereum & BSC (native + token) via Alchemy, TRON via TronGrid, Solana (SOL + SPL seperti USDT) via JSON-RPC, Bitcoin
- **Saham IDX:** posisi saham Bursa Efek Indonesia (harga via Yahoo Finance) + untung/rugi (cost basis)
- **Share Studio:** kartu PNG untuk dibagikan — 10 layout (overview, alokasi, performa, semua aset, movers 24h, all-time return, then vs now, komposisi sumber, spotlight aset, milestone), 10 background, aksen, font, bingkai, avatar, judul/handle kustom, mode privasi (sembunyi, blur, bulat, relatif), format square/4:5/story/landscape/16:9, copy, Web Share, ZIP semua halaman, carousel, dan preset
- **Aset tetap:** properti / kendaraan / emas fisik — harga beli sebagai cost basis, nilai kini ditaksir manual dengan riwayat valuasi
- **Holding manual & pengeluaran:** kas fiat (USD/IDR/JPY/SGD/CHF) dan pencatatan pengeluaran, otomatis dikonversi ke USD
- **Tampilan USD/IDR:** tombol toggle mata uang tampilan di header (pilihan disimpan di browser)
- **Ekspor/impor CSV:** ekspor balances, holdings, dan aset tetap; impor holdings manual dari CSV
- **Share card:** render kartu ringkasan portofolio sebagai gambar (template Overview, Allocation, Performance, dan All Assets dengan filter, pilihan kolom, dan pengurutan)
- **AI Insight:** ringkasan portofolio via Cloudflare Workers AI (opsional)
- **Sinkronisasi otomatis:** Cron Trigger tiap 10 menit (round-robin per batch account)
- **Tahan gangguan sesaat:** dompet yang gagal diambil atau mendadak kosong (padahal sebelumnya bersaldo) mempertahankan saldo lama; hasil kosong baru diterima bila terulang 3 sync berturut-turut, dan tercatat di *Activity*
- **Keamanan:** login single-user (PBKDF2-HMAC-SHA256 100k iterasi + pepper), sesi httpOnly+Secure+SameSite=Strict,
  rate-limit login, proteksi CSRF, security headers + CSP ketat (nonce per-request), kredensial CEX/RPC **dienkripsi AES-GCM** di D1.

## Arsitektur singkat

```
Cron (10 mnt) ─┐
               ├─► syncAll() ─► tiap account (per batch): ambil saldo + deposit ─► D1
HTTP request  ─┘                 └─► snapshot nilai portofolio (interval) ─► chart

Frontend (Alpine, self-hosted) ─► /graphql (Hono + GraphQL Yoga, butuh sesi) ─► D1 / KV
Harga: ticker publik Binance (crypto) + Frankfurter/ECB (fiat) + Yahoo Finance (saham) ─► konversi ke USD
```

API hanya tersedia lewat **GraphQL** di `/graphql` (tidak ada endpoint REST). Lihat bagian [API GraphQL](#api-graphql).

| Folder | Isi |
|---|---|
| `src/lib` | kripto/keamanan, db, session, auth middleware, rate limit, cooldown, events |
| `src/services/cex` | klien Binance & Bybit (signed request) |
| `src/services/onchain` | klien EVM (ETH/BSC, Alchemy), TRON (TronGrid), Solana (JSON-RPC), Bitcoin |
| `src/services/prices` | konversi harga ke USD + cache (crypto Binance, fiat Frankfurter, saham Yahoo) |
| `src/services/sync.ts` | orkestrator sinkronisasi + snapshot |
| `src/services/valuation.ts`, `overview.ts`, `returns.ts` | valuasi portofolio, ringkasan, perhitungan return |
| `src/graphql` | skema GraphQL, resolver, auth plugin, konteks, GraphiQL gate |
| `src/routes` | **sisa handler REST lama, tidak lagi di-mount** oleh `src/index.ts`; dipertahankan sebagai referensi bentuk payload dan akan dihapus di rilis berikutnya |
| `src/frontend` | halaman login + app shell + PWA (HTML string) + renderer share card |
| `scripts/build-frontend.mjs` | build aset self-host → `public/` (Tailwind, Alpine, ApexCharts, share card) |
| `scripts/test-*.mjs` | tes regresi (aset tetap, share card) berbasis `node:sqlite` |
| `migrations` | skema D1 |

## Setup

### 1. Prasyarat
- Node.js 18+
- Akun Cloudflare + `wrangler` (login: `npx wrangler login`)
- (Opsional) akses **Workers AI** di akun Cloudflare untuk fitur AI Insight

### 2. Install
```sh
npm install
```

### 3. Buat D1 & KV, lalu isi id di wrangler.toml
```sh
npm run db:create   # salin "database_id" ke wrangler.toml
npm run kv:create   # salin "id" ke wrangler.toml
```

### 4. Set secret
```sh
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
```sh
npm run db:migrate:local     # untuk `wrangler dev`
npm run db:migrate:remote    # untuk produksi
```

### 6. Jalankan
```sh
npm run dev                  # build aset + lokal (wrangler dev)
npm run deploy               # typecheck + build aset + migration remote + deploy
```

> `dev` dan `deploy` otomatis menjalankan `npm run build:assets` (Tailwind → `public/app.css`,
> Alpine, ApexCharts & share card → `public/vendor/`). Folder `public/` di-gitignore.

`deploy` menjalankan migration remote sebelum Worker diunggah dan berhenti bila migration gagal.
Semua file di `migrations/` harus ikut di-commit; tabelnya wajib tersedia bagi Worker baru.
Untuk memeriksa bundle tanpa mengubah produksi, gunakan `npm run build:assets` lalu
`npx wrangler deploy --dry-run` (jangan gunakan `npm run deploy` untuk dry-run).

Buka aplikasi → akan diminta **setup user pertama** (username + password ≥ 10 karakter).

### Skrip npm

| Skrip | Fungsi |
|---|---|
| `npm run dev` | build aset lalu `wrangler dev` |
| `npm run deploy` | typecheck → build aset → migration remote → `wrangler deploy` |
| `npm run build:assets` | build Tailwind/Alpine/ApexCharts/share card ke `public/` |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run test:fixed-assets` | tes regresi aset tetap (Node.js 22.13+, `node:sqlite`) |
| `npm run test:share-assets` | tes regresi daftar aset pada share card |
| `npm run db:create` / `kv:create` | buat D1 / KV namespace |
| `npm run db:migrate:local` / `db:migrate:remote` | jalankan migration |
| `npm run db:console:local -- "SQL"` | eksekusi SQL langsung ke D1 lokal |

## Konfigurasi (`wrangler.toml`)

| Kunci | Default | Keterangan |
|---|---|---|
| `[triggers] crons` | `*/10 * * * *` | jadwal sinkronisasi saldo |
| `SNAPSHOT_INTERVAL_MINUTES` | `30` | jarak minimal antar snapshot nilai portofolio (bahan chart histori). Sync saldo tetap tiap cron |
| `SYNC_BATCH_SIZE` | `2` | jumlah account yang disinkron per tick cron (round-robin). Diperlukan karena batas CPU per-invocation di **Workers Free** ketat; `0`/kosong = sinkron semua account sekaligus |
| `[ai] binding = "AI"` | aktif | binding Workers AI untuk **AI Insight** (model `@cf/meta/llama-3.1-8b-instruct`). Bila akun tidak punya akses Workers AI, hapus blok `[ai]`; tombol Insight akan menampilkan pesan gagal tetapi fitur lain tidak terpengaruh |
| `[version_metadata]` | aktif | menyuplai id versi deploy ke frontend untuk deteksi update PWA (banner "versi baru tersedia") |
| `[observability]` | aktif | simpan log `console.*` dan metrik di dashboard Cloudflare |

Nilai `SNAPSHOT_INTERVAL_MINUTES` dan `SYNC_BATCH_SIZE` didefinisikan di blok `[vars]`, bukan secret.

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
- **Manual:** menu *Holding Manual* → label, mata uang, nominal, dan arah (**In** = kas masuk, **Out** =
  pengeluaran). Mata uang yang diizinkan: **USD, IDR, JPY, SGD, CHF** (dikonversi ke USD memakai kurs
  Frankfurter/ECB). Entri *Out* disimpan sebagai nominal negatif dengan `asset_class = expense` dan
  mengurangi saldo mata uang tersebut di portofolio; berguna untuk mencatat belanja atau penarikan kas
  tanpa harus mengedit saldo yang ada. Tombol **Import CSV** menerima kolom wajib `label, currency, amount`
  (opsional: `portfolio, note, added_at`) — formatnya sama dengan hasil ekspor `holdings.csv`, sehingga
  ekspor → edit → impor bisa dipakai untuk edit massal. Nominal negatif di CSV juga dibaca sebagai pengeluaran.
- **Aset tetap:** menu *Fixed Assets* → tambah aset (jenis, label, mata uang, harga beli, tanggal beli, nilai kini).
  Tidak ada feed harga: nilai diperbarui lewat **Update value** yang menyimpan riwayat valuasi (sumber: NJOP,
  appraisal, dll). Harga beli dipakai untuk *cost basis* / all-time return; valuasi terbaru masuk ke nilai
  portofolio dan tampil sebagai kategori *Fixed Assets* di chart komposisi. Karena nilainya besar dan tidak
  likuid, pertimbangkan menaruhnya di portofolio terpisah agar tidak mendominasi chart.
  Mata uang dikunci setelah pembuatan agar nominal riwayat tidak berubah arti. Nilai kini awal
  dicatat pada waktu input; sebelum itu harga beli berlaku sejak tanggal beli. Chart simulasi
  memakai riwayat taksiran aset tetap (nol sebelum pembelian), dengan kurs fiat terkini sebagai
  aproksimasi. Chart snapshot tetap menunjukkan saldo yang benar-benar tercatat saat itu.

## API GraphQL

Satu-satunya API adalah GraphQL di `POST /graphql`. Setiap operasi mengembalikan scalar `JSON`, kecuali beberapa tipe ber-field
(`authStatus`, `me`, `portfolios`, `returns`) agar bisa di-select satu per satu.

**Autentikasi**

1. `mutation { login(username: "...", password: "...") }` → server menyetel cookie sesi
   (httpOnly, Secure, SameSite=Strict).
2. Ambil token CSRF: `query { me { username csrf } }`.
3. Untuk setiap **mutation** selain `login`, `setup`, dan `logout`, kirim header `X-CSRF-Token: <csrf>`.
   Query tidak butuh CSRF, hanya cookie sesi.

**Contoh query ringkasan**

```graphql
query {
  overview          # total nilai USD, per portofolio, alokasi, pergerakan 24 jam
  returns { currentValue costBasis abs pct }
  holdings(portfolioId: 1)
  exportCsv(type: "holdings")   # { filename, content }
}
```

**Contoh mutation menambah holding manual**

```graphql
mutation {
  createHolding(input: { portfolio_id: 1, label: "Kas CHF", currency: "CHF", amount: 500 })
}
```

Input kompleks (`createHolding`, `createAccount`, `createFixedAsset`, `importHoldings`, dll.) diterima
sebagai satu argumen `input: JSON`; bentuk fieldnya dijelaskan di komentar tiap operasi pada skema.

**Konsol GraphiQL.** Buka `/graphql` di browser; halaman gerbang akan meminta password
(`GRAPHIQL_PASSWORD`, diverifikasi di `POST /graphql/unlock`, lalu disimpan sebagai cookie unlock).
Bila secret itu tidak disetel, gerbang tidak pernah bisa dibuka sehingga konsol praktis tertutup;
endpoint `POST /graphql` untuk frontend tetap berjalan normal.

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

## Kontribusi

Worthly dikembangkan secara terbuka dan kontribusi sangat diterima, dari laporan bug hingga exchange
atau jaringan baru. Mulai dari [CONTRIBUTING.md](CONTRIBUTING.md) untuk alur kerja, konvensi commit,
dan daftar ide yang sedang dicari.

- **Bug / ide:** buka [issue](../../issues/new/choose)
- **Celah keamanan:** laporkan secara privat sesuai [SECURITY.md](SECURITY.md), jangan lewat issue publik
- **Kode etik:** [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md)

Semua kontribusi dilisensikan di bawah lisensi MIT yang sama dengan proyek ini.

## Lisensi

Proyek ini dilisensikan di bawah [Lisensi MIT](LICENSE).

Hak Cipta (c) 2026 Ahmad Pausi.
