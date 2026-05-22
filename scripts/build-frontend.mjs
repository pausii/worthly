// Build aset frontend yang di-self-host (menghapus ketergantungan CDN demi CSP ketat).
// Output ke ./public, disajikan via Cloudflare Workers Assets.
//  - public/app.css          : Tailwind ter-precompile (hilangkan 'unsafe-eval' dari Tailwind Play CDN)
//  - public/vendor/alpine.js : Alpine.js (build auto-init, sama seperti CDN)
//  - public/vendor/chart.js  : Chart.js (UMD) di-minify
import { cpSync, mkdirSync } from 'node:fs';
import { execSync } from 'node:child_process';

mkdirSync('public/vendor', { recursive: true });

const run = (cmd) => execSync(cmd, { stdio: 'inherit' });

// 1) Tailwind -> CSS statis (memindai kelas di src/frontend/*.ts)
run('npx tailwindcss -i ./src/frontend/input.css -o ./public/app.css --minify');

// 2) Alpine.js — salin build CDN/auto-init apa adanya
cpSync('node_modules/alpinejs/dist/cdn.min.js', 'public/vendor/alpine.js');

// 3) Chart.js — minify UMD bundle agar ringan
run('npx esbuild node_modules/chart.js/dist/chart.umd.js --minify --legal-comments=none --outfile=public/vendor/chart.js');

console.log('[build-frontend] public/app.css, public/vendor/alpine.js, public/vendor/chart.js siap.');
