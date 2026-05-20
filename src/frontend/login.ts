// Halaman login + setup awal. Alpine & Tailwind via CDN.
export const loginHtml = `<!doctype html>
<html lang="id" class="h-full">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
  <meta name="robots" content="noindex,nofollow" />
  <title>Masuk — Wallet Tracker</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <script defer src="https://cdn.jsdelivr.net/npm/alpinejs@3.x.x/dist/cdn.min.js"></script>
  <style>[x-cloak]{display:none!important}</style>
</head>
<body class="h-full bg-slate-100 text-slate-900 antialiased">
  <div class="flex min-h-full items-center justify-center px-4 py-12">
    <div x-data="loginPage()" x-init="init()" x-cloak class="w-full max-w-md">
      <div class="mb-6 text-center">
        <div class="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 text-white shadow-lg">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M3 7h18M3 7l2 12a2 2 0 002 2h10a2 2 0 002-2l2-12M3 7l1-3h16l1 3M9 11v6m6-6v6"/></svg>
        </div>
        <h1 class="text-xl font-semibold tracking-tight">Wallet Tracker</h1>
        <p class="mt-1 text-sm text-slate-500" x-text="mode === 'setup' ? 'Buat akun admin pertama' : 'Masuk ke akun Anda'"></p>
      </div>

      <div class="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <form @submit.prevent="submit()" class="space-y-4">
          <div>
            <label class="mb-1 block text-sm font-medium text-slate-700">Username</label>
            <input x-model="username" type="text" autocomplete="username" required
              class="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100" />
          </div>
          <div>
            <label class="mb-1 block text-sm font-medium text-slate-700">Password</label>
            <input x-model="password" type="password" :autocomplete="mode === 'setup' ? 'new-password' : 'current-password'" required
              class="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100" />
            <p x-show="mode === 'setup'" class="mt-1 text-xs text-slate-400">Minimal 10 karakter.</p>
          </div>

          <p x-show="error" x-text="error" class="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-600"></p>

          <button type="submit" :disabled="loading"
            class="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-indigo-500 to-violet-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:opacity-95 disabled:opacity-60">
            <span x-show="!loading" x-text="mode === 'setup' ? 'Buat akun' : 'Masuk'"></span>
            <span x-show="loading">Memproses…</span>
          </button>
        </form>
      </div>
      <p class="mt-6 text-center text-xs text-slate-400">Single-user · Sesi aman httpOnly</p>
    </div>
  </div>

  <script>
    function loginPage() {
      return {
        mode: 'login', username: '', password: '', error: '', loading: false,
        async init() {
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
            if (!res.ok || !data.ok) { this.error = data.error || 'Gagal'; this.loading = false; return; }
            if (this.mode === 'setup') {
              // setelah setup, langsung login
              const lr = await fetch('/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: this.username, password: this.password }) });
              const ld = await lr.json();
              if (!lr.ok || !ld.ok) { this.error = ld.error || 'Login gagal'; this.loading = false; return; }
            }
            location.href = '/';
          } catch (e) { this.error = 'Kesalahan jaringan'; this.loading = false; }
        }
      };
    }
  </script>
</body>
</html>`;
