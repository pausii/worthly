// App shell (SPA Alpine). Tailwind + Alpine + Chart.js via CDN.
// Note: avoid `${` and backticks inside <script> since this file is a template literal.
export const appHtml = `<!doctype html>
<html lang="en" class="h-full">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
  <meta name="robots" content="noindex,nofollow" />
  <meta name="apple-mobile-web-app-capable" content="yes" />
  <meta name="apple-mobile-web-app-title" content="Wallet Tracker" />
  <meta name="theme-color" content="#4f46e5" />
  <link rel="manifest" href="/manifest.json" />
  <link rel="apple-touch-icon" href="/icon.svg" />
  <title>Dashboard — Wallet Tracker</title>
  <script>if(localStorage.getItem('theme')==='dark')document.documentElement.classList.add('dark')</script>
  <script src="https://cdn.tailwindcss.com"></script>
  <script>tailwind.config={darkMode:'class'}</script>
  <script defer src="https://cdn.jsdelivr.net/npm/chart.js@4.4.3/dist/chart.umd.min.js"></script>
  <script defer src="https://cdn.jsdelivr.net/npm/alpinejs@3.x.x/dist/cdn.min.js"></script>
  <style>
    [x-cloak]{display:none!important}
    ::-webkit-scrollbar{width:8px;height:8px}
    ::-webkit-scrollbar-thumb{background:#cbd5e1;border-radius:9999px}
    .dark ::-webkit-scrollbar-thumb{background:#475569}
    .theme-ready,.theme-ready *{transition:background-color .2s ease,border-color .2s ease,color .2s ease}
  </style>
</head>
<body class="h-full bg-slate-100 dark:bg-slate-900 text-slate-900 dark:text-slate-100 antialiased">
<div x-data="app()" x-init="init()" x-cloak class="flex h-full">

  <!-- Mobile overlay -->
  <div x-show="sidebarOpen" @click="sidebarOpen=false" class="fixed inset-0 z-20 bg-slate-900/50 lg:hidden"></div>

  <!-- Sidebar -->
  <aside class="fixed inset-y-0 left-0 z-30 flex w-64 flex-col bg-gradient-to-b from-indigo-700 via-indigo-700 to-violet-900 text-indigo-50 transition-transform lg:static lg:translate-x-0"
         :class="sidebarOpen ? 'translate-x-0' : '-translate-x-full'">
    <div class="flex items-center gap-3 px-5 pt-5 pb-4">
      <div class="flex h-10 w-10 items-center justify-center rounded-xl bg-white/10">
        <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M3 7h18M3 7l2 12a2 2 0 002 2h10a2 2 0 002-2l2-12M9 11v6m6-6v6"/></svg>
      </div>
      <div class="min-w-0">
        <div class="truncate text-[15px] font-semibold tracking-wide">Wallet Tracker</div>
        <div class="truncate text-[11px] text-indigo-200/80">Portfolio Console</div>
      </div>
    </div>
    <nav class="flex-1 space-y-1 overflow-y-auto px-3 pb-4">
      <template x-for="item in nav" :key="item.id">
        <button @click="go(item.id)"
          class="group flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-colors"
          :class="view===item.id ? 'bg-white/15 text-white shadow-sm' : 'text-indigo-100 hover:bg-white/10 hover:text-white'">
          <span x-html="item.icon" class="shrink-0"></span>
          <span class="truncate" x-text="item.label"></span>
        </button>
      </template>
    </nav>
    <div class="border-t border-white/10 px-4 py-4">
      <div class="flex items-center gap-3">
        <div class="flex h-9 w-9 items-center justify-center rounded-full bg-white/15 text-sm font-semibold" x-text="(username||'U').slice(0,2).toUpperCase()"></div>
        <div class="min-w-0 flex-1">
          <div class="truncate text-sm font-medium text-white" x-text="username"></div>
          <button @click="logout()" class="text-[11px] text-indigo-200/80 hover:text-white transition-colors">Sign Out</button>
        </div>
      </div>
    </div>
  </aside>

  <!-- Main -->
  <div class="flex min-w-0 flex-1 flex-col">
    <!-- Topbar -->
    <header class="sticky top-0 z-10 flex items-center gap-3 border-b border-slate-200 dark:border-slate-700 bg-white/80 dark:bg-slate-800/80 px-4 py-3 backdrop-blur lg:px-6">
      <button @click="sidebarOpen=!sidebarOpen" class="rounded-lg p-2 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 lg:hidden">
        <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M4 6h16M4 12h16M4 18h16"/></svg>
      </button>
      <h1 class="text-base font-semibold capitalize" x-text="navLabel()"></h1>
      <div class="ml-auto flex items-center gap-2">
        <!-- Total value + currency toggle -->
        <div class="hidden text-right sm:block">
          <div class="flex items-center justify-end gap-1.5">
            <div class="text-[11px] uppercase tracking-wide text-slate-400 dark:text-slate-500">Total Value</div>
            <button @click="toggleCurrency()"
              class="rounded-md px-1.5 py-0.5 text-[10px] font-semibold bg-indigo-100 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-200 dark:hover:bg-indigo-900/70"
              x-text="displayCurrency"></button>
          </div>
          <div class="text-sm font-semibold" x-text="fmtDisplay(overview.grandTotalUsd||0)"></div>
        </div>
        <!-- Dark mode toggle -->
        <button @click="toggleDark()" class="rounded-xl p-2 text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700" :title="darkMode?'Switch to light':'Switch to dark'">
          <svg x-show="!darkMode" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"/></svg>
          <svg x-show="darkMode" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z"/></svg>
        </button>
        <button @click="syncAll()" :disabled="syncing"
          class="flex items-center gap-2 rounded-xl bg-indigo-600 px-3 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-indigo-700 disabled:opacity-60">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" :class="syncing&&'animate-spin'" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/></svg>
          <span x-text="syncing ? 'Syncing…' : 'Sync'"></span>
        </button>
      </div>
    </header>

    <main class="flex-1 overflow-y-auto p-4 lg:p-6">
      <p x-show="toast" x-text="toast" class="mb-4 rounded-xl bg-indigo-50 dark:bg-indigo-900/40 px-4 py-2 text-sm text-indigo-700 dark:text-indigo-300"></p>

      <!-- DASHBOARD -->
      <section x-show="view==='dashboard'" class="space-y-6">
        <!-- Stat cards -->
        <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div class="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-5 shadow-sm">
            <div class="text-[11px] uppercase tracking-wide text-slate-400 dark:text-slate-500">Total Portfolio</div>
            <div class="mt-1 text-2xl font-semibold" x-text="fmtDisplay(overview.grandTotalUsd||0)"></div>
            <div x-show="displayCurrency==='IDR'" class="mt-0.5 text-xs text-slate-400 dark:text-slate-500" x-text="fmtUsd(overview.grandTotalUsd||0)"></div>
            <div x-show="overview.grandChangePct!==null&&overview.grandChangePct!==undefined" class="mt-1 text-xs font-medium" :class="pctClass(overview.grandChangePct)">
              <span x-text="fmtPct(overview.grandChangePct,true)"></span> <span class="font-normal text-slate-400 dark:text-slate-500">24h</span>
            </div>
          </div>
          <div class="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-5 shadow-sm">
            <div class="text-[11px] uppercase tracking-wide text-slate-400 dark:text-slate-500">Groups</div>
            <div class="mt-1 text-2xl font-semibold" x-text="overview.portfolios.length"></div>
          </div>
          <div class="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-5 shadow-sm">
            <div class="text-[11px] uppercase tracking-wide text-slate-400 dark:text-slate-500">Connected Accounts</div>
            <div class="mt-1 text-2xl font-semibold" x-text="accounts.length"></div>
          </div>
          <div class="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-5 shadow-sm">
            <div class="text-[11px] uppercase tracking-wide text-slate-400 dark:text-slate-500">Accounts with Errors</div>
            <div class="mt-1 text-2xl font-semibold text-rose-600 dark:text-rose-400" x-text="accounts.filter(a=>a.status==='error').length"></div>
          </div>
        </div>

        <!-- Charts row: line (2/3) + pie (1/3) -->
        <div class="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <!-- Value History -->
          <div class="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-5 shadow-sm lg:col-span-2">
            <div class="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div>
                <div class="flex items-center gap-2">
                  <h3 class="text-sm font-semibold">Value History</h3>
                  <template x-if="historyChange()">
                    <span class="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium"
                      :class="historyChange().up ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400' : 'bg-rose-100 dark:bg-rose-900/30 text-rose-700 dark:text-rose-400'">
                      <span x-text="(historyChange().up?'▲ +':'▼ ')+historyChange().pct.toFixed(2)+'%'"></span>
                      <span class="opacity-60" x-text="historyRange+'d'"></span>
                    </span>
                  </template>
                </div>
                <p class="text-xs text-slate-400 dark:text-slate-500">From periodic snapshots</p>
              </div>
              <div class="flex items-center gap-2">
                <select x-model="historyPortfolio" @change="loadHistory()" class="rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 px-2 py-1.5 text-xs">
                  <option value="">All portfolios</option>
                  <template x-for="p in portfolios" :key="p.id"><option :value="p.id" x-text="p.name"></option></template>
                </select>
                <select x-model.number="historyRange" @change="loadHistory()" class="rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 px-2 py-1.5 text-xs">
                  <option :value="7">7 days</option><option :value="30">30 days</option><option :value="90">90 days</option>
                </select>
              </div>
            </div>
            <div class="relative h-56"><div x-ref="chartWrap" class="w-full h-full"></div></div>
            <p x-show="history.length===0" class="mt-2 text-center text-xs text-slate-400 dark:text-slate-500">No snapshots yet. Data is generated automatically based on the interval.</p>
          </div>

          <!-- Asset Allocation pie -->
          <div class="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-5 shadow-sm">
            <div class="mb-4">
              <h3 class="text-sm font-semibold">Asset Allocation</h3>
              <p class="text-xs text-slate-400 dark:text-slate-500">By value across all portfolios</p>
            </div>
            <div class="relative h-56">
              <div x-ref="pieWrap" class="w-full h-full"></div>
              <div x-show="!hasPieData()" class="absolute inset-0 flex items-center justify-center text-xs text-slate-400 dark:text-slate-500">No assets yet.</div>
            </div>
          </div>
        </div>

        <!-- Portfolio cards -->
        <div class="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <template x-for="p in overview.portfolios" :key="p.id">
            <div class="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-5 shadow-sm">
              <div class="mb-3 flex items-center justify-between">
                <div>
                  <h3 class="text-sm font-semibold" x-text="p.name"></h3>
                  <p class="text-xs text-slate-400 dark:text-slate-500" x-text="p.description || ''"></p>
                </div>
                <div class="text-right">
                  <div class="text-lg font-semibold" x-text="fmtDisplay(p.totalUsd)"></div>
                  <div x-show="displayCurrency==='IDR'" class="text-xs text-slate-400 dark:text-slate-500" x-text="fmtUsd(p.totalUsd)"></div>
                  <div x-show="p.change24hPct!==null&&p.change24hPct!==undefined" class="text-xs font-medium" :class="pctClass(p.change24hPct)" x-text="fmtPct(p.change24hPct,true)+' 24h'"></div>
                </div>
              </div>
              <div class="space-y-1.5">
                <template x-for="a in p.assets.slice(0,8)" :key="a.asset+a.origin">
                  <div class="flex items-center justify-between text-sm">
                    <div class="flex items-center gap-2">
                      <span class="inline-flex h-5 items-center rounded-full px-2 text-[10px] font-medium"
                        :class="a.origin==='manual' ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400' : a.origin==='onchain' ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400' : 'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400'"
                        x-text="a.origin"></span>
                      <span class="font-medium" x-text="a.asset"></span>
                      <span class="text-slate-400 dark:text-slate-500" x-text="fmtNum(a.amount)"></span>
                    </div>
                    <div class="text-right">
                      <div class="text-slate-600 dark:text-slate-300" x-text="fmtDisplay(a.usd)"></div>
                      <div x-show="assetChg(a.asset)!==null" class="text-[10px] font-medium" :class="pctClass(assetChg(a.asset))" x-text="fmtPct(assetChg(a.asset),false)"></div>
                    </div>
                  </div>
                </template>
                <p x-show="p.assets.length===0" class="text-xs text-slate-400 dark:text-slate-500">No assets yet.</p>
              </div>
            </div>
          </template>
          <p x-show="overview.portfolios.length===0" class="text-sm text-slate-400 dark:text-slate-500">No portfolios yet. Create one in the Portfolios menu.</p>
        </div>
      </section>

      <!-- PORTFOLIOS -->
      <section x-show="view==='portfolios'" class="space-y-4">
        <div class="flex justify-end">
          <button @click="openPortfolioModal()" class="rounded-xl bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-700">+ Portfolio</button>
        </div>
        <div class="overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-sm">
          <table class="min-w-full divide-y divide-slate-100 dark:divide-slate-700 text-sm">
            <thead class="bg-slate-50 dark:bg-slate-700/50 text-left text-xs uppercase tracking-wide text-slate-400 dark:text-slate-500">
              <tr><th class="px-4 py-3">Name</th><th class="px-4 py-3">Description</th><th class="px-4 py-3 text-right">Actions</th></tr>
            </thead>
            <tbody class="divide-y divide-slate-100 dark:divide-slate-700">
              <template x-for="p in portfolios" :key="p.id">
                <tr>
                  <td class="px-4 py-3 font-medium" x-text="p.name"></td>
                  <td class="px-4 py-3 text-slate-500 dark:text-slate-400" x-text="p.description||'—'"></td>
                  <td class="px-4 py-3 text-right">
                    <button @click="openPortfolioModal(p)" class="text-xs text-indigo-600 dark:text-indigo-400 hover:underline">Edit</button>
                    <button @click="deletePortfolio(p.id)" class="ml-3 text-xs text-rose-600 dark:text-rose-400 hover:underline">Delete</button>
                  </td>
                </tr>
              </template>
              <tr x-show="portfolios.length===0"><td colspan="3" class="px-4 py-6 text-center text-slate-400 dark:text-slate-500">No portfolios yet.</td></tr>
            </tbody>
          </table>
        </div>
      </section>

      <!-- ACCOUNTS -->
      <section x-show="view==='accounts'" class="space-y-4">
        <div class="flex justify-end">
          <button @click="openAccountModal()" class="rounded-xl bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-700">+ Account</button>
        </div>
        <div class="grid grid-cols-1 gap-4 md:grid-cols-2">
          <template x-for="a in accounts" :key="a.id">
            <div class="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-4 shadow-sm">
              <div class="flex items-start justify-between">
                <div>
                  <div class="flex items-center gap-2">
                    <span class="rounded-md bg-slate-100 dark:bg-slate-700 px-2 py-0.5 text-[11px] font-semibold uppercase text-slate-600 dark:text-slate-300" x-text="a.type"></span>
                    <span class="font-medium" x-text="a.label"></span>
                  </div>
                  <div class="mt-1 text-xs text-slate-400 dark:text-slate-500" x-text="portfolioName(a.portfolio_id)"></div>
                </div>
                <span class="rounded-full px-2 py-0.5 text-[11px] font-medium"
                  :class="a.status==='ok' ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400' : a.status==='error' ? 'bg-rose-100 dark:bg-rose-900/30 text-rose-700 dark:text-rose-400' : 'bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400'"
                  x-text="a.status||'pending'"></span>
              </div>
              <div class="mt-2 text-xs text-slate-400 dark:text-slate-500">
                <span x-show="a.last_synced_at">Synced: <span x-text="timeAgo(a.last_synced_at)"></span></span>
                <span x-show="!a.last_synced_at">Never synced</span>
              </div>
              <p x-show="a.last_error" x-text="a.last_error" class="mt-2 rounded-lg bg-rose-50 dark:bg-rose-900/30 px-2 py-1 text-[11px] text-rose-600 dark:text-rose-400"></p>
              <div class="mt-3 flex gap-2">
                <button @click="syncAccount(a.id)" class="rounded-lg bg-slate-100 dark:bg-slate-700 px-3 py-1.5 text-xs font-medium hover:bg-slate-200 dark:hover:bg-slate-600">Sync</button>
                <button @click="openAccountModal(a)" class="rounded-lg bg-slate-100 dark:bg-slate-700 px-3 py-1.5 text-xs font-medium hover:bg-slate-200 dark:hover:bg-slate-600">Edit</button>
                <button @click="deleteAccount(a.id)" class="ml-auto rounded-lg px-3 py-1.5 text-xs font-medium text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-900/20">Delete</button>
              </div>
            </div>
          </template>
          <p x-show="accounts.length===0" class="text-sm text-slate-400 dark:text-slate-500">No accounts yet. Add a Binance/Bybit or on-chain wallet.</p>
        </div>
      </section>

      <!-- HOLDINGS -->
      <section x-show="view==='holdings'" class="space-y-4">
        <div class="flex justify-end">
          <button @click="openHoldingModal()" class="rounded-xl bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-700">+ Manual Holding</button>
        </div>
        <div class="overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-sm">
          <table class="min-w-full divide-y divide-slate-100 dark:divide-slate-700 text-sm">
            <thead class="bg-slate-50 dark:bg-slate-700/50 text-left text-xs uppercase tracking-wide text-slate-400 dark:text-slate-500">
              <tr><th class="px-4 py-3">Label</th><th class="px-4 py-3">Portfolio</th><th class="px-4 py-3">Asset</th><th class="px-4 py-3 text-right">Amount</th><th class="px-4 py-3">Added</th><th class="px-4 py-3 text-right">Actions</th></tr>
            </thead>
            <tbody class="divide-y divide-slate-100 dark:divide-slate-700">
              <template x-for="h in holdings" :key="h.id">
                <tr>
                  <td class="px-4 py-3 font-medium" x-text="h.label"></td>
                  <td class="px-4 py-3 text-slate-500 dark:text-slate-400" x-text="portfolioName(h.portfolio_id)"></td>
                  <td class="px-4 py-3"><span class="rounded bg-slate-100 dark:bg-slate-700 px-1.5 py-0.5 text-[11px]" x-text="h.currency"></span> <span class="text-[11px] text-slate-400 dark:text-slate-500" x-text="h.asset_class"></span></td>
                  <td class="px-4 py-3 text-right" x-text="fmtNum(h.amount)"></td>
                  <td class="px-4 py-3 text-sm text-slate-500 dark:text-slate-400" x-text="fmtDateOnly(h.added_at||h.created_at)"></td>
                  <td class="px-4 py-3 text-right">
                    <button @click="openHoldingModal(h)" class="text-xs text-indigo-600 dark:text-indigo-400 hover:underline">Edit</button>
                    <button @click="deleteHolding(h.id)" class="ml-3 text-xs text-rose-600 dark:text-rose-400 hover:underline">Delete</button>
                  </td>
                </tr>
              </template>
              <tr x-show="holdings.length===0"><td colspan="6" class="px-4 py-6 text-center text-slate-400 dark:text-slate-500">No manual holdings yet.</td></tr>
            </tbody>
          </table>
        </div>
      </section>

      <!-- DEPOSITS -->
      <section x-show="view==='deposits'" class="space-y-4">
        <div class="overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-sm">
          <table class="min-w-full divide-y divide-slate-100 dark:divide-slate-700 text-sm">
            <thead class="bg-slate-50 dark:bg-slate-700/50 text-left text-xs uppercase tracking-wide text-slate-400 dark:text-slate-500">
              <tr><th class="px-4 py-3">Time</th><th class="px-4 py-3">Account</th><th class="px-4 py-3">Asset</th><th class="px-4 py-3 text-right">Amount</th><th class="px-4 py-3">Network</th><th class="px-4 py-3">Status</th></tr>
            </thead>
            <tbody class="divide-y divide-slate-100 dark:divide-slate-700">
              <template x-for="d in deposits" :key="d.id">
                <tr>
                  <td class="px-4 py-3 text-slate-500 dark:text-slate-400" x-text="fmtDate(d.ts)"></td>
                  <td class="px-4 py-3"><span x-text="d.account_label"></span> <span class="text-[11px] text-slate-400 dark:text-slate-500" x-text="d.portfolio_name"></span></td>
                  <td class="px-4 py-3 font-medium" x-text="d.asset"></td>
                  <td class="px-4 py-3 text-right" x-text="fmtNum(d.amount)"></td>
                  <td class="px-4 py-3 text-slate-500 dark:text-slate-400" x-text="d.network||'—'"></td>
                  <td class="px-4 py-3"><span class="rounded-full px-2 py-0.5 text-[11px]" :class="d.status==='success'||d.status==='credited' ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400':'bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400'" x-text="d.status"></span></td>
                </tr>
              </template>
              <tr x-show="deposits.length===0"><td colspan="6" class="px-4 py-6 text-center text-slate-400 dark:text-slate-500">No deposit data yet.</td></tr>
            </tbody>
          </table>
        </div>
      </section>

      <!-- SETTINGS -->
      <section x-show="view==='settings'" class="max-w-md space-y-4">
        <div class="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-5 shadow-sm">
          <h3 class="mb-4 text-sm font-semibold">Change Password</h3>
          <form @submit.prevent="changePassword()" class="space-y-3">
            <input x-model="pw.current" type="password" placeholder="Current password"
              class="w-full rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 px-3 py-2.5 text-sm outline-none focus:border-indigo-500" />
            <input x-model="pw.next" type="password" placeholder="New password (min 10)"
              class="w-full rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 px-3 py-2.5 text-sm outline-none focus:border-indigo-500" />
            <button class="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700">Save</button>
          </form>
        </div>
        <div class="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-5 shadow-sm">
          <h3 class="mb-1 text-sm font-semibold">Export Data (CSV)</h3>
          <p class="mb-4 text-xs text-slate-400 dark:text-slate-500">Unduh data sebagai CSV (UTF-8, kompatibel Excel).</p>
          <div class="flex flex-wrap gap-2">
            <button @click="exportCsv('balances')" class="rounded-xl bg-slate-100 dark:bg-slate-700 px-3 py-2 text-sm font-medium hover:bg-slate-200 dark:hover:bg-slate-600">Balances</button>
            <button @click="exportCsv('holdings')" class="rounded-xl bg-slate-100 dark:bg-slate-700 px-3 py-2 text-sm font-medium hover:bg-slate-200 dark:hover:bg-slate-600">Manual Holdings</button>
            <button @click="exportCsv('snapshots')" class="rounded-xl bg-slate-100 dark:bg-slate-700 px-3 py-2 text-sm font-medium hover:bg-slate-200 dark:hover:bg-slate-600">Snapshots</button>
          </div>
        </div>
      </section>
    </main>
  </div>

  <!-- MODAL: Portfolio -->
  <div x-show="modal==='portfolio'" class="fixed inset-0 z-40 flex items-center justify-center p-4">
    <div @click="modal=null" class="absolute inset-0 bg-slate-900/50"></div>
    <div class="relative w-full max-w-md rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-6 shadow-xl">
      <h3 class="mb-4 text-base font-semibold" x-text="pf.id ? 'Edit Portfolio' : 'New Portfolio'"></h3>
      <form @submit.prevent="savePortfolio()" class="space-y-3">
        <input x-model="pf.name" placeholder="Name (e.g. my-cex)"
          class="w-full rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 px-3 py-2.5 text-sm outline-none focus:border-indigo-500" />
        <textarea x-model="pf.description" placeholder="Description" rows="2"
          class="w-full rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 px-3 py-2.5 text-sm outline-none focus:border-indigo-500"></textarea>
        <div class="flex justify-end gap-2 pt-2">
          <button type="button" @click="modal=null" class="rounded-xl px-4 py-2 text-sm text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700">Cancel</button>
          <button class="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700">Save</button>
        </div>
      </form>
    </div>
  </div>

  <!-- MODAL: Holding -->
  <div x-show="modal==='holding'" class="fixed inset-0 z-40 flex items-center justify-center p-4">
    <div @click="modal=null" class="absolute inset-0 bg-slate-900/50"></div>
    <div class="relative w-full max-w-md rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-6 shadow-xl">
      <h3 class="mb-4 text-base font-semibold" x-text="hd.id ? 'Edit Holding' : 'New Manual Holding'"></h3>
      <form @submit.prevent="saveHolding()" class="space-y-3">
        <select x-model.number="hd.portfolio_id"
          class="w-full rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 px-3 py-2.5 text-sm outline-none focus:border-indigo-500">
          <option value="">Select portfolio…</option>
          <template x-for="p in portfolios" :key="p.id"><option :value="p.id" x-text="p.name"></option></template>
        </select>
        <input x-model="hd.label" placeholder="Label (e.g. BCA Savings)"
          class="w-full rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 px-3 py-2.5 text-sm outline-none focus:border-indigo-500" />
        <div class="grid grid-cols-2 gap-3">
          <div>
            <label class="mb-1 block text-xs font-medium text-slate-500 dark:text-slate-400">Currency</label>
            <select x-model="hd.currency"
              class="w-full rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 px-3 py-2.5 text-sm outline-none focus:border-indigo-500">
              <option value="USD">USD (Default)</option>
              <option value="IDR">IDR</option>
              <option value="JPY">JPY</option>
              <option value="SGD">SGD</option>
            </select>
          </div>
          <div>
            <label class="mb-1 block text-xs font-medium text-slate-500 dark:text-slate-400">Date Added</label>
            <input x-model="hd.added_at" type="date"
              class="w-full rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 px-3 py-2.5 text-sm outline-none focus:border-indigo-500" />
          </div>
        </div>
        <input x-model.number="hd.amount" type="number" step="any" placeholder="Amount (e.g. 100000000)"
          class="w-full rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 px-3 py-2.5 text-sm outline-none focus:border-indigo-500" />
        <input x-model="hd.note" placeholder="Note (optional)"
          class="w-full rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 px-3 py-2.5 text-sm outline-none focus:border-indigo-500" />
        <div class="flex justify-end gap-2 pt-2">
          <button type="button" @click="modal=null" class="rounded-xl px-4 py-2 text-sm text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700">Cancel</button>
          <button class="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700">Save</button>
        </div>
      </form>
    </div>
  </div>

  <!-- MODAL: Account -->
  <div x-show="modal==='account'" class="fixed inset-0 z-40 flex items-center justify-center p-4">
    <div @click="modal=null" class="absolute inset-0 bg-slate-900/50"></div>
    <div class="relative max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-6 shadow-xl">
      <h3 class="mb-4 text-base font-semibold" x-text="ac.id ? 'Edit Account' : 'New Account'"></h3>
      <form @submit.prevent="saveAccount()" class="space-y-3">
        <div class="grid grid-cols-2 gap-3">
          <select x-model="ac.type" :disabled="ac.id"
            class="rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 px-3 py-2.5 text-sm outline-none focus:border-indigo-500 disabled:opacity-60">
            <option value="binance">Binance</option><option value="bybit">Bybit</option>
            <option value="eth">Ethereum</option><option value="bsc">BSC</option><option value="tron">Tron</option>
          </select>
          <select x-model.number="ac.portfolio_id"
            class="rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 px-3 py-2.5 text-sm outline-none focus:border-indigo-500">
            <option value="">Portfolio…</option>
            <template x-for="p in portfolios" :key="p.id"><option :value="p.id" x-text="p.name"></option></template>
          </select>
        </div>
        <input x-model="ac.label" placeholder="Label (e.g. Binance Main)"
          class="w-full rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 px-3 py-2.5 text-sm outline-none focus:border-indigo-500" />
        <template x-if="ac.type==='binance' || ac.type==='bybit'">
          <div class="space-y-3 rounded-xl bg-slate-50 dark:bg-slate-700/50 p-3">
            <p class="text-xs text-slate-500 dark:text-slate-400">Use a <b>read-only</b> API key (no trade/withdraw permissions). Key is stored encrypted.</p>
            <input x-model="ac.apiKey" :placeholder="ac.id ? 'API Key (leave blank to keep unchanged)' : 'API Key'"
              class="w-full rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 px-3 py-2.5 text-sm outline-none focus:border-indigo-500" />
            <input x-model="ac.apiSecret" type="password" :placeholder="ac.id ? 'API Secret (leave blank to keep unchanged)' : 'API Secret'"
              class="w-full rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 px-3 py-2.5 text-sm outline-none focus:border-indigo-500" />
          </div>
        </template>
        <template x-if="ac.type==='eth' || ac.type==='bsc' || ac.type==='tron'">
          <div class="space-y-3 rounded-xl bg-slate-50 dark:bg-slate-700/50 p-3">
            <p class="text-xs text-slate-500 dark:text-slate-400">Enter your wallet address. RPC URL is optional when defaults are configured in the worker environment.</p>
            <input x-model="ac.address" placeholder="Wallet address (0x… or T…)"
              class="w-full rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 px-3 py-2.5 text-sm outline-none focus:border-indigo-500" />
            <input x-model="ac.rpcUrl" placeholder="RPC URL (optional)"
              class="w-full rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 px-3 py-2.5 text-sm outline-none focus:border-indigo-500" />
            <p class="text-xs font-medium text-slate-600 dark:text-slate-400">Assets to track:</p>
            <label class="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300 cursor-pointer">
              <input type="checkbox" x-model="ac.trackNative" class="h-4 w-4 rounded accent-indigo-600" />
              <span x-text="nativeSymbol()+' (native coin)'"></span>
            </label>
            <div class="flex flex-wrap gap-x-5 gap-y-2">
              <template x-for="t in (TOKEN_PRESETS[ac.type]||[])" :key="t.symbol">
                <label class="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300 cursor-pointer">
                  <input type="checkbox" x-model="ac.tokens" :value="t.symbol" class="h-4 w-4 rounded accent-indigo-600" />
                  <span x-text="t.symbol"></span>
                </label>
              </template>
            </div>
            <template x-if="ac.type==='eth' || ac.type==='bsc'">
              <label class="flex items-start gap-2 text-sm text-slate-700 dark:text-slate-300 cursor-pointer border-t border-slate-200 dark:border-slate-600 pt-3">
                <input type="checkbox" x-model="ac.autoDetect" class="mt-0.5 h-4 w-4 rounded accent-indigo-600" />
                <span>Auto-deteksi semua token <span class="text-slate-400 dark:text-slate-500">(ERC-20/BEP-20 non-zero, via Alchemy)</span></span>
              </label>
            </template>
          </div>
        </template>
        <p x-show="ac.error" x-text="ac.error" class="rounded-lg bg-rose-50 dark:bg-rose-900/30 px-3 py-2 text-sm text-rose-600 dark:text-rose-400"></p>
        <div class="flex justify-end gap-2 pt-2">
          <button type="button" @click="modal=null" class="rounded-xl px-4 py-2 text-sm text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700">Cancel</button>
          <button class="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700">Save</button>
        </div>
      </form>
    </div>
  </div>

  <script>
    requestAnimationFrame(()=>requestAnimationFrame(()=>document.body.classList.add('theme-ready')));

    function app() {
      return {
        view: 'dashboard', sidebarOpen: false, csrf: '', username: '',
        syncing: false, toast: '', modal: null,
        darkMode: document.documentElement.classList.contains('dark'),
        displayCurrency: localStorage.getItem('currency') || 'USD',
        idrRate: 0,
        nav: [
          { id:'dashboard', label:'Dashboard', icon:'<svg xmlns=\\'http://www.w3.org/2000/svg\\' class=\\'h-5 w-5\\' fill=\\'none\\' viewBox=\\'0 0 24 24\\' stroke=\\'currentColor\\' stroke-width=\\'2\\'><path stroke-linecap=\\'round\\' stroke-linejoin=\\'round\\' d=\\'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6\\'/></svg>' },
          { id:'portfolios', label:'Portfolios', icon:'<svg xmlns=\\'http://www.w3.org/2000/svg\\' class=\\'h-5 w-5\\' fill=\\'none\\' viewBox=\\'0 0 24 24\\' stroke=\\'currentColor\\' stroke-width=\\'2\\'><path stroke-linecap=\\'round\\' stroke-linejoin=\\'round\\' d=\\'M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10\\'/></svg>' },
          { id:'accounts', label:'Accounts', icon:'<svg xmlns=\\'http://www.w3.org/2000/svg\\' class=\\'h-5 w-5\\' fill=\\'none\\' viewBox=\\'0 0 24 24\\' stroke=\\'currentColor\\' stroke-width=\\'2\\'><path stroke-linecap=\\'round\\' stroke-linejoin=\\'round\\' d=\\'M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-2m-3-7h6m-3-3v6\\'/></svg>' },
          { id:'holdings', label:'Manual Holdings', icon:'<svg xmlns=\\'http://www.w3.org/2000/svg\\' class=\\'h-5 w-5\\' fill=\\'none\\' viewBox=\\'0 0 24 24\\' stroke=\\'currentColor\\' stroke-width=\\'2\\'><path stroke-linecap=\\'round\\' stroke-linejoin=\\'round\\' d=\\'M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1\\'/></svg>' },
          { id:'deposits', label:'Deposits', icon:'<svg xmlns=\\'http://www.w3.org/2000/svg\\' class=\\'h-5 w-5\\' fill=\\'none\\' viewBox=\\'0 0 24 24\\' stroke=\\'currentColor\\' stroke-width=\\'2\\'><path stroke-linecap=\\'round\\' stroke-linejoin=\\'round\\' d=\\'M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4\\'/></svg>' },
          { id:'settings', label:'Settings', icon:'<svg xmlns=\\'http://www.w3.org/2000/svg\\' class=\\'h-5 w-5\\' fill=\\'none\\' viewBox=\\'0 0 24 24\\' stroke=\\'currentColor\\' stroke-width=\\'2\\'><path stroke-linecap=\\'round\\' stroke-linejoin=\\'round\\' d=\\'M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z\\'/><path stroke-linecap=\\'round\\' stroke-linejoin=\\'round\\' d=\\'M15 12a3 3 0 11-6 0 3 3 0 016 0z\\'/></svg>' }
        ],
        overview: { portfolios: [], grandTotalUsd: 0 },
        portfolios: [], accounts: [], holdings: [], deposits: [],
        history: [], historyRange: 30, historyPortfolio: '', chart: null, pieChart: null,
        pf: { id:null, name:'', description:'' },
        hd: { id:null, portfolio_id:'', label:'', currency:'USD', amount:null, note:'', added_at:'' },
        ac: { id:null, type:'binance', portfolio_id:'', label:'', apiKey:'', apiSecret:'', address:'', rpcUrl:'', trackNative:true, tokens:[], autoDetect:false, error:'' },
        pw: { current:'', next:'' },
        // Preset token per jaringan. Simbol disimpan sesuai harga (BTC/ETH), bukan nama on-chain (BTCB).
        TOKEN_PRESETS: {
          eth:[
            {symbol:'USDT',contract:'0xdAC17F958D2ee523a2206206994597C13D831ec7',decimals:6},
            {symbol:'BTC',contract:'0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599',decimals:8}
          ],
          bsc:[
            {symbol:'USDT',contract:'0x55d398326f99059fF775485246999027B3197955',decimals:18},
            {symbol:'BTC',contract:'0x7130d2A12B9BCbFAe4f2634d864A1Ee1Ce3Ead9c',decimals:18},
            {symbol:'ETH',contract:'0x2170Ed0880ac9A755fd29B2688956BD959F933F8',decimals:18}
          ],
          tron:[
            {symbol:'USDT',contract:'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t',decimals:6},
            {symbol:'BTC',contract:'TN3W4H6rK2ce4vX9YnFQHwKENnHjoxb3m9',decimals:8},
            {symbol:'ETH',contract:'THb4CqiFdwNHsWsQCs4JhzwjMWys4aqCbF',decimals:18}
          ]
        },

        async init() {
          if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js').catch(()=>{});
          const VIEWS = ['dashboard','portfolios','accounts','holdings','deposits','settings'];
          const hash = window.location.hash.slice(1);
          if (VIEWS.includes(hash)) this.view = hash;
          window.addEventListener('hashchange', () => {
            const h = window.location.hash.slice(1);
            if (VIEWS.includes(h) && h !== this.view) {
              this.view = h;
              if (h === 'dashboard') this.$nextTick(()=>{ this.renderChart(); this.renderPieChart(); });
            }
          });
          const me = await this.api('GET','/auth/me');
          if (!me) return;
          this.csrf = me.data.csrf; this.username = me.data.username;
          await this.loadPortfolios();
          await Promise.all([this.loadOverview(), this.loadAccounts(), this.loadHoldings(), this.loadDeposits()]);
          await this.loadHistory();
        },

        toggleDark() {
          this.darkMode = !this.darkMode;
          document.documentElement.classList.toggle('dark', this.darkMode);
          localStorage.setItem('theme', this.darkMode ? 'dark' : 'light');
          if (this.view === 'dashboard') this.$nextTick(()=>{ this.renderChart(); this.renderPieChart(); });
        },

        toggleCurrency() {
          this.displayCurrency = this.displayCurrency === 'USD' ? 'IDR' : 'USD';
          localStorage.setItem('currency', this.displayCurrency);
          if (this.view === 'dashboard') this.$nextTick(()=>{ this.renderChart(); this.renderPieChart(); });
        },

        async api(method, path, body) {
          const opts = { method, headers: {} };
          if (body !== undefined) { opts.headers['Content-Type']='application/json'; opts.body=JSON.stringify(body); }
          if (method !== 'GET') opts.headers['X-CSRF-Token'] = this.csrf;
          const res = await fetch('/api'+path, opts);
          if (res.status === 401) { location.href='/login'; return null; }
          const data = await res.json().catch(()=>({ ok:false, error:'Invalid response' }));
          return data;
        },

        go(id) {
          this.view = id; this.sidebarOpen = false;
          window.location.hash = id;
          if (id==='dashboard') this.$nextTick(()=>{ this.renderChart(); this.renderPieChart(); });
        },
        navLabel() { const n=this.nav.find(x=>x.id===this.view); return n?n.label:''; },
        portfolioName(id) { const p=this.portfolios.find(x=>x.id===id); return p?p.name:'—'; },
        flash(msg) { this.toast = msg; setTimeout(()=>{ this.toast=''; }, 3000); },
        hasPieData() { return this.overview.portfolios.some(p=>p.assets.length>0); },
        historyChange() {
          const h=this.history; if(!h||h.length<2) return null;
          const first=Number(h[0].total_usd)||0, last=Number(h[h.length-1].total_usd)||0;
          if(first===0) return null;
          const abs=last-first; return { pct:(abs/first)*100, abs, up:abs>=0 };
        },
        fmtAxis(v) {
          const n=Number(v)||0, a=Math.abs(n);
          const t=(x)=>{ const s=x.toFixed(1); return s.endsWith('.0')?s.slice(0,-2):s; };
          if (this.displayCurrency==='IDR') {
            if(a>=1e12) return 'Rp '+t(n/1e12)+'T';
            if(a>=1e9) return 'Rp '+t(n/1e9)+'M';
            if(a>=1e6) return 'Rp '+t(n/1e6)+'jt';
            if(a>=1e3) return 'Rp '+Math.round(n/1e3)+'rb';
            return 'Rp '+Math.round(n);
          }
          if(a>=1e9) return '$'+t(n/1e9)+'B';
          if(a>=1e6) return '$'+t(n/1e6)+'M';
          if(a>=1e3) return '$'+t(n/1e3)+'k';
          return '$'+n.toFixed(0);
        },
        pctClass(p) { return (Number(p)||0)>=0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'; },
        fmtPct(p, withArrow) {
          const v=Number(p); if(!isFinite(v)) return '';
          const arrow = withArrow ? (v>=0?'▲ ':'▼ ') : '';
          return arrow+(v>=0?'+':'')+v.toFixed(2)+'%';
        },
        assetChg(sym) { const m=this.overview.assetChange; return (m && m[sym]!==undefined) ? m[sym] : null; },

        fmtUsd(n) { return '$'+(Number(n)||0).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2}); },
        fmtNum(n) { const v=Number(n)||0; return v.toLocaleString('en-US',{maximumFractionDigits:8}); },
        fmtDate(ts) { if(!ts) return '—'; return new Date(Number(ts)).toLocaleString('en-US'); },
        fmtDateOnly(ts) { if(!ts) return '—'; return new Date(Number(ts)).toLocaleDateString('en-US',{year:'numeric',month:'short',day:'numeric'}); },
        toDateInput(ts) { const d=ts?new Date(Number(ts)):new Date(); return new Date(d.getTime()-d.getTimezoneOffset()*60000).toISOString().slice(0,10); },
        timeAgo(ts) { if(!ts) return '—'; const s=Math.floor((Date.now()-Number(ts))/1000); if(s<60) return s+'s ago'; if(s<3600) return Math.floor(s/60)+'m ago'; if(s<86400) return Math.floor(s/3600)+'h ago'; return Math.floor(s/86400)+'d ago'; },
        fmtDisplay(usd) {
          const v = Number(usd)||0;
          if (this.displayCurrency === 'IDR') return 'Rp ' + Math.round(v * (this.idrRate||0)).toLocaleString('en-US');
          return '$' + v.toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2});
        },

        async loadOverview() {
          const r = await this.api('GET','/dashboard/overview');
          if (r&&r.ok) {
            this.overview = r.data;
            this.idrRate = r.data.idrRate || 0;
            this.$nextTick(()=>this.renderPieChart());
          }
        },
        async loadPortfolios() { const r=await this.api('GET','/portfolios'); if(r&&r.ok) this.portfolios=r.data; },
        async loadAccounts() { const r=await this.api('GET','/accounts'); if(r&&r.ok) this.accounts=r.data; },
        async loadHoldings() { const r=await this.api('GET','/holdings'); if(r&&r.ok) this.holdings=r.data; },
        async loadDeposits() { const r=await this.api('GET','/dashboard/deposits'); if(r&&r.ok) this.deposits=r.data; },
        async loadHistory() {
          const q = '/dashboard/history?days='+this.historyRange+(this.historyPortfolio?('&portfolio_id='+this.historyPortfolio):'');
          const r = await this.api('GET', q);
          if (r&&r.ok) { this.history=r.data; this.$nextTick(()=>this.renderChart()); }
        },

        renderChart() {
          const wrap = this.$refs.chartWrap;
          if (!wrap || typeof Chart==='undefined' || !wrap.isConnected) return;
          if (wrap.clientWidth === 0) { setTimeout(()=>this.renderChart(), 100); return; }
          const dark = this.darkMode;
          const textColor = dark ? '#94a3b8' : '#64748b';
          const gridColor = dark ? 'rgba(148,163,184,0.14)' : 'rgba(100,116,139,0.14)';
          const currency = this.displayCurrency;
          const idrMult = currency === 'IDR' ? (this.idrRate||0) : 1;
          let labels = this.history.map(h=>new Date(Number(h.captured_at)).toLocaleDateString('en-US',{day:'2-digit',month:'short'}));
          let data = this.history.map(h=>Number(h.total_usd)*idrMult);
          // Downsample agar garis halus & ringan untuk rentang panjang.
          const MAX=150;
          if (data.length>MAX) {
            const step=(data.length-1)/(MAX-1), nl=[], nd=[];
            for (let i=0;i<MAX;i++){ const idx=Math.round(i*step); nl.push(labels[idx]); nd.push(data[idx]); }
            labels=nl; data=nd;
          }
          if (this.chart) { this.chart.destroy(); this.chart = null; }
          wrap.innerHTML = '';
          const el = document.createElement('canvas');
          wrap.appendChild(el);
          const g = el.getContext('2d').createLinearGradient(0,0,0,wrap.clientHeight||220);
          g.addColorStop(0,'rgba(99,102,241,0.35)'); g.addColorStop(1,'rgba(99,102,241,0)');
          const self = this;
          this.chart = new Chart(el, {
            type:'line',
            data:{ labels, datasets:[{ label:currency, data, borderColor:'#6366f1', backgroundColor:g, fill:true, tension:0.35, borderWidth:2, pointRadius:0, pointHoverRadius:5, pointHoverBackgroundColor:'#6366f1', pointHoverBorderColor:dark?'#1e293b':'#fff', pointHoverBorderWidth:2 }] },
            options:{
              animation:false, responsive:true, maintainAspectRatio:false,
              interaction:{ mode:'index', intersect:false },
              plugins:{
                legend:{ display:false },
                tooltip:{ backgroundColor:dark?'#0f172a':'#ffffff', titleColor:textColor, bodyColor:dark?'#e2e8f0':'#0f172a', borderColor:gridColor, borderWidth:1, padding:10, displayColors:false,
                  callbacks:{ label:(c)=> currency==='IDR' ? 'Rp '+Math.round(c.parsed.y).toLocaleString('en-US') : '$'+c.parsed.y.toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2}) } }
              },
              scales:{
                y:{ ticks:{ color:textColor, maxTicksLimit:5, callback:(v)=>self.fmtAxis(v) }, grid:{ color:gridColor }, border:{ display:false } },
                x:{ ticks:{ color:textColor, maxTicksLimit:7, autoSkip:true, maxRotation:0 }, grid:{ display:false }, border:{ display:false } }
              }
            }
          });
        },

        renderPieChart() {
          const wrap = this.$refs.pieWrap;
          if (!wrap || typeof Chart==='undefined' || !wrap.isConnected) return;
          if (wrap.clientWidth === 0) { setTimeout(()=>this.renderPieChart(), 100); return; }
          const totals = {};
          for (const p of this.overview.portfolios) {
            for (const a of p.assets) { totals[a.asset] = (totals[a.asset]||0) + a.usd; }
          }
          const entries = Object.entries(totals).sort((a,b)=>b[1]-a[1]);
          if (this.pieChart) { this.pieChart.destroy(); this.pieChart = null; }
          if (entries.length === 0) return;
          const top = entries.slice(0,8);
          const othersVal = entries.slice(8).reduce((s,e)=>s+e[1], 0);
          if (othersVal > 0) top.push(['Others', othersVal]);
          const labels = top.map(e=>e[0]);
          const data = top.map(e=>e[1]);
          const COLORS = ['#6366f1','#8b5cf6','#f59e0b','#10b981','#ef4444','#3b82f6','#f97316','#ec4899','#14b8a6','#a855f7'];
          const dark = this.darkMode;
          const textColor = dark ? '#94a3b8' : '#64748b';
          const currency = this.displayCurrency;
          const idrRate = this.idrRate;
          const self = this;
          const centerText = {
            id:'centerText',
            afterDraw(chart){
              const {ctx, chartArea}=chart; if(!chartArea) return;
              const cx=(chartArea.left+chartArea.right)/2, cy=(chartArea.top+chartArea.bottom)/2;
              const sum=chart.data.datasets[0].data.reduce((s,v)=>s+v,0);
              const disp=currency==='IDR'? sum*(idrRate||0) : sum;
              ctx.save(); ctx.textAlign='center'; ctx.textBaseline='middle';
              ctx.fillStyle=textColor; ctx.font='10px ui-sans-serif,system-ui,sans-serif';
              ctx.fillText('Total', cx, cy-9);
              ctx.fillStyle=dark?'#e2e8f0':'#0f172a'; ctx.font='600 15px ui-sans-serif,system-ui,sans-serif';
              ctx.fillText(self.fmtAxis(disp), cx, cy+8);
              ctx.restore();
            }
          };
          wrap.innerHTML = '';
          const el = document.createElement('canvas');
          wrap.appendChild(el);
          this.pieChart = new Chart(el, {
            type:'doughnut',
            plugins:[centerText],
            data:{ labels, datasets:[{ data, backgroundColor:COLORS.slice(0,labels.length), borderWidth:2, borderColor:dark?'#1e293b':'#ffffff', borderRadius:3, hoverOffset:6 }] },
            options:{
              animation:false, responsive:true, maintainAspectRatio:false, cutout:'62%',
              plugins:{
                legend:{ position:'bottom', labels:{ color:textColor, padding:8, font:{ size:10 }, boxWidth:10, boxHeight:10 } },
                tooltip:{
                  callbacks:{
                    label:(ctx)=>{
                      const usd = ctx.parsed;
                      const total = ctx.dataset.data.reduce((s,v)=>s+v, 0);
                      const pct = total > 0 ? ((usd/total)*100).toFixed(1) : '0.0';
                      const fmt = currency==='IDR' ? 'Rp '+Math.round(usd*(idrRate||0)).toLocaleString('en-US') : '$'+usd.toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2});
                      return ' '+ctx.label+': '+fmt+' ('+pct+'%)';
                    }
                  }
                }
              }
            }
          });
        },

        async syncAll() {
          this.syncing=true;
          const r=await this.api('POST','/dashboard/sync', {});
          this.syncing=false;
          if (r&&r.ok) { this.flash('Sync complete ('+r.data.synced+' accounts)'); await Promise.all([this.loadOverview(),this.loadAccounts(),this.loadDeposits(),this.loadHistory()]); }
          else this.flash('Sync failed');
        },
        async syncAccount(id) {
          const r=await this.api('POST','/accounts/'+id+'/sync', {});
          if (r&&r.ok) { this.flash('Account synced'); await Promise.all([this.loadAccounts(),this.loadOverview()]); }
        },

        openPortfolioModal(p) { this.pf = p ? { id:p.id, name:p.name, description:p.description||'' } : { id:null, name:'', description:'' }; this.modal='portfolio'; },
        async savePortfolio() {
          const body={ name:this.pf.name, description:this.pf.description };
          const r = this.pf.id ? await this.api('PUT','/portfolios/'+this.pf.id, body) : await this.api('POST','/portfolios', body);
          if (r&&r.ok) { this.modal=null; await this.loadPortfolios(); await this.loadOverview(); } else if(r) this.flash(r.error);
        },
        async deletePortfolio(id) { if(!confirm('Delete this portfolio and all its contents?')) return; const r=await this.api('DELETE','/portfolios/'+id); if(r&&r.ok){ await this.loadPortfolios(); await this.loadOverview(); } },

        openHoldingModal(h) { this.hd = h ? { id:h.id, portfolio_id:h.portfolio_id, label:h.label, currency:h.currency||'USD', amount:h.amount, note:h.note||'', added_at:this.toDateInput(h.added_at||h.created_at) } : { id:null, portfolio_id:(this.portfolios[0]&&this.portfolios[0].id)||'', label:'', currency:'USD', amount:null, note:'', added_at:this.toDateInput(null) }; this.modal='holding'; },
        async saveHolding() {
          const body={ portfolio_id:this.hd.portfolio_id, label:this.hd.label, currency:this.hd.currency, amount:this.hd.amount, note:this.hd.note, added_at:this.hd.added_at?new Date(this.hd.added_at).getTime():null };
          const r = this.hd.id ? await this.api('PUT','/holdings/'+this.hd.id, body) : await this.api('POST','/holdings', body);
          if (r&&r.ok) { this.modal=null; await this.loadHoldings(); await this.loadOverview(); } else if(r) this.flash(r.error);
        },
        async deleteHolding(id) { if(!confirm('Delete this holding?')) return; const r=await this.api('DELETE','/holdings/'+id); if(r&&r.ok){ await this.loadHoldings(); await this.loadOverview(); } },

        nativeSymbol() {
          if (this.ac.type==='eth') return 'ETH';
          if (this.ac.type==='bsc') return 'BNB';
          if (this.ac.type==='tron') return 'TRX';
          return '';
        },

        openAccountModal(a) {
          if (a) {
            const cfg = a.config || {};
            const presets = this.TOKEN_PRESETS[a.type]||[];
            const tokens = presets.filter(t=>(cfg.tokens||[]).some(ct=>(ct.contract||'').toLowerCase()===t.contract.toLowerCase())).map(t=>t.symbol);
            this.ac = { id:a.id, type:a.type, portfolio_id:a.portfolio_id, label:a.label, apiKey:'', apiSecret:'', address:cfg.address||'', rpcUrl:'', trackNative:cfg.trackNative!==false, tokens, autoDetect:cfg.autoDetect===true, error:'' };
          } else {
            this.ac = { id:null, type:'binance', portfolio_id:(this.portfolios[0]&&this.portfolios[0].id)||'', label:'', apiKey:'', apiSecret:'', address:'', rpcUrl:'', trackNative:true, tokens:[], autoDetect:false, error:'' };
          }
          this.modal='account';
        },
        async saveAccount() {
          this.ac.error='';
          const body={ type:this.ac.type, portfolio_id:this.ac.portfolio_id, label:this.ac.label };
          if (this.ac.type==='binance'||this.ac.type==='bybit') { if(this.ac.apiKey) body.apiKey=this.ac.apiKey; if(this.ac.apiSecret) body.apiSecret=this.ac.apiSecret; }
          else {
            body.address=this.ac.address; body.trackNative=this.ac.trackNative;
            body.autoDetect=this.ac.autoDetect;
            const presets = this.TOKEN_PRESETS[this.ac.type]||[];
            body.tokens = presets.filter(t=>this.ac.tokens.includes(t.symbol));
            if (this.ac.rpcUrl) body.rpcUrl=this.ac.rpcUrl;
          }
          const r = this.ac.id ? await this.api('PUT','/accounts/'+this.ac.id, body) : await this.api('POST','/accounts', body);
          if (r&&r.ok) { this.modal=null; await this.loadAccounts(); if(this.ac.id===null && r.data.id){ await this.syncAccount(r.data.id);} } else if(r) this.ac.error=r.error;
        },
        async deleteAccount(id) { if(!confirm('Delete this account?')) return; const r=await this.api('DELETE','/accounts/'+id); if(r&&r.ok){ await this.loadAccounts(); await this.loadOverview(); } },

        async changePassword() {
          if (this.pw.next.length<10) { this.flash('New password must be at least 10 characters'); return; }
          const r=await this.api('POST','/auth/change-password', { current:this.pw.current, next:this.pw.next });
          if (r&&r.ok) { this.pw={current:'',next:''}; this.flash('Password changed successfully'); } else if(r) this.flash(r.error);
        },
        async exportCsv(type) {
          const res = await fetch('/api/export/'+type+'.csv');
          if (res.status===401) { location.href='/login'; return; }
          if (!res.ok) { this.flash('Export gagal'); return; }
          const blob = await res.blob();
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a'); a.href=url; a.download=type+'.csv';
          document.body.appendChild(a); a.click(); a.remove();
          setTimeout(()=>URL.revokeObjectURL(url), 1000);
        },
        async logout() { await this.api('POST','/auth/logout', {}); location.href='/login'; }
      };
    }
  </script>
</div>
</body>
</html>`;
