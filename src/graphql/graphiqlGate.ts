// Halaman gerbang password untuk membuka GraphiQL ("yoga-server").
// Form POST biasa (tanpa skrip inline) → aman terhadap CSP ketat.
export function graphiqlGate(error = false): string {
  return `<!doctype html>
<html lang="id" class="h-full">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta name="robots" content="noindex,nofollow" />
  <title>GraphQL Console — Worthly</title>
  <link rel="stylesheet" href="/app.css" />
  <script nonce="__CSP_NONCE__">if(localStorage.getItem('theme')==='dark')document.documentElement.classList.add('dark')</script>
</head>
<body class="h-full bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100 antialiased">
  <div class="flex min-h-full items-center justify-center px-4 py-12">
    <div class="w-full max-w-sm rounded-3xl border border-slate-200 bg-white p-8 shadow-xl dark:border-white/10 dark:bg-slate-900">
      <h1 class="text-lg font-semibold tracking-tight">GraphQL Console</h1>
      <p class="mt-1 text-sm text-slate-500 dark:text-slate-400">Masukkan password untuk membuka yoga-server.</p>
      <form method="POST" action="/graphql/unlock" class="mt-6 space-y-4">
        <input type="password" name="password" autofocus required placeholder="Password"
          class="w-full rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-2.5 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 dark:focus:ring-indigo-900/40" />
        ${error ? '<p class="text-sm text-rose-600 dark:text-rose-400">Password salah.</p>' : ''}
        <button type="submit"
          class="flex w-full items-center justify-center rounded-xl bg-gradient-to-r from-indigo-500 to-violet-500 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:opacity-95">
          Buka Console
        </button>
      </form>
      <p class="mt-6 text-center text-xs text-slate-400 dark:text-slate-500"><a href="/" class="hover:underline">← Kembali ke aplikasi</a></p>
    </div>
  </div>
</body>
</html>`;
}
