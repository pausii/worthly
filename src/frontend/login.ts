// Login page + first-time setup. Alpine & Tailwind via CDN.
export const loginHtml = `<!doctype html>
<html lang="en" class="h-full">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
  <meta name="robots" content="noindex,nofollow" />
  <meta name="apple-mobile-web-app-capable" content="yes" />
  <meta name="apple-mobile-web-app-title" content="Worthly" />
  <meta name="theme-color" content="#4f46e5" />
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
  </style>
</head>
<body class="h-full bg-slate-100 dark:bg-slate-950 text-slate-900 dark:text-slate-100 antialiased">

  <!-- Dark mode toggle -->
  <button id="darkToggle" aria-label="Toggle dark mode"
    class="fixed top-4 right-4 z-50 rounded-xl p-2.5 text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800 border border-transparent hover:border-slate-300 dark:hover:border-slate-700">
    <!-- Moon — shown in light mode -->
    <svg class="h-5 w-5 dark:hidden" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
      <path stroke-linecap="round" stroke-linejoin="round" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"/>
    </svg>
    <!-- Sun — shown in dark mode -->
    <svg class="h-5 w-5 hidden dark:block" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
      <path stroke-linecap="round" stroke-linejoin="round" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z"/>
    </svg>
  </button>

  <div class="flex min-h-full items-center justify-center px-4 py-12">
    <div x-data="loginPage()" x-init="init()" x-cloak class="w-full max-w-md">
      <div class="mb-6 text-center">
        <div class="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 text-white shadow-lg">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M3 7h18M3 7l2 12a2 2 0 002 2h10a2 2 0 002-2l2-12M3 7l1-3h16l1 3M9 11v6m6-6v6"/></svg>
        </div>
        <h1 class="text-xl font-semibold tracking-tight">Worthly</h1>
        <p class="mt-1 text-sm text-slate-500 dark:text-slate-400" x-text="mode === 'setup' ? 'Create the first admin account' : 'Sign in to your account'"></p>
      </div>

      <div class="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-6 shadow-sm">
        <form @submit.prevent="submit()" class="space-y-4">
          <div>
            <label class="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">Username</label>
            <input x-model="username" type="text" autocomplete="username" required autofocus
              class="w-full rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 px-3 py-2.5 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 dark:focus:ring-indigo-900/40" />
          </div>
          <div>
            <label class="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">Password</label>
            <input x-model="password" type="password" :autocomplete="mode === 'setup' ? 'new-password' : 'current-password'" required
              class="w-full rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 px-3 py-2.5 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 dark:focus:ring-indigo-900/40" />
            <p x-show="mode === 'setup'" class="mt-1 text-xs text-slate-400 dark:text-slate-500">Minimum 10 characters.</p>
          </div>

          <p x-show="error" x-text="error" class="rounded-lg bg-rose-50 dark:bg-rose-900/30 px-3 py-2 text-sm text-rose-600 dark:text-rose-400"></p>

          <button type="submit" :disabled="loading"
            class="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-indigo-500 to-violet-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:opacity-95 disabled:opacity-60">
            <span x-show="!loading" x-text="mode === 'setup' ? 'Create account' : 'Sign in'"></span>
            <span x-show="loading">Processing…</span>
          </button>
        </form>
      </div>
      <p class="mt-6 text-center text-xs text-slate-400 dark:text-slate-500">Single-user · Secure httpOnly session</p>
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
