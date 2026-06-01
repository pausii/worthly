// Login page + first-time setup. Alpine & Tailwind via CDN.
export const loginHtml = `<!doctype html>
<html lang="en" class="h-full">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
  <meta name="robots" content="noindex,nofollow" />
  <meta name="mobile-web-app-capable" content="yes" />
  <meta name="apple-mobile-web-app-capable" content="yes" />
  <meta name="apple-mobile-web-app-title" content="Worthly" />
  <meta name="theme-color" content="#6366f1" />
  <link rel="manifest" href="/manifest.json" />
  <link rel="apple-touch-icon" href="/icon.svg" />
  <title>Sign In — Worthly</title>
  <!-- Apply dark class before CSS renders to prevent flash -->
  <link rel="stylesheet" href="/app.css" />
  <script nonce="__CSP_NONCE__">if(localStorage.getItem('theme')==='dark')document.documentElement.classList.add('dark')</script>
  <script defer src="/vendor/alpine.js"></script>
  <style>
    [x-cloak]{display:none!important}
    /* Smooth dark mode transitions — enabled after first paint to avoid load flash */
    .theme-ready,.theme-ready *{transition:background-color .2s ease,border-color .2s ease,color .2s ease}
    /* Card entrance */
    .login-card{animation:loginIn .5s cubic-bezier(.16,1,.3,1) both}
    @keyframes loginIn{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:none}}
    /* Self-drawing portfolio chart line (pathLength normalized to 1) */
    .draw-line{stroke-dasharray:1;stroke-dashoffset:1;filter:drop-shadow(0 1px 8px rgba(99,102,241,.45))}
    .draw-1{animation:draw 7s ease-in-out infinite}
    .draw-2{animation:draw 9.5s ease-in-out infinite;animation-delay:1.2s}
    @keyframes draw{
      0%{stroke-dashoffset:1;opacity:0}
      8%{opacity:.9}
      55%{stroke-dashoffset:0;opacity:.9}
      82%{stroke-dashoffset:0;opacity:0}
      100%{stroke-dashoffset:0;opacity:0}
    }
    /* A glowing dot that rides the trend, pulsing gently */
    .pulse-dot{animation:pulse 7s ease-in-out infinite}
    @keyframes pulse{0%,100%{opacity:0;transform:scale(.6)}40%{opacity:1;transform:scale(1)}70%{opacity:.6}}
    @media (prefers-reduced-motion: reduce){
      .login-card,.draw-1,.draw-2,.pulse-dot{animation:none}
      .draw-line{stroke-dashoffset:0;opacity:.45}
    }
  </style>
</head>
<body class="h-full bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100 antialiased">

  <!-- Calm gradient + self-drawing chart background -->
  <div class="pointer-events-none fixed inset-0 overflow-hidden" aria-hidden="true">
    <div class="absolute inset-0 bg-gradient-to-br from-violet-100 via-indigo-50 to-sky-100 dark:from-slate-950 dark:via-slate-900 dark:to-indigo-950"></div>
    <div class="absolute -top-20 -left-16 h-72 w-72 rounded-full bg-indigo-300/40 blur-3xl dark:bg-indigo-500/10"></div>
    <div class="absolute -bottom-24 right-0 h-80 w-80 rounded-full bg-violet-300/40 blur-3xl dark:bg-violet-500/10"></div>
    <svg class="absolute inset-0 h-full w-full" viewBox="0 0 1200 600" preserveAspectRatio="xMidYMid slice" fill="none">
      <!-- secondary, fainter line -->
      <path class="draw-line draw-2 text-violet-400 dark:text-violet-500/60" pathLength="1" vector-effect="non-scaling-stroke"
        stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"
        d="M0,500 L100,470 L200,492 L300,430 L400,452 L500,398 L600,420 L700,358 L800,382 L900,318 L1000,348 L1100,300 L1200,278" />
      <!-- primary trend line -->
      <path class="draw-line draw-1 text-indigo-500 dark:text-indigo-400/80" pathLength="1" vector-effect="non-scaling-stroke"
        stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"
        d="M0,420 L80,402 L160,442 L240,360 L320,392 L400,300 L480,332 L560,260 L640,292 L720,210 L800,242 L880,170 L960,202 L1040,132 L1120,162 L1200,92" />
      <!-- glowing head dot near the latest (top-right) point -->
      <circle class="pulse-dot text-indigo-500 dark:text-indigo-400" cx="1120" cy="162" r="6" fill="currentColor" />
    </svg>
  </div>

  <!-- Dark mode toggle -->
  <button id="darkToggle" aria-label="Toggle dark mode"
    class="fixed top-4 right-4 z-50 rounded-xl bg-white/50 p-2.5 text-slate-600 backdrop-blur transition hover:bg-white/80 dark:bg-white/10 dark:text-slate-300 dark:hover:bg-white/20">
    <!-- Moon — shown in light mode -->
    <svg class="h-5 w-5 dark:hidden" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
      <path stroke-linecap="round" stroke-linejoin="round" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"/>
    </svg>
    <!-- Sun — shown in dark mode -->
    <svg class="h-5 w-5 hidden dark:block" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
      <path stroke-linecap="round" stroke-linejoin="round" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z"/>
    </svg>
  </button>

  <div class="relative flex min-h-full items-center justify-center px-4 py-12">
    <div x-data="loginPage()" x-cloak class="login-card w-full max-w-md">
      <div class="rounded-3xl border border-white/70 bg-white/85 p-6 shadow-xl shadow-indigo-200/40 backdrop-blur-md dark:border-white/10 dark:bg-slate-900/80 dark:shadow-black/30 sm:p-8">
        <div class="mb-6 text-center">
          <div class="relative mx-auto mb-3 h-14 w-14">
            <div class="absolute inset-0 rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 opacity-60 blur-lg"></div>
            <img src="/icon.svg" alt="Worthly" class="relative h-14 w-14 rounded-2xl shadow-lg ring-1 ring-white/70 dark:ring-white/10" />
          </div>
          <h1 class="text-xl font-semibold tracking-tight">Worthly</h1>
          <p class="mt-1 text-sm text-slate-500 dark:text-slate-400" x-text="mode === 'setup' ? 'Create the first admin account' : 'Sign in to your account'"></p>
        </div>
        <form @submit.prevent="submit()" class="space-y-4">
          <div>
            <label class="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">Username</label>
            <input x-model="username" type="text" autocomplete="username" required autofocus
              class="w-full rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 px-3 py-2.5 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 dark:focus:ring-indigo-900/40" />
          </div>
          <div>
            <label class="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">Password</label>
            <div class="relative">
              <input x-model="password" :type="showPw ? 'text' : 'password'" :autocomplete="mode === 'setup' ? 'new-password' : 'current-password'" required
                @keyup="capsLock = !!($event.getModifierState && $event.getModifierState('CapsLock'))"
                @keydown="capsLock = !!($event.getModifierState && $event.getModifierState('CapsLock'))"
                class="w-full rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 px-3 py-2.5 pr-10 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 dark:focus:ring-indigo-900/40" />
              <button type="button" @click="showPw = !showPw" tabindex="-1"
                :aria-label="showPw ? 'Hide password' : 'Show password'"
                class="absolute inset-y-0 right-0 flex items-center pr-3 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
                <svg x-show="!showPw" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/><path stroke-linecap="round" stroke-linejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/></svg>
                <svg x-show="showPw" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21"/></svg>
              </button>
            </div>
            <p x-show="mode === 'setup'" class="mt-1 text-xs text-slate-400 dark:text-slate-500">Minimum 10 characters.</p>
            <p x-show="capsLock" x-transition class="mt-1 flex items-center gap-1 text-xs font-medium text-amber-600 dark:text-amber-400">
              <svg class="h-3.5 w-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M12 9v2m0 4h.01M5 19h14a2 2 0 001.84-2.75L13.74 4a2 2 0 00-3.48 0L3.16 16.25A2 2 0 005 19z"/></svg>
              Caps Lock is on
            </p>
          </div>

          <p x-show="error" x-text="error" role="alert" aria-live="assertive" class="rounded-lg bg-rose-50 dark:bg-rose-900/30 px-3 py-2 text-sm text-rose-600 dark:text-rose-400"></p>

          <button type="submit" :disabled="loading || !username || !password"
            class="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-indigo-500 to-violet-500 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-60">
            <svg x-show="loading" class="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path></svg>
            <span x-text="loading ? (mode === 'setup' ? 'Creating account…' : 'Signing in…') : (mode === 'setup' ? 'Create account' : 'Sign in')"></span>
          </button>
        </form>
      </div>
      <p class="mt-6 flex items-center justify-center gap-1.5 text-center text-xs text-slate-500 dark:text-slate-400">
        <svg class="h-3.5 w-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"/></svg>
        Single-user · Secure httpOnly session
      </p>
    </div>
  </div>

  <script nonce="__CSP_NONCE__">
    function toggleDark() {
      const isDark = document.documentElement.classList.toggle('dark');
      localStorage.setItem('theme', isDark ? 'dark' : 'light');
    }
    var __dt = document.getElementById('darkToggle');
    if (__dt) __dt.addEventListener('click', toggleDark);
    // Enable smooth transitions after first paint (avoids transition on initial dark apply)
    requestAnimationFrame(()=>requestAnimationFrame(()=>document.body.classList.add('theme-ready')));

    function loginPage() {
      return {
        mode: 'login', username: '', password: '', error: '', loading: false,
        showPw: false, capsLock: false,
        async init() {
          if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js').catch(()=>{});
          try {
            const r = await fetch('/api/auth/status').then(x => x.json());
            if (r.data && r.data.authenticated) { location.href = '/'; return; }
            if (r.data && r.data.needsSetup) this.mode = 'setup';
          } catch (e) {}
        },
        async submit() {
          this.error = ''; this.loading = true;
          try {
            const path = this.mode === 'setup' ? '/api/auth/setup' : '/api/auth/login';
            const res = await fetch(path, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ username: this.username, password: this.password })
            });
            const data = await res.json();
            if (!res.ok || !data.ok) { this.error = data.error || 'Failed'; this.loading = false; return; }
            if (this.mode === 'setup') {
              // after setup, auto login
              const lr = await fetch('/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: this.username, password: this.password }) });
              const ld = await lr.json();
              if (!lr.ok || !ld.ok) { this.error = ld.error || 'Login failed'; this.loading = false; return; }
            }
            location.href = '/';
          } catch (e) { this.error = 'Network error'; this.loading = false; }
        }
      };
    }
  </script>
</body>
</html>`;
