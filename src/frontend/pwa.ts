export const iconSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 192 192">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#6366f1"/>
      <stop offset="55%" stop-color="#7c3aed"/>
      <stop offset="100%" stop-color="#8b5cf6"/>
    </linearGradient>
    <radialGradient id="glow" cx="30%" cy="22%" r="80%">
      <stop offset="0%" stop-color="#ffffff" stop-opacity="0.22"/>
      <stop offset="60%" stop-color="#ffffff" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="area" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#ffffff" stop-opacity="0.40"/>
      <stop offset="100%" stop-color="#ffffff" stop-opacity="0"/>
    </linearGradient>
  </defs>
  <rect width="192" height="192" rx="44" fill="url(#bg)"/>
  <rect width="192" height="192" rx="44" fill="url(#glow)"/>
  <path d="M38 138 L70 116 L98 128 L128 90 L156 58 L156 150 L38 150 Z" fill="url(#area)"/>
  <line x1="36" y1="150" x2="156" y2="150" stroke="#ffffff" stroke-width="4" stroke-linecap="round" opacity="0.30"/>
  <path d="M38 138 L70 116 L98 128 L128 90 L156 58" fill="none" stroke="#ffffff" stroke-width="10" stroke-linecap="round" stroke-linejoin="round"/>
  <circle cx="156" cy="58" r="12" fill="#ffffff"/>
  <circle cx="156" cy="58" r="5.5" fill="#7c3aed"/>
</svg>`;

export const manifestJson = JSON.stringify({
  name: 'Worthly',
  short_name: 'Worthly',
  description: 'Personal crypto & portfolio tracker',
  start_url: '/',
  scope: '/',
  display: 'standalone',
  background_color: '#f1f5f9',
  theme_color: '#4f46e5',
  icons: [{ src: '/icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any maskable' }],
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
