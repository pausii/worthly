# Kebijakan Keamanan

Worthly menyimpan kredensial exchange dan alamat wallet penggunanya, jadi laporan keamanan sangat dihargai.

## Melaporkan celah keamanan

**Jangan membuka issue publik untuk celah keamanan.**

Gunakan fitur **Report a vulnerability** di tab *Security* repo GitHub ini
(GitHub Private Vulnerability Reporting). Laporan hanya terlihat oleh maintainer.

Sertakan: deskripsi celah, langkah reproduksi, dampak yang mungkin, dan versi/commit yang terpengaruh.
Anda akan mendapat balasan dalam 7 hari. Setelah perbaikan dirilis, Anda akan disebut di catatan rilis
kecuali meminta anonim.

## Cakupan

Yang termasuk:

- Kebocoran atau dekripsi kredensial CEX/RPC yang tersimpan di D1
- Bypass autentikasi, sesi, CSRF, atau rate-limit login
- Kelemahan CSP / XSS di frontend
- Kebocoran `MASTER_KEY` atau secret lain lewat log/respons

Yang tidak termasuk:

- Kerentanan di layanan pihak ketiga (Binance, Bybit, Alchemy, Frankfurter, Yahoo Finance, Cloudflare)
- Masalah yang memerlukan akses ke akun Cloudflare pemilik deployment
- Laporan hasil pemindai otomatis tanpa bukti dampak

## Versi yang didukung

Hanya versi terbaru di branch `main` dan tag rilis terakhir yang menerima perbaikan keamanan.
