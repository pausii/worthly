## Ringkasan

<!-- Apa yang diubah dan mengapa. Tautkan issue terkait: "Closes #123". -->

## Jenis perubahan

- [ ] Bug fix
- [ ] Fitur baru
- [ ] Refactor / perbaikan internal
- [ ] Dokumentasi
- [ ] Migration database baru (`migrations/000X_*.sql`)

## Checklist

- [ ] `npm run typecheck` lolos
- [ ] `npm run test:fixed-assets` dan `npm run test:share-assets` lolos
- [ ] `npm run build:assets && npx wrangler deploy --dry-run` lolos
- [ ] Sudah dicoba di `npm run dev` (sebutkan skenario yang diuji di bawah)
- [ ] Tidak ada API key, alamat wallet, atau data pribadi di diff/screenshot
- [ ] README/dokumentasi diperbarui bila perilaku pengguna berubah
- [ ] Pesan commit mengikuti Conventional Commits

## Cara menguji

<!-- Langkah yang reviewer bisa ikuti. Sertakan screenshot untuk perubahan UI (light & dark). -->
