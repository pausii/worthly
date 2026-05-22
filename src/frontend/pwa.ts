export const iconSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 192 192">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#6366f1"/>
      <stop offset="100%" stop-color="#7c3aed"/>
    </linearGradient>
  </defs>
  <rect width="192" height="192" rx="40" fill="url(#g)"/>
  <svg x="28" y="28" width="136" height="136" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
    <path d="M3 7h18M3 7l2 12a2 2 0 002 2h10a2 2 0 002-2l2-12M3 7l1-3h16l1 3M9 11v6m6-6v6"/>
  </svg>
</svg>`;

export const manifestJson = JSON.stringify({
  name: 'Wallet Tracker',
  short_name: 'Wallet',
  description: 'Personal crypto & portfolio tracker',
  start_url: '/',
  scope: '/',
  display: 'standalone',
  background_color: '#f1f5f9',
  theme_color: '#4f46e5',
  icons: [{ src: '/icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' }],
});

// Minimal service worker untuk installability PWA.
// Hanya cegat request same-origin GET (pass-through). Seluruh aset kini di-self-host
// (Tailwind/Alpine/Chart.js via Workers Assets), jadi tak ada lagi request lintas-origin.
export const swJs = `self.addEventListener('install',()=>self.skipWaiting());
self.addEventListener('activate',e=>e.waitUntil(self.clients.claim()));
self.addEventListener('fetch',e=>{
  if(e.request.method!=='GET')return;
  if(new URL(e.request.url).origin!==self.location.origin)return;
  e.respondWith(fetch(e.request));
});`;
