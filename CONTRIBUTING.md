# Berkontribusi ke Worthly

Terima kasih sudah tertarik membantu. Worthly adalah proyek open source berlisensi MIT, dan kontribusi
dalam bentuk apa pun diterima: laporan bug, ide fitur, perbaikan dokumentasi, terjemahan, hingga kode.

*English speakers: contributions in English are welcome. Issues, PRs, and code comments may be written
in either Indonesian or English; the maintainer reads both.*

## Cara ikut serta

| Ingin... | Lakukan |
|---|---|
| Melaporkan bug | Buka [issue bug](../../issues/new?template=bug_report.md) |
| Mengusulkan fitur | Buka [issue fitur](../../issues/new?template=feature_request.md) dan diskusikan dulu sebelum menulis kode |
| Melaporkan celah keamanan | **Jangan** buka issue publik. Ikuti [SECURITY.md](SECURITY.md) |
| Memperbaiki typo / dokumentasi | Langsung kirim pull request, tanpa perlu issue |
| Menambah kode | Cek issue berlabel `good first issue` atau `help wanted`, atau buka issue baru untuk membahas idenya |

Untuk perubahan besar (exchange baru, jaringan baru, perombakan skema), buka issue dulu agar arahnya
disepakati sebelum Anda menghabiskan waktu.

## Ide kontribusi yang dicari

- **Exchange baru** di `src/services/cex` (mis. OKX, Kraken, Indodax). Ikuti pola klien Binance/Bybit:
  signed request read-only, pemetaan saldo ke `{ asset, amount }`, dan riwayat deposit bila tersedia.
- **Jaringan on-chain baru** di `src/services/onchain` (mis. Polygon, Arbitrum, Base) — untuk EVM biasanya
  cukup menambah konfigurasi chain dan endpoint Alchemy.
- **Mata uang fiat baru** — tiga langkah kecil: pastikan simbolnya ada di daftar `FIATS` pada
  `src/services/prices/index.ts`, tambahkan ke `ALLOWED_CURRENCIES` di `src/graphql/resolvers.ts`, lalu
  tambahkan `<option>` di dua dropdown *Currency* pada `src/frontend/app.ts`. Tidak perlu migration.
- **Bursa saham lain** selain IDX, dengan sumber harga publik.
- **Tes regresi** untuk modul yang belum tercakup (`scripts/test-*.mjs` memakai `node:sqlite`).
- **Aksesibilitas dan i18n** frontend (label ARIA, terjemahan antarmuka).
- Dokumentasi: tangkapan layar dark mode, panduan deploy, contoh query GraphQL.

## Menyiapkan lingkungan pengembangan

```sh
git clone https://github.com/pausii/worthly.git
cd worthly
npm install
cp .dev.vars.example .dev.vars      # isi MASTER_KEY (lihat komentar di file)
npm run db:migrate:local
npm run dev                          # http://localhost:8787
```

Syarat: Node.js 18+ (22.13+ untuk menjalankan tes), akun Cloudflare hanya diperlukan untuk deploy,
bukan untuk pengembangan lokal. Detail lengkap ada di bagian *Setup* README.

Kredensial exchange/RPC **tidak diperlukan** untuk sebagian besar pekerjaan: holding manual, aset tetap,
saham IDX, dan seluruh frontend bisa dicoba tanpa API key.

## Alur pull request

1. Fork repo, lalu buat branch dari `main`: `git checkout -b feat/nama-fitur`.
2. Tulis kodenya. Jaga perubahan tetap fokus pada satu hal per PR.
3. Sebelum push, pastikan lolos:
   ```sh
   npm run typecheck
   npm run test:fixed-assets
   npm run test:share-assets
   npm run build:assets && npx wrangler deploy --dry-run
   ```
4. Buka PR ke `main`. Template PR akan memandu apa yang perlu diisi.
5. Tanggapi review. Maintainer akan melakukan *squash merge*, jadi tidak perlu merapikan riwayat commit.

## Konvensi

**Pesan commit** memakai [Conventional Commits](https://www.conventionalcommits.org/) dengan deskripsi
berbahasa Indonesia (Inggris juga diterima):

```
feat: dukung exchange OKX
fix: Solana gagal senyap saat endpoint publik diblokir
docs: tambah contoh query GraphQL
refactor: pisahkan parser saldo Bybit
chore: bump version to 1.1.0
```

Tipe yang dipakai: `feat`, `fix`, `docs`, `refactor`, `perf`, `test`, `chore`.

**Kode**

- TypeScript `strict`. Tidak ada linter/formatter terpasang; ikuti gaya file di sekitarnya
  (2 spasi, kutip tunggal, titik koma, lebar baris ±110).
- Komentar kode berbahasa Indonesia mengikuti mayoritas kode yang ada, tetapi komentar berbahasa
  Inggris tidak akan ditolak.
- Frontend adalah string HTML di `src/frontend/app.ts` dengan Alpine.js. Semua skrip inline harus lewat
  nonce CSP yang sudah ada; jangan menambah origin pihak ketiga (CDN, font, analytics).
- Kredensial apa pun yang disimpan ke D1 wajib lewat `encryptSecret()` di `src/lib/crypto.ts`. Jangan pernah mencatat
  (log) API key, secret, atau isi `MASTER_KEY`.
- Perubahan skema database dibuat sebagai file migration baru di `migrations/` dengan nomor urut
  berikutnya. Jangan mengubah migration yang sudah ada.
- Operasi API baru ditambahkan ke `src/graphql/schema.ts` dan `resolvers.ts`. Folder `src/routes`
  adalah sisa REST lama dan tidak menerima perubahan.
- Tetap hormati batas **Workers Free**: hindari kerja CPU berat per request, dan gunakan cache KV
  untuk data eksternal.

## Melaporkan bug yang baik

Sertakan: langkah reproduksi, perilaku yang diharapkan vs yang terjadi, versi Worthly (tag atau hash
commit), sumber data yang terlibat (exchange/jaringan/manual), dan potongan log dari dashboard
Cloudflare bila ada. **Hapus** API key, alamat wallet, dan nominal pribadi dari log sebelum menempel.

## Lisensi kontribusi

Dengan mengirim kontribusi, Anda setuju bahwa kontribusi tersebut dilisensikan di bawah
[Lisensi MIT](LICENSE) yang sama dengan proyek ini.
