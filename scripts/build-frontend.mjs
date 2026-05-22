// Build aset frontend yang di-self-host (menghapus ketergantungan CDN demi CSP ketat).
// Output ke ./public, disajikan via Cloudflare Workers Assets.
//  - public/app.css              : Tailwind ter-precompile
//  - public/vendor/alpine.js     : Alpine.js (build auto-init)
//  - public/vendor/apexcharts.js : ApexCharts di-minify
import { cpSync, mkdirSync } from 'node:fs';
import { execSync } from 'node:child_process';

mkdirSync('public/vendor', { recursive: true });

const run = (cmd) => execSync(cmd, { stdio: 'inherit' });

// 1) Tailwind -> CSS statis (memindai kelas di src/frontend/*.ts)
run('npx tailwindcss -i ./src/frontend/input.css -o ./public/app.css --minify');

// 2) Alpine.js — salin build CDN/auto-init apa adanya
cpSync('node_modules/alpinejs/dist/cdn.min.js', 'public/vendor/alpine.js');

// 3) ApexCharts — minify bundle
run('npx esbuild node_modules/apexcharts/dist/apexcharts.min.js --minify --legal-comments=none --outfile=public/vendor/apexcharts.js');

console.log('[build-frontend] public/app.css, public/vendor/alpine.js, public/vendor/apexcharts.js siap.');
