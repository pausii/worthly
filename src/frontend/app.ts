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
  <meta name="app-version" content="__APP_VERSION__" />
  <link rel="manifest" href="/manifest.json" />
  <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
  <link rel="apple-touch-icon" href="/favicon.svg" />
  <title>Dashboard — Wallet Tracker</title>
  <link rel="stylesheet" href="/app.css" />
  <script nonce="__CSP_NONCE__">if(localStorage.getItem('theme')==='dark')document.documentElement.classList.add('dark');
    window.addEventListener('beforeinstallprompt',function(e){e.preventDefault();window.__bip=e;window.dispatchEvent(new Event('bip-ready'));});</script>
  <script defer src="/vendor/apexcharts.js"></script>
  <script defer src="/vendor/alpine.js"></script>
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

  <!-- Sidebar (desktop only; mobile pakai bottom nav) -->
  <aside class="hidden w-64 flex-col bg-gradient-to-b from-indigo-700 via-indigo-700 to-violet-900 text-indigo-50 lg:flex">
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
          <span class="truncate flex-1" x-text="item.label"></span>
          <span x-show="item.id==='activity' && unreadCount>0" x-text="unreadCount > 99 ? '99+' : unreadCount"
            class="shrink-0 rounded-full bg-rose-500 px-1.5 py-0.5 text-[10px] font-bold text-white leading-none"></span>
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
        <!-- Activity / notifications bell -->
        <button @click="go('activity')" class="relative rounded-xl p-2 text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700" title="Activity">
          <svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"/></svg>
          <span x-show="unreadCount>0" x-text="unreadCount > 9 ? '9+' : unreadCount"
            class="absolute -top-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-rose-500 text-[9px] font-bold text-white leading-none"></span>
        </button>
        <!-- Hide amounts toggle -->
        <button @click="toggleHideAmounts()" class="rounded-xl p-2 text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700" :title="hideAmounts?'Tampilkan nominal':'Sembunyikan nominal'">
          <svg x-show="!hideAmounts" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/><path stroke-linecap="round" stroke-linejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/></svg>
          <svg x-show="hideAmounts" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21"/></svg>
        </button>
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

    <main class="flex-1 overflow-y-auto p-4 pb-24 lg:p-6 lg:pb-6">
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
                      <span class="relative h-5 w-5 shrink-0">
                        <span class="absolute inset-0 rounded-full flex items-center justify-center text-[8px] font-semibold text-white" :style="'background:'+tokenGradient(a.asset)" x-text="tokenInitial(a.asset)"></span>
                        <img :src="tokenIcon(a.asset)" class="absolute inset-0 h-5 w-5 rounded-full object-cover" @error="$el.style.display='none'" alt="">
                      </span>
                      <span class="font-medium" x-text="a.asset"></span>
                      <span class="text-slate-400 dark:text-slate-500" x-text="fmtNum(a.amount)"></span>
                    </div>
                    <div class="text-right">
                      <div :class="a.usd<0 ? 'text-rose-600 dark:text-rose-400' : 'text-slate-600 dark:text-slate-300'" x-text="fmtDisplay(a.usd)"></div>
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

      <!-- ANALYSIS -->
      <section x-show="view==='analysis'" class="space-y-6">
        <!-- Period filter -->
        <div class="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 class="text-sm font-semibold">Performance</h2>
            <p class="text-xs text-slate-400 dark:text-slate-500">Portfolio value movement & allocation</p>
          </div>
          <div class="flex flex-wrap gap-1 rounded-xl bg-slate-100 dark:bg-slate-800 p-1">
            <template x-for="p in PERIODS" :key="p.k">
              <button @click="setPeriod(p.k)"
                class="rounded-lg px-3 py-1.5 text-xs font-medium transition-colors"
                :class="analysisPeriod===p.k ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-sm' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'"
                x-text="p.k==='ALL'?'All':p.k"></button>
            </template>
          </div>
        </div>

        <!-- Performance summary -->
        <div class="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <div class="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-5 shadow-sm">
            <div class="text-[11px] uppercase tracking-wide text-slate-400 dark:text-slate-500">Period Change</div>
            <div class="mt-1 text-lg font-semibold" :class="perf().pct===null ? 'text-slate-400 dark:text-slate-500' : pctClass(perf().pct)" x-text="perf().pct===null ? '—' : fmtPct(perf().pct,true)"></div>
            <div class="text-xs" :class="pctClass(perf().abs)" x-show="perf().has" x-text="(perf().abs>=0?'+':'')+fmtDisplay(perf().abs)"></div>
          </div>
          <div class="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-5 shadow-sm">
            <div class="text-[11px] uppercase tracking-wide text-slate-400 dark:text-slate-500">Start Value</div>
            <div class="mt-1 text-lg font-semibold" x-text="perf().has ? fmtDisplay(perf().start) : '—'"></div>
          </div>
          <div class="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-5 shadow-sm">
            <div class="text-[11px] uppercase tracking-wide text-slate-400 dark:text-slate-500">Peak</div>
            <div class="mt-1 text-lg font-semibold text-emerald-600 dark:text-emerald-400" x-text="perf().has ? fmtDisplay(perf().peak) : '—'"></div>
          </div>
          <div class="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-5 shadow-sm">
            <div class="text-[11px] uppercase tracking-wide text-slate-400 dark:text-slate-500">Low</div>
            <div class="mt-1 text-lg font-semibold text-rose-600 dark:text-rose-400" x-text="perf().has ? fmtDisplay(perf().low) : '—'"></div>
          </div>
        </div>

        <!-- Value over time -->
        <div class="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-5 shadow-sm">
          <div class="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h3 class="text-sm font-semibold">Value Over Time</h3>
            <div class="flex gap-1 rounded-xl bg-slate-100 dark:bg-slate-800 p-1">
              <button @click="setValueMode('snapshot')"
                class="rounded-lg px-3 py-1 text-xs font-medium transition-colors"
                :class="valueMode==='snapshot' ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-sm' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'">Snapshots</button>
              <button @click="setValueMode('holdings')"
                class="rounded-lg px-3 py-1 text-xs font-medium transition-colors"
                :class="valueMode==='holdings' ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-sm' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'">Holdings (sim)</button>
            </div>
          </div>
          <p x-show="valueMode==='holdings'" class="mb-3 text-xs text-slate-400 dark:text-slate-500">Simulated: your current holdings &times; historical prices (not your actual past balance).</p>
          <div class="relative h-64">
            <div x-ref="anaChartWrap" class="w-full h-full"></div>
            <div x-show="analysisHistory.length===0 && !analysisLoading" class="absolute inset-0 flex items-center justify-center text-xs text-slate-400 dark:text-slate-500" x-text="valueMode==='holdings' ? 'No price history available.' : 'No snapshots for this period.'"></div>
          </div>
          <!-- Per-asset price peaks (holdings sim only) -->
          <div x-show="valueMode==='holdings' && assetPeaks.length>0" class="mt-4 border-t border-slate-100 dark:border-slate-700 pt-4">
            <button @click="peaksOpen=!peaksOpen" class="flex w-full items-center justify-between gap-2 text-left">
              <h4 class="text-[11px] font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">Asset Peaks — this period</h4>
              <svg class="h-4 w-4 shrink-0 text-slate-400 transition-transform dark:text-slate-500" :class="peaksOpen ? 'rotate-180' : ''" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7"/></svg>
            </button>
            <div x-show="peaksOpen" x-transition class="mt-3 grid grid-cols-1 gap-x-6 gap-y-2 sm:grid-cols-2">
              <template x-for="p in assetPeaks" :key="p.asset">
                <div class="flex items-center justify-between gap-2 text-sm">
                  <div class="flex min-w-0 items-center gap-2">
                    <span class="relative h-5 w-5 shrink-0">
                      <span class="absolute inset-0 flex items-center justify-center rounded-full text-[8px] font-semibold text-white" :style="'background:'+tokenGradient(p.asset)" x-text="tokenInitial(p.asset)"></span>
                      <img :src="tokenIcon(p.asset)" class="absolute inset-0 h-5 w-5 rounded-full object-cover" @error="$el.style.display='none'" alt="">
                    </span>
                    <span class="truncate font-medium" x-text="p.asset"></span>
                  </div>
                  <div class="flex shrink-0 items-center gap-2 text-right">
                    <span class="font-medium" x-text="fmtDisplay(p.peak)"></span>
                    <span class="text-[11px] text-slate-400 dark:text-slate-500" x-text="new Date(p.peakAt).toLocaleDateString('en-US',{day:'2-digit',month:'short'})"></span>
                    <span class="w-14 text-[11px] font-medium" :class="p.fromPeakPct >= -0.05 ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400 dark:text-slate-500'"
                      x-text="p.fromPeakPct >= -0.05 ? 'at peak' : fmtPct(p.fromPeakPct,false)"></span>
                  </div>
                </div>
              </template>
            </div>
            <!-- All assets: total, highest, lowest, below peak (dari kurva portofolio) -->
            <div x-show="perf().has" class="mt-3 border-t border-slate-100 dark:border-slate-700 pt-3">
              <div class="mb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">All Assets</div>
              <div class="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <div>
                  <div class="text-[11px] text-slate-400 dark:text-slate-500">Total</div>
                  <div class="text-sm font-semibold" x-text="fmtDisplay(perf().end)"></div>
                </div>
                <div>
                  <div class="text-[11px] text-slate-400 dark:text-slate-500">Highest</div>
                  <div class="text-sm font-semibold text-emerald-600 dark:text-emerald-400" x-text="fmtDisplay(perf().peak)"></div>
                </div>
                <div>
                  <div class="text-[11px] text-slate-400 dark:text-slate-500">Lowest</div>
                  <div class="text-sm font-semibold text-rose-600 dark:text-rose-400" x-text="fmtDisplay(perf().low)"></div>
                </div>
                <div>
                  <div class="text-[11px] text-slate-400 dark:text-slate-500">Below peak</div>
                  <div class="text-sm font-semibold" :class="(perf().peak-perf().end) > 0.005 ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400'"
                    x-text="(perf().peak-perf().end) > 0.005 ? '−'+fmtDisplay(perf().peak-perf().end) : 'at peak'"></div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Allocation: pie + top 5 -->
        <div class="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-5 shadow-sm">
          <h3 class="mb-4 text-sm font-semibold">Asset Allocation</h3>
          <div class="grid grid-cols-1 gap-6 sm:grid-cols-2">
            <div class="relative h-56">
              <div x-ref="allocWrap" class="w-full h-full"></div>
              <div x-show="totalAssets()===0" class="absolute inset-0 flex items-center justify-center text-xs text-slate-400 dark:text-slate-500">No assets yet.</div>
            </div>
            <div class="flex flex-col justify-center space-y-3">
              <template x-for="(t,i) in top5()" :key="t.asset">
                <div>
                  <div class="flex items-center justify-between text-sm">
                    <div class="flex items-center gap-2 min-w-0">
                      <span class="h-2.5 w-2.5 shrink-0 rounded-full" :style="'background:'+ALLOC_COLORS[i]"></span>
                      <span class="relative h-5 w-5 shrink-0">
                        <span class="absolute inset-0 rounded-full flex items-center justify-center text-[8px] font-semibold text-white" :style="'background:'+tokenGradient(t.asset)" x-text="tokenInitial(t.asset)"></span>
                        <img :src="tokenIcon(t.asset)" class="absolute inset-0 h-5 w-5 rounded-full object-cover" @error="$el.style.display='none'" alt="">
                      </span>
                      <span class="font-medium truncate" x-text="t.asset"></span>
                    </div>
                    <div class="text-right shrink-0">
                      <span class="font-medium" x-text="t.pct.toFixed(1)+'%'"></span>
                      <span class="ml-2 text-xs text-slate-400 dark:text-slate-500" x-text="fmtDisplay(t.usd)"></span>
                    </div>
                  </div>
                  <div class="mt-1 h-1.5 w-full rounded-full bg-slate-100 dark:bg-slate-700">
                    <div class="h-1.5 rounded-full" :style="'width:'+t.pct+'%;background:'+ALLOC_COLORS[i]"></div>
                  </div>
                </div>
              </template>
              <p x-show="totalAssets()===0" class="text-xs text-slate-400 dark:text-slate-500">No assets yet.</p>
            </div>
          </div>
        </div>

        <!-- Composition / Stablecoin / Movers -->
        <div class="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <div class="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-5 shadow-sm">
            <h3 class="mb-4 text-sm font-semibold">Source Composition</h3>
            <div class="space-y-3">
              <template x-for="src in [{k:'cex',label:'Exchange (CEX)',c:'#6366f1'},{k:'onchain',label:'On-chain',c:'#10b981'},{k:'manual',label:'Manual',c:'#f59e0b'}]" :key="src.k">
                <div>
                  <div class="flex items-center justify-between text-xs">
                    <span class="text-slate-600 dark:text-slate-300" x-text="src.label"></span>
                    <span class="font-medium" x-text="compPct(composition()[src.k]).toFixed(1)+'%'"></span>
                  </div>
                  <div class="mt-1 h-2 w-full rounded-full bg-slate-100 dark:bg-slate-700">
                    <div class="h-2 rounded-full" :style="'width:'+compPct(composition()[src.k])+'%;background:'+src.c"></div>
                  </div>
                  <div class="mt-0.5 text-[11px] text-slate-400 dark:text-slate-500" x-text="fmtDisplay(composition()[src.k])"></div>
                </div>
              </template>
              <p x-show="composition().total===0" class="text-xs text-slate-400 dark:text-slate-500">No data yet.</p>
            </div>
          </div>

          <div class="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-5 shadow-sm">
            <h3 class="mb-1 text-sm font-semibold">Stable vs Volatile</h3>
            <p class="mb-4 text-xs text-slate-400 dark:text-slate-500">Stablecoin &amp; fiat vs volatile assets ("dry powder")</p>
            <div class="flex items-end justify-between">
              <div>
                <div class="text-2xl font-bold text-emerald-600 dark:text-emerald-400" x-text="stableStats().stablePct.toFixed(1)+'%'"></div>
                <div class="text-xs text-slate-400 dark:text-slate-500">stable / cash</div>
              </div>
              <div class="text-right text-xs text-slate-500 dark:text-slate-400">
                <div x-text="'Stable: '+fmtDisplay(stableStats().stable)"></div>
                <div x-text="'Volatile: '+fmtDisplay(stableStats().risky)"></div>
              </div>
            </div>
            <div class="mt-3 flex h-2.5 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-700">
              <div class="h-2.5 bg-emerald-500" :style="'width:'+stableStats().stablePct+'%'"></div>
              <div class="h-2.5 bg-indigo-500" :style="'width:'+(100-stableStats().stablePct)+'%'"></div>
            </div>
          </div>

          <div class="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-5 shadow-sm">
            <h3 class="mb-4 text-sm font-semibold">24h Movers</h3>
            <div class="space-y-3">
              <div>
                <div class="mb-1 text-[11px] uppercase tracking-wide text-emerald-600 dark:text-emerald-400">Top Gainers</div>
                <template x-for="m in movers().best" :key="'g'+m.asset">
                  <div class="flex items-center justify-between text-sm">
                    <div class="flex items-center gap-1.5">
                      <span class="relative h-4 w-4 shrink-0">
                        <span class="absolute inset-0 rounded-full flex items-center justify-center text-[7px] font-semibold text-white" :style="'background:'+tokenGradient(m.asset)" x-text="tokenInitial(m.asset)"></span>
                        <img :src="tokenIcon(m.asset)" class="absolute inset-0 h-4 w-4 rounded-full object-cover" @error="$el.style.display='none'" alt="">
                      </span>
                      <span class="font-medium" x-text="m.asset"></span>
                    </div>
                    <span class="font-medium text-emerald-600 dark:text-emerald-400" x-text="fmtPct(m.pct,false)"></span>
                  </div>
                </template>
                <p x-show="movers().best.length===0" class="text-xs text-slate-400 dark:text-slate-500">—</p>
              </div>
              <div>
                <div class="mb-1 text-[11px] uppercase tracking-wide text-rose-600 dark:text-rose-400">Top Losers</div>
                <template x-for="m in movers().worst" :key="'l'+m.asset">
                  <div class="flex items-center justify-between text-sm">
                    <div class="flex items-center gap-1.5">
                      <span class="relative h-4 w-4 shrink-0">
                        <span class="absolute inset-0 rounded-full flex items-center justify-center text-[7px] font-semibold text-white" :style="'background:'+tokenGradient(m.asset)" x-text="tokenInitial(m.asset)"></span>
                        <img :src="tokenIcon(m.asset)" class="absolute inset-0 h-4 w-4 rounded-full object-cover" @error="$el.style.display='none'" alt="">
                      </span>
                      <span class="font-medium" x-text="m.asset"></span>
                    </div>
                    <span class="font-medium text-rose-600 dark:text-rose-400" x-text="fmtPct(m.pct,false)"></span>
                  </div>
                </template>
                <p x-show="movers().worst.length===0" class="text-xs text-slate-400 dark:text-slate-500">—</p>
              </div>
            </div>
          </div>
        </div>

        <!-- Top assets table -->
        <div class="overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-sm">
          <div class="flex items-center justify-between px-4 py-3">
            <h3 class="text-sm font-semibold">Top Assets</h3>
            <span class="text-xs text-slate-400 dark:text-slate-500" x-text="'Showing '+Math.min(topLimit,totalAssets())+' of '+totalAssets()"></span>
          </div>
          <div class="overflow-x-auto">
            <table class="min-w-full divide-y divide-slate-100 dark:divide-slate-700 text-sm">
              <thead class="bg-slate-50 dark:bg-slate-700/50 text-left text-xs uppercase tracking-wide text-slate-400 dark:text-slate-500">
                <tr><th class="px-4 py-3">#</th><th class="px-4 py-3">Asset</th><th class="px-4 py-3 text-right">Amount</th><th class="px-4 py-3 text-right">Value</th><th class="px-4 py-3 text-right">Allocation</th><th class="px-4 py-3 text-right">24h</th></tr>
              </thead>
              <tbody class="divide-y divide-slate-100 dark:divide-slate-700">
                <template x-for="(a,i) in topAssets()" :key="a.asset">
                  <tr>
                    <td class="px-4 py-3 text-slate-400 dark:text-slate-500" x-text="i+1"></td>
                    <td class="px-4 py-3">
                      <div class="flex items-center gap-2">
                        <span class="relative h-5 w-5 shrink-0">
                        <span class="absolute inset-0 rounded-full flex items-center justify-center text-[8px] font-semibold text-white" :style="'background:'+tokenGradient(a.asset)" x-text="tokenInitial(a.asset)"></span>
                        <img :src="tokenIcon(a.asset)" class="absolute inset-0 h-5 w-5 rounded-full object-cover" @error="$el.style.display='none'" alt="">
                      </span>
                        <span class="font-medium" x-text="a.asset"></span>
                      </div>
                    </td>
                    <td class="px-4 py-3 text-right text-slate-500 dark:text-slate-400" x-text="fmtNum(a.amount)"></td>
                    <td class="px-4 py-3 text-right font-medium" x-text="fmtDisplay(a.usd)"></td>
                    <td class="px-4 py-3 text-right text-slate-500 dark:text-slate-400" x-text="allocPct(a.usd).toFixed(1)+'%'"></td>
                    <td class="px-4 py-3 text-right" :class="assetChg(a.asset)===null ? 'text-slate-400 dark:text-slate-500' : pctClass(assetChg(a.asset))" x-text="assetChg(a.asset)===null ? '—' : fmtPct(assetChg(a.asset),false)"></td>
                  </tr>
                </template>
                <tr x-show="totalAssets()===0"><td colspan="6" class="px-4 py-6 text-center text-slate-400 dark:text-slate-500">No assets yet.</td></tr>
              </tbody>
            </table>
          </div>
          <div x-show="totalAssets() > topLimit" class="border-t border-slate-100 dark:border-slate-700 p-3 text-center">
            <button @click="topLimit += 10" class="rounded-xl bg-slate-100 dark:bg-slate-700 px-4 py-2 text-xs font-medium hover:bg-slate-200 dark:hover:bg-slate-600">Load more (+10)</button>
          </div>
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
              <div x-show="a.type==='binance'" class="mt-2 text-xs">
                <template x-if="a.deposit_backfill && a.deposit_backfill.done">
                  <span class="text-emerald-600 dark:text-emerald-400">Full deposit history<span class="text-slate-400 dark:text-slate-500" x-text="' ('+(a.deposit_backfill.fetched||0)+' rows)'"></span></span>
                </template>
                <template x-if="a.deposit_backfill && !a.deposit_backfill.done">
                  <span class="text-amber-600 dark:text-amber-400">Backfill running… up to <span x-text="fmtDateOnly(a.deposit_backfill.cursorEnd)"></span></span>
                </template>
                <template x-if="!a.deposit_backfill">
                  <span class="text-slate-400 dark:text-slate-500">Deposits: last 90 days</span>
                </template>
              </div>
              <div class="mt-3 flex flex-wrap gap-2">
                <button @click="syncAccount(a.id)" class="rounded-lg bg-slate-100 dark:bg-slate-700 px-3 py-1.5 text-xs font-medium hover:bg-slate-200 dark:hover:bg-slate-600">Sync</button>
                <button @click="openAccountModal(a)" class="rounded-lg bg-slate-100 dark:bg-slate-700 px-3 py-1.5 text-xs font-medium hover:bg-slate-200 dark:hover:bg-slate-600">Edit</button>
                <button x-show="a.type==='binance'" @click="backfillDeposits(a.id)" class="rounded-lg bg-slate-100 dark:bg-slate-700 px-3 py-1.5 text-xs font-medium hover:bg-slate-200 dark:hover:bg-slate-600">Full History</button>
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
                  <td class="px-4 py-3">
                    <div class="flex items-center gap-2">
                      <span class="relative h-5 w-5 shrink-0">
                        <span class="absolute inset-0 rounded-full flex items-center justify-center text-[8px] font-semibold text-white" :style="'background:'+tokenGradient(h.currency)" x-text="tokenInitial(h.currency)"></span>
                        <img :src="tokenIcon(h.currency)" class="absolute inset-0 h-5 w-5 rounded-full object-cover" @error="$el.style.display='none'" alt="">
                      </span>
                      <span class="rounded bg-slate-100 dark:bg-slate-700 px-1.5 py-0.5 text-[11px]" x-text="h.currency"></span>
                      <span class="text-[11px]" :class="h.amount<0 ? 'text-rose-500 dark:text-rose-400' : 'text-slate-400 dark:text-slate-500'" x-text="h.amount<0 ? 'expense' : h.asset_class"></span>
                    </div>
                  </td>
                  <td class="px-4 py-3 text-right font-medium" :class="h.amount<0 ? 'text-rose-600 dark:text-rose-400' : 'text-slate-700 dark:text-slate-300'" x-text="fmtNum(h.amount)"></td>
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
                  <td class="px-4 py-3">
                    <div class="flex items-center gap-2">
                      <span class="relative h-5 w-5 shrink-0">
                        <span class="absolute inset-0 rounded-full flex items-center justify-center text-[8px] font-semibold text-white" :style="'background:'+tokenGradient(d.asset)" x-text="tokenInitial(d.asset)"></span>
                        <img :src="tokenIcon(d.asset)" class="absolute inset-0 h-5 w-5 rounded-full object-cover" @error="$el.style.display='none'" alt="">
                      </span>
                      <span class="font-medium" x-text="d.asset"></span>
                    </div>
                  </td>
                  <td class="px-4 py-3 text-right" x-text="fmtNum(d.amount)"></td>
                  <td class="px-4 py-3 text-slate-500 dark:text-slate-400" x-text="d.network||'—'"></td>
                  <td class="px-4 py-3"><span class="rounded-full px-2 py-0.5 text-[11px]" :class="d.status==='success'||d.status==='credited' ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400':'bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400'" x-text="d.status"></span></td>
                </tr>
              </template>
              <tr x-show="deposits.length===0"><td colspan="6" class="px-4 py-6 text-center text-slate-400 dark:text-slate-500">No deposit data yet.</td></tr>
            </tbody>
          </table>
          <!-- Pagination -->
          <div x-show="depositTotal>0" class="flex items-center justify-between border-t border-slate-100 dark:border-slate-700 px-4 py-3">
            <span class="text-xs text-slate-500 dark:text-slate-400" x-text="depositFrom()+' – '+depositTo()+' of '+depositTotal"></span>
            <div class="flex items-center gap-1">
              <button @click="loadDeposits(1)" :disabled="depositPage===1"
                class="rounded-lg px-2 py-1.5 text-xs font-medium disabled:opacity-40 disabled:cursor-not-allowed bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600">«</button>
              <button @click="loadDeposits(depositPage-1)" :disabled="depositPage===1"
                class="rounded-lg px-3 py-1.5 text-xs font-medium disabled:opacity-40 disabled:cursor-not-allowed bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600">Prev</button>
              <template x-for="p in Array.from({length:depositPages()},(_,i)=>i+1).filter(p=>p===1||p===depositPages()||Math.abs(p-depositPage)<=1)" :key="p">
                <button @click="loadDeposits(p)"
                  class="rounded-lg px-3 py-1.5 text-xs font-medium transition-colors"
                  :class="p===depositPage?'bg-indigo-600 text-white':'bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-600 dark:text-slate-300'"
                  x-text="p"></button>
              </template>
              <button @click="loadDeposits(depositPage+1)" :disabled="depositPage>=depositPages()"
                class="rounded-lg px-3 py-1.5 text-xs font-medium disabled:opacity-40 disabled:cursor-not-allowed bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600">Next</button>
              <button @click="loadDeposits(depositPages())" :disabled="depositPage>=depositPages()"
                class="rounded-lg px-2 py-1.5 text-xs font-medium disabled:opacity-40 disabled:cursor-not-allowed bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600">»</button>
            </div>
          </div>
        </div>
      </section>

      <!-- ACTIVITY -->
      <section x-show="view==='activity'" class="space-y-4">
        <!-- Tab switcher -->
        <div class="flex gap-2">
          <button @click="activityTab='events'"
            class="rounded-xl px-4 py-2 text-sm font-medium transition-colors"
            :class="activityTab==='events' ? 'bg-indigo-600 text-white shadow-sm' : 'bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700'">
            Events
            <span x-show="unreadCount>0" x-text="'('+unreadCount+' unread)'" class="ml-1 text-xs opacity-75"></span>
          </button>
          <button @click="activityTab='queue'; loadQueue()"
            class="rounded-xl px-4 py-2 text-sm font-medium transition-colors"
            :class="activityTab==='queue' ? 'bg-indigo-600 text-white shadow-sm' : 'bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700'">
            System Queue
          </button>
        </div>

        <!-- EVENTS tab -->
        <div x-show="activityTab==='events'" class="space-y-3">
          <div class="flex items-center justify-between gap-2 flex-wrap">
            <p class="text-xs text-slate-400 dark:text-slate-500">System event log — HTTP errors, sync failures, cooldown</p>
            <div class="flex gap-2">
              <button @click="markAllRead()" x-show="unreadCount>0"
                class="rounded-xl px-3 py-1.5 text-xs font-medium bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600">
                Mark all read
              </button>
              <button @click="clearEvents()" x-show="systemEvents.length>0"
                class="rounded-xl px-3 py-1.5 text-xs font-medium bg-rose-50 dark:bg-rose-900/20 text-rose-600 dark:text-rose-400 hover:bg-rose-100 dark:hover:bg-rose-900/30">
                Clear all
              </button>
            </div>
          </div>
          <div class="overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-sm divide-y divide-slate-100 dark:divide-slate-700">
            <template x-for="e in systemEvents" :key="e.id">
              <div class="flex items-start gap-3 px-4 py-3 transition-colors"
                :class="!e.read_at ? 'bg-slate-50 dark:bg-slate-700/30' : ''">
                <div class="mt-1.5 h-2 w-2 shrink-0 rounded-full"
                  :class="e.level==='error' ? 'bg-rose-500' : e.level==='warning' ? 'bg-amber-400' : 'bg-emerald-400'"></div>
                <div class="min-w-0 flex-1">
                  <div class="flex flex-wrap items-center gap-1.5">
                    <span class="rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide"
                      :class="e.level==='error' ? 'bg-rose-100 dark:bg-rose-900/30 text-rose-600 dark:text-rose-400' : e.level==='warning' ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400' : 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400'"
                      x-text="e.level"></span>
                    <span class="rounded px-1.5 py-0.5 text-[10px] bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400 font-mono" x-text="e.source"></span>
                    <span class="text-[11px] text-slate-400 dark:text-slate-500" x-text="timeAgo(e.created_at)"></span>
                  </div>
                  <p class="mt-1 text-sm text-slate-700 dark:text-slate-300" x-text="e.message"></p>
                  <p x-show="e.detail" x-text="e.detail"
                    class="mt-0.5 text-[11px] text-slate-400 dark:text-slate-500 font-mono break-all whitespace-pre-wrap leading-relaxed"></p>
                </div>
              </div>
            </template>
            <div x-show="systemEvents.length===0" class="px-4 py-8 text-center text-sm text-slate-400 dark:text-slate-500">
              No events yet. Events will appear when sync fails or an error occurs.
            </div>
          </div>
        </div>

        <!-- QUEUE tab -->
        <div x-show="activityTab==='queue'" class="space-y-3">
          <p class="text-xs text-slate-400 dark:text-slate-500">Sync status and system work queue (cron every 2 minutes)</p>

          <!-- Snapshot info card -->
          <div x-show="queueMeta.nextSnapshot" class="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-4 py-3 shadow-sm flex items-center justify-between gap-3">
            <div class="flex items-center gap-2">
              <svg class="h-4 w-4 text-indigo-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"/></svg>
              <span class="text-sm font-medium">Portfolio Snapshot</span>
              <span class="text-xs text-slate-400 dark:text-slate-500" x-text="'every '+queueMeta.snapshotIntervalMin+' min'"></span>
            </div>
            <span class="text-xs text-slate-500 dark:text-slate-400">
              Next: <span x-text="queueMeta.nextSnapshot < Date.now() ? 'soon' : timeAgo(queueMeta.nextSnapshot).replace(' ago','')"></span>
            </span>
          </div>

          <!-- Account queue list -->
          <div class="space-y-3">
            <template x-for="acc in activityQueue" :key="acc.id">
              <div class="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-4 shadow-sm">
                <div class="flex items-center justify-between gap-3 flex-wrap">
                  <div class="flex items-center gap-2 min-w-0">
                    <span class="h-2.5 w-2.5 shrink-0 rounded-full"
                      :class="acc.cooling ? 'bg-amber-400 animate-pulse' : acc.status==='ok' ? 'bg-emerald-400' : acc.status==='error' ? 'bg-rose-500' : 'bg-slate-300 dark:bg-slate-600'"></span>
                    <span class="font-medium text-sm truncate" x-text="acc.label"></span>
                    <span class="shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium uppercase bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400" x-text="acc.type"></span>
                  </div>
                  <div class="text-xs text-slate-400 dark:text-slate-500 shrink-0">
                    <span x-show="acc.cooling" class="font-medium text-amber-600 dark:text-amber-400">Cooldown active</span>
                    <span x-show="!acc.cooling && acc.last_synced_at">Synced <span x-text="timeAgo(acc.last_synced_at)"></span></span>
                    <span x-show="!acc.cooling && !acc.last_synced_at" class="italic">Not synced</span>
                  </div>
                </div>
                <div x-show="acc.last_error"
                  x-text="acc.last_error"
                  class="mt-2 rounded-lg bg-rose-50 dark:bg-rose-900/20 px-2 py-1.5 text-[11px] text-rose-600 dark:text-rose-400 font-mono break-all"></div>
                <!-- Backfill progress (hanya Binance) -->
                <div x-show="acc.backfill" class="mt-3 space-y-1">
                  <div class="flex justify-between text-[11px] text-slate-500 dark:text-slate-400">
                    <span class="font-medium">Backfill deposit</span>
                    <span x-text="acc.backfill ? (acc.backfill.done ? 'Done — ' : 'Running — ')+acc.backfill.fetched+' txns' : ''"></span>
                  </div>
                  <div class="h-1.5 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-700">
                    <div class="h-full rounded-full bg-indigo-500 transition-all duration-500"
                      :style="'width:'+backfillPct(acc.backfill)+'%'"></div>
                  </div>
                  <div class="text-[10px] text-slate-400 dark:text-slate-500">
                    Cursor: <span x-text="acc.backfill ? fmtDateOnly(acc.backfill.cursorEnd) : '—'"></span>
                    <span x-show="acc.backfill && !acc.backfill.done" class="ml-2 opacity-70">(auto-resumes every 2 min)</span>
                  </div>
                </div>
              </div>
            </template>
            <div x-show="activityQueue.length===0" class="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-6 text-center text-sm text-slate-400 dark:text-slate-500">
              No active accounts.
            </div>
          </div>
        </div>
      </section>

      <!-- SETTINGS -->
      <section x-show="view==='settings'" class="max-w-md space-y-4">
        <div class="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-5 shadow-sm">
          <h3 class="mb-1 text-sm font-semibold">Install App</h3>
          <p class="mb-4 text-xs text-slate-400 dark:text-slate-500">Add Wallet Tracker to your home screen for a full-screen, app-like experience.</p>
          <!-- Sudah terpasang -->
          <div x-show="installed" class="flex items-center gap-2 text-sm text-emerald-600 dark:text-emerald-400">
            <svg class="h-5 w-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"/></svg>
            <span>App is installed on this device.</span>
          </div>
          <!-- Bisa install langsung (Android/Chrome) -->
          <button x-show="!installed && installPrompt" @click="installApp()"
            class="flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-indigo-700">
            <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M12 4v12m0 0l-4-4m4 4l4-4M4 20h16"/></svg>
            <span>Install app</span>
          </button>
          <!-- Tidak bisa otomatis: iOS atau prompt belum tersedia -->
          <div x-show="!installed && !installPrompt" class="text-xs text-slate-500 dark:text-slate-400">
            <template x-if="isIOS">
              <p>On iPhone/iPad: tap the <span class="font-medium">Share</span> button, then <span class="font-medium">Add to Home Screen</span>.</p>
            </template>
            <template x-if="!isIOS">
              <p>If no install button appears: open your browser menu (<span class="font-medium">&#8942;</span>) and tap <span class="font-medium">Install app</span> / <span class="font-medium">Add to Home screen</span>.</p>
            </template>
          </div>
        </div>
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
          <p class="mb-4 text-xs text-slate-400 dark:text-slate-500">Download data as CSV (UTF-8, Excel-compatible).</p>
          <div class="flex flex-wrap gap-2">
            <button @click="exportCsv('balances')" class="rounded-xl bg-slate-100 dark:bg-slate-700 px-3 py-2 text-sm font-medium hover:bg-slate-200 dark:hover:bg-slate-600">Balances</button>
            <button @click="exportCsv('holdings')" class="rounded-xl bg-slate-100 dark:bg-slate-700 px-3 py-2 text-sm font-medium hover:bg-slate-200 dark:hover:bg-slate-600">Manual Holdings</button>
            <button @click="exportCsv('snapshots')" class="rounded-xl bg-slate-100 dark:bg-slate-700 px-3 py-2 text-sm font-medium hover:bg-slate-200 dark:hover:bg-slate-600">Snapshots</button>
          </div>
        </div>
      </section>
    </main>
  </div>

  <!-- Mobile bottom navigation -->
  <nav class="fixed inset-x-0 bottom-0 z-30 flex border-t border-slate-200 dark:border-slate-700 bg-white/95 dark:bg-slate-800/95 backdrop-blur lg:hidden" style="padding-bottom:env(safe-area-inset-bottom)">
    <template x-for="item in nav.slice(0,4)" :key="item.id">
      <button @click="go(item.id)"
        class="flex flex-1 flex-col items-center gap-0.5 py-2 text-[10px] font-medium transition-colors"
        :class="view===item.id ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-400 dark:text-slate-500'">
        <span x-html="item.icon"></span>
        <span class="truncate max-w-full px-0.5" x-text="item.label"></span>
      </button>
    </template>
    <button @click="moreOpen=true"
      class="relative flex flex-1 flex-col items-center gap-0.5 py-2 text-[10px] font-medium transition-colors"
      :class="['holdings','deposits','activity','settings'].includes(view) ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-400 dark:text-slate-500'">
      <svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M4 6h6v6H4zM14 6h6v6h-6zM4 16h6v4H4zM14 16h6v4h-6z"/></svg>
      <span>More</span>
      <span x-show="unreadCount>0" class="absolute right-[30%] top-1 h-1.5 w-1.5 rounded-full bg-rose-500"></span>
    </button>
  </nav>

  <!-- More sheet (mobile) -->
  <div x-show="moreOpen" class="fixed inset-0 z-40 lg:hidden">
    <div @click="moreOpen=false" class="absolute inset-0 bg-slate-900/50"></div>
    <div class="absolute inset-x-0 bottom-0 rounded-t-2xl border-t border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-4 shadow-xl"
         style="padding-bottom:calc(env(safe-area-inset-bottom) + 1rem)"
         x-transition:enter="transition ease-out duration-200" x-transition:enter-start="translate-y-full" x-transition:enter-end="translate-y-0"
         x-transition:leave="transition ease-in duration-150" x-transition:leave-start="translate-y-0" x-transition:leave-end="translate-y-full">
      <div class="mx-auto mb-4 h-1 w-10 rounded-full bg-slate-300 dark:bg-slate-600"></div>
      <div class="grid grid-cols-4 gap-2">
        <template x-for="item in nav.slice(4)" :key="item.id">
          <button @click="go(item.id)"
            class="relative flex flex-col items-center gap-1.5 rounded-xl p-3 text-[11px] font-medium transition-colors"
            :class="view===item.id ? 'bg-indigo-50 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400' : 'text-slate-500 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700'">
            <span x-html="item.icon"></span>
            <span class="text-center leading-tight" x-text="item.label"></span>
            <span x-show="item.id==='activity' && unreadCount>0" x-text="unreadCount>99?'99+':unreadCount"
              class="absolute right-1 top-1 rounded-full bg-rose-500 px-1.5 py-0.5 text-[9px] font-bold leading-none text-white"></span>
          </button>
        </template>
      </div>
      <button @click="logout()" class="mt-3 w-full rounded-xl bg-slate-100 dark:bg-slate-700 py-2.5 text-sm font-medium text-rose-600 dark:text-rose-400 hover:bg-slate-200 dark:hover:bg-slate-600">Sign Out</button>
    </div>
  </div>

  <!-- Update tersedia (PWA) -->
  <div x-show="updateReady" x-transition class="fixed inset-x-0 bottom-20 z-40 flex justify-center px-4 lg:bottom-6">
    <button @click="location.reload()" class="flex items-center gap-2 rounded-full bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white shadow-lg ring-1 ring-black/5 hover:bg-indigo-700">
      <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/></svg>
      <span>Versi baru tersedia — ketuk untuk muat ulang</span>
    </button>
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
        <div class="grid grid-cols-2 gap-2">
          <button type="button" @click="hd.direction='in'"
            class="rounded-xl border px-3 py-2 text-sm font-medium transition-colors"
            :class="hd.direction!=='out' ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400' : 'border-slate-300 dark:border-slate-600 text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700'">+ Income</button>
          <button type="button" @click="hd.direction='out'"
            class="rounded-xl border px-3 py-2 text-sm font-medium transition-colors"
            :class="hd.direction==='out' ? 'border-rose-500 bg-rose-50 dark:bg-rose-900/30 text-rose-700 dark:text-rose-400' : 'border-slate-300 dark:border-slate-600 text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700'">− Expense</button>
        </div>
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
        <input type="text" x-model="hd.amountDisplay"
          @blur="{ const n=parseFloat((hd.amountDisplay||'').replace(/,/g,'')); hd.amountDisplay = n ? n.toLocaleString('en-US',{maximumFractionDigits:8}) : ''; }"
          placeholder="Amount (e.g. 100,000,000)"
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

  <script nonce="__CSP_NONCE__">
    requestAnimationFrame(()=>requestAnimationFrame(()=>document.body.classList.add('theme-ready')));

    function app() {
      return {
        view: 'dashboard', sidebarOpen: false, moreOpen: false, csrf: '', username: '',
        syncing: false, toast: '', modal: null, updateReady: false, appVersion: '',
        installPrompt: null, installed: false, isIOS: false,
        systemEvents: [], unreadCount: 0, activityQueue: [], queueMeta: {}, activityTab: 'events',
        darkMode: document.documentElement.classList.contains('dark'),
        displayCurrency: localStorage.getItem('currency') || 'USD',
        hideAmounts: localStorage.getItem('hideAmounts')==='1',
        idrRate: 0,
        nav: [
          { id:'dashboard', label:'Dashboard', icon:'<svg xmlns=\\'http://www.w3.org/2000/svg\\' class=\\'h-5 w-5\\' fill=\\'none\\' viewBox=\\'0 0 24 24\\' stroke=\\'currentColor\\' stroke-width=\\'2\\'><path stroke-linecap=\\'round\\' stroke-linejoin=\\'round\\' d=\\'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6\\'/></svg>' },
          { id:'analysis', label:'Analysis', icon:'<svg xmlns=\\'http://www.w3.org/2000/svg\\' class=\\'h-5 w-5\\' fill=\\'none\\' viewBox=\\'0 0 24 24\\' stroke=\\'currentColor\\' stroke-width=\\'2\\'><path stroke-linecap=\\'round\\' stroke-linejoin=\\'round\\' d=\\'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z\\'/></svg>' },
          { id:'portfolios', label:'Portfolios', icon:'<svg xmlns=\\'http://www.w3.org/2000/svg\\' class=\\'h-5 w-5\\' fill=\\'none\\' viewBox=\\'0 0 24 24\\' stroke=\\'currentColor\\' stroke-width=\\'2\\'><path stroke-linecap=\\'round\\' stroke-linejoin=\\'round\\' d=\\'M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10\\'/></svg>' },
          { id:'accounts', label:'Accounts', icon:'<svg xmlns=\\'http://www.w3.org/2000/svg\\' class=\\'h-5 w-5\\' fill=\\'none\\' viewBox=\\'0 0 24 24\\' stroke=\\'currentColor\\' stroke-width=\\'2\\'><path stroke-linecap=\\'round\\' stroke-linejoin=\\'round\\' d=\\'M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-2m-3-7h6m-3-3v6\\'/></svg>' },
          { id:'holdings', label:'Manual Holdings', icon:'<svg xmlns=\\'http://www.w3.org/2000/svg\\' class=\\'h-5 w-5\\' fill=\\'none\\' viewBox=\\'0 0 24 24\\' stroke=\\'currentColor\\' stroke-width=\\'2\\'><path stroke-linecap=\\'round\\' stroke-linejoin=\\'round\\' d=\\'M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1\\'/></svg>' },
          { id:'deposits', label:'Deposits', icon:'<svg xmlns=\\'http://www.w3.org/2000/svg\\' class=\\'h-5 w-5\\' fill=\\'none\\' viewBox=\\'0 0 24 24\\' stroke=\\'currentColor\\' stroke-width=\\'2\\'><path stroke-linecap=\\'round\\' stroke-linejoin=\\'round\\' d=\\'M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4\\'/></svg>' },
          { id:'activity', label:'Activity', icon:'<svg xmlns=\\'http://www.w3.org/2000/svg\\' class=\\'h-5 w-5\\' fill=\\'none\\' viewBox=\\'0 0 24 24\\' stroke=\\'currentColor\\' stroke-width=\\'2\\'><path stroke-linecap=\\'round\\' stroke-linejoin=\\'round\\' d=\\'M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9\\'/></svg>' },
          { id:'settings', label:'Settings', icon:'<svg xmlns=\\'http://www.w3.org/2000/svg\\' class=\\'h-5 w-5\\' fill=\\'none\\' viewBox=\\'0 0 24 24\\' stroke=\\'currentColor\\' stroke-width=\\'2\\'><path stroke-linecap=\\'round\\' stroke-linejoin=\\'round\\' d=\\'M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z\\'/><path stroke-linecap=\\'round\\' stroke-linejoin=\\'round\\' d=\\'M15 12a3 3 0 11-6 0 3 3 0 016 0z\\'/></svg>' }
        ],
        overview: { portfolios: [], grandTotalUsd: 0 },
        portfolios: [], accounts: [], holdings: [], deposits: [],
        depositPage: 1, depositTotal: 0, depositLimit: 25,
        history: [], historyRange: 30, historyPortfolio: '', chart: null, pieChart: null,
        analysisPeriod: '1M', analysisHistory: [], analysisLoading: false, analysisChart: null, analysisPie: null, topLimit: 10,
        valueMode: 'snapshot', // 'snapshot' = riwayat snapshot nyata; 'holdings' = simulasi holdings kini × harga historis
        assetPeaks: [], peaksOpen: true, // ringkasan peak harga per-aset (mode holdings); peaksOpen = panel buka/tutup
        chartRange: null, // {min,max} ms saat chart di-zoom/pan; perf() mengikuti rentang ini
        STABLES_SET: ['USDT','USDC','BUSD','DAI','TUSD','FDUSD','USDD','USDP','USD'],
        FIATS_SET: ['IDR','EUR','JPY','GBP','AUD','CAD','CHF','CNY','HKD','SGD','KRW','INR','MYR','THB','PHP','NZD','SEK','NOK','DKK','ZAR','TRY','BRL','MXN'],
        ALLOC_COLORS: ['#6366f1','#8b5cf6','#f59e0b','#10b981','#94a3b8'],
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
          const mv = document.querySelector('meta[name=app-version]');
          this.appVersion = mv ? mv.getAttribute('content') : '';
          this.startVersionWatch();
          // PWA install: tangkap prompt (sudah distash di window.__bip oleh script head).
          this.isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent);
          this.installed = window.matchMedia('(display-mode: standalone)').matches || navigator.standalone===true;
          if (window.__bip) this.installPrompt = window.__bip;
          window.addEventListener('bip-ready', ()=>{ this.installPrompt = window.__bip; });
          window.addEventListener('appinstalled', ()=>{ this.installPrompt = null; this.installed = true; this.flash('App installed'); });
          const VIEWS = ['dashboard','analysis','portfolios','accounts','holdings','deposits','activity','settings'];
          const hash = window.location.hash.slice(1);
          if (VIEWS.includes(hash)) this.view = hash;
          window.addEventListener('hashchange', () => {
            const h = window.location.hash.slice(1);
            if (VIEWS.includes(h) && h !== this.view) {
              this.view = h;
              if (h === 'dashboard') this.$nextTick(()=>{ this.renderChart(); this.renderPieChart(); });
              if (h === 'analysis') this.loadAnalysis();
            }
          });
          const me = await this.api('GET','/auth/me');
          if (!me) return;
          this.csrf = me.data.csrf; this.username = me.data.username;
          await this.loadPortfolios();
          await Promise.all([this.loadOverview(), this.loadAccounts(), this.loadHoldings(), this.loadDeposits(), this.loadSystemEvents()]);
          await this.loadHistory();
          if (this.view==='analysis') this.loadAnalysis();
        },

        toggleDark() {
          this.darkMode = !this.darkMode;
          document.documentElement.classList.toggle('dark', this.darkMode);
          localStorage.setItem('theme', this.darkMode ? 'dark' : 'light');
          if (this.view === 'dashboard') this.$nextTick(()=>{ this.renderChart(); this.renderPieChart(); });
          if (this.view === 'analysis') this.$nextTick(()=>{ this.renderAnalysisChart(); this.renderAllocPie(); });
        },

        toggleCurrency() {
          this.displayCurrency = this.displayCurrency === 'USD' ? 'IDR' : 'USD';
          localStorage.setItem('currency', this.displayCurrency);
          if (this.view === 'dashboard') this.$nextTick(()=>{ this.renderChart(); this.renderPieChart(); });
          if (this.view === 'analysis') this.$nextTick(()=>{ this.renderAnalysisChart(); this.renderAllocPie(); });
        },

        toggleHideAmounts() {
          this.hideAmounts = !this.hideAmounts;
          localStorage.setItem('hideAmounts', this.hideAmounts ? '1' : '0');
          if (this.view === 'dashboard') this.$nextTick(()=>{ this.renderChart(); this.renderPieChart(); });
          if (this.view === 'analysis') this.$nextTick(()=>{ this.renderAnalysisChart(); this.renderAllocPie(); });
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
          this.view = id; this.sidebarOpen = false; this.moreOpen = false;
          window.location.hash = id;
          if (id==='dashboard') this.$nextTick(()=>{ this.renderChart(); this.renderPieChart(); });
          if (id==='analysis') this.loadAnalysis();
        },
        navLabel() { const n=this.nav.find(x=>x.id===this.view); return n?n.label:''; },
        portfolioName(id) { const p=this.portfolios.find(x=>x.id===id); return p?p.name:'—'; },
        flash(msg) { this.toast = msg; setTimeout(()=>{ this.toast=''; }, 3000); },
        async installApp() {
          if (!this.installPrompt) return;
          this.installPrompt.prompt();
          try { await this.installPrompt.userChoice; } catch {}
          this.installPrompt = null;
        },
        startVersionWatch() {
          if (!this.appVersion || this.appVersion==='dev') return;
          const check = async () => {
            if (document.visibilityState!=='visible' || this.updateReady) return;
            try {
              const r = await fetch('/version', { cache:'no-store' });
              if (!r.ok) return;
              const d = await r.json();
              if (d && d.id && d.id!==this.appVersion) this.updateReady = true;
            } catch {}
          };
          document.addEventListener('visibilitychange', check);
          setInterval(check, 5*60*1000); // cek tiap 5 menit saat app aktif
        },
        hasPieData() { return this.overview.portfolios.some(p=>p.assets.length>0); },
        historyChange() {
          const h=this.history; if(!h||h.length<2) return null;
          const first=Number(h[0].total_usd)||0, last=Number(h[h.length-1].total_usd)||0;
          if(first===0) return null;
          const abs=last-first; return { pct:(abs/first)*100, abs, up:abs>=0 };
        },
        fmtAxis(v) {
          if (this.hideAmounts) return '';
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
        tokenIcon(sym) { return 'https://assets.coincap.io/assets/icons/'+(sym||'').toLowerCase().replace(/[^a-z0-9]/g,'')+'@2x.png'; },
        tokenGradient(sym) { let h=0; for(const c of (sym||'?').toUpperCase()) h=(h*31+c.charCodeAt(0))&0xffff; const h1=h%360, h2=(h1+45)%360; return 'linear-gradient(135deg,hsl('+h1+',65%,58%),hsl('+h2+',65%,42%))'; },
        tokenInitial(sym) { const s=(sym||'?').toUpperCase(); return s.length===3 ? s.slice(0,2) : s.charAt(0); },

        fmtUsd(n) { if (this.hideAmounts) return '$ ••••••'; return '$'+(Number(n)||0).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2}); },
        fmtNum(n) { if (this.hideAmounts) return '••••'; const v=Number(n)||0; return v.toLocaleString('en-US',{maximumFractionDigits:8}); },
        fmtDate(ts) { if(!ts) return '—'; return new Date(Number(ts)).toLocaleString('en-US'); },
        fmtDateOnly(ts) { if(!ts) return '—'; return new Date(Number(ts)).toLocaleDateString('en-US',{year:'numeric',month:'short',day:'numeric'}); },
        toDateInput(ts) { const d=ts?new Date(Number(ts)):new Date(); return new Date(d.getTime()-d.getTimezoneOffset()*60000).toISOString().slice(0,10); },
        timeAgo(ts) { if(!ts) return '—'; const s=Math.floor((Date.now()-Number(ts))/1000); if(s<60) return s+'s ago'; if(s<3600) return Math.floor(s/60)+'m ago'; if(s<86400) return Math.floor(s/3600)+'h ago'; return Math.floor(s/86400)+'d ago'; },
        fmtDisplay(usd) {
          if (this.hideAmounts) return this.displayCurrency === 'IDR' ? 'Rp ••••••' : '$ ••••••';
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
        async loadDeposits(page=1) {
          this.depositPage=page;
          const r=await this.api('GET','/dashboard/deposits?page='+page+'&limit='+this.depositLimit);
          if(r&&r.ok){ this.deposits=r.data.data; this.depositTotal=r.data.total; }
        },
        depositPages() { return Math.max(1,Math.ceil(this.depositTotal/this.depositLimit)); },
        depositFrom() { return this.depositTotal===0?0:(this.depositPage-1)*this.depositLimit+1; },
        depositTo() { return Math.min(this.depositPage*this.depositLimit,this.depositTotal); },
        async loadSystemEvents() {
          const r = await this.api('GET','/system/events');
          if (r&&r.ok) { this.systemEvents=r.data.events; this.unreadCount=r.data.unreadCount; }
        },
        async loadQueue() {
          const r = await this.api('GET','/system/queue');
          if (r&&r.ok) { this.activityQueue=r.data.accounts; this.queueMeta={ nextSnapshot:r.data.nextSnapshot, snapshotIntervalMin:r.data.snapshotIntervalMin }; }
        },
        async markAllRead() {
          await this.api('POST','/system/events/read-all', {});
          await this.loadSystemEvents();
        },
        async clearEvents() {
          if (!confirm('Hapus semua event? Tindakan ini tidak bisa dibatalkan.')) return;
          await this.api('DELETE','/system/events');
          await this.loadSystemEvents();
        },
        backfillPct(bf) {
          if (!bf) return 0;
          if (bf.done) return 100;
          const FLOOR = 1498867200000;
          const total = Date.now() - FLOOR;
          const remaining = Number(bf.cursorEnd) - FLOOR;
          if (total <= 0) return 0;
          return Math.max(0, Math.min(100, Math.round((1 - remaining / total) * 100)));
        },
        async loadHistory() {
          const q = '/dashboard/history?days='+this.historyRange+(this.historyPortfolio?('&portfolio_id='+this.historyPortfolio):'');
          const r = await this.api('GET', q);
          if (r&&r.ok) { this.history=r.data; this.$nextTick(()=>this.renderChart()); }
        },

        renderChart() {
          const wrap = this.$refs.chartWrap;
          if (!wrap || typeof ApexCharts==='undefined' || !wrap.isConnected) return;
          if (wrap.clientWidth===0) { setTimeout(()=>this.renderChart(),100); return; }
          const dark=this.darkMode, currency=this.displayCurrency, idrMult=currency==='IDR'?(this.idrRate||0):1, self=this;
          let pts=this.history.map(h=>[Number(h.captured_at),Number(h.total_usd)*idrMult]);
          const MAX=150;
          if (pts.length>MAX){ const step=(pts.length-1)/(MAX-1); pts=Array.from({length:MAX},(_,i)=>pts[Math.round(i*step)]); }
          if (this.chart){ this.chart.destroy(); this.chart=null; }
          this.chart=new ApexCharts(wrap,{
            chart:{ type:'area', height:'100%', background:'transparent', animations:{enabled:false}, toolbar:{show:false}, zoom:{enabled:false}, fontFamily:'ui-sans-serif,system-ui,sans-serif', sparkline:{enabled:false} },
            theme:{ mode:dark?'dark':'light' },
            series:[{ name:currency, data:pts }],
            xaxis:{ type:'datetime', labels:{ style:{colors:dark?'#94a3b8':'#64748b',fontSize:'11px'}, datetimeUTC:false, format:'dd MMM' }, axisBorder:{show:false}, axisTicks:{show:false}, tooltip:{enabled:false} },
            yaxis:{ labels:{ style:{colors:dark?'#94a3b8':'#64748b',fontSize:'11px'}, formatter:(v)=>self.fmtAxis(v) }, tickAmount:4 },
            stroke:{ curve:'smooth', width:2, colors:['#6366f1'] },
            fill:{ type:'gradient', gradient:{ shade:'dark', type:'vertical', shadeIntensity:0.1, gradientToColors:['#6366f1'], inverseColors:false, opacityFrom:0.35, opacityTo:0, stops:[0,100] } },
            colors:['#6366f1'],
            grid:{ borderColor:dark?'rgba(148,163,184,0.14)':'rgba(100,116,139,0.14)', strokeDashArray:0, xaxis:{lines:{show:false}} },
            markers:{ size:0, hover:{size:5} },
            tooltip:{ theme:dark?'dark':'light', x:{format:'dd MMM yyyy HH:mm'}, y:{ formatter:(v)=>self.hideAmounts?(currency==='IDR'?'Rp ••••••':'$ ••••••'):(currency==='IDR'?'Rp '+Math.round(v).toLocaleString('en-US'):'$'+v.toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2})) } },
            dataLabels:{enabled:false}, legend:{show:false},
          });
          this.chart.render();
        },

        renderPieChart() {
          const wrap=this.$refs.pieWrap;
          if (!wrap || typeof ApexCharts==='undefined' || !wrap.isConnected) return;
          if (wrap.clientWidth===0){ setTimeout(()=>this.renderPieChart(),100); return; }
          const totals={};
          for (const p of this.overview.portfolios) for (const a of p.assets) { if(a.usd>0) totals[a.asset]=(totals[a.asset]||0)+a.usd; }
          const entries=Object.entries(totals).sort((a,b)=>b[1]-a[1]);
          if (this.pieChart){ this.pieChart.destroy(); this.pieChart=null; }
          if (entries.length===0) return;
          const top=entries.slice(0,8); const othersVal=entries.slice(8).reduce((s,e)=>s+e[1],0);
          if (othersVal>0) top.push(['Others',othersVal]);
          const labels=top.map(e=>e[0]), data=top.map(e=>e[1]);
          const COLORS=['#6366f1','#8b5cf6','#f59e0b','#10b981','#ef4444','#3b82f6','#f97316','#ec4899','#14b8a6','#a855f7'];
          const dark=this.darkMode, currency=this.displayCurrency, idrRate=this.idrRate, self=this;
          const totalUsd=data.reduce((s,v)=>s+v,0);
          const totalDisp=currency==='IDR'?totalUsd*(idrRate||0):totalUsd;
          this.pieChart=new ApexCharts(wrap,{
            chart:{ type:'donut', height:'100%', background:'transparent', animations:{enabled:false}, fontFamily:'ui-sans-serif,system-ui,sans-serif' },
            theme:{ mode:dark?'dark':'light' },
            series:data, labels,
            colors:COLORS.slice(0,labels.length),
            plotOptions:{ pie:{ expandOnClick:false, donut:{ size:'62%', labels:{ show:true,
              name:{ show:true, fontSize:'11px', color:dark?'#94a3b8':'#64748b', offsetY:-10 },
              value:{ show:true, fontSize:'20px', fontWeight:700, color:dark?'#e2e8f0':'#0f172a', offsetY:6, formatter:(v)=>{ if(self.hideAmounts) return '••••'; const n=Number(v); const d=currency==='IDR'?n*(idrRate||0):n; return self.fmtAxis(d); } },
              total:{ show:true, showAlways:true, label:'Total', fontSize:'11px', fontWeight:400, color:dark?'#94a3b8':'#64748b', formatter:(w)=>{ if(self.hideAmounts) return '••••'; const sum=w.globals.seriesTotals.reduce((a,b)=>a+b,0); return self.fmtAxis(currency==='IDR'?sum*(idrRate||0):sum); } }
            } } } },
            dataLabels:{ enabled:false },
            legend:{ position:'bottom', fontSize:'10px', labels:{colors:dark?'#94a3b8':'#64748b'}, markers:{size:5}, itemMargin:{horizontal:4} },
            tooltip:{ theme:dark?'dark':'light', y:{ formatter:(v)=>{ const pct=totalUsd>0?((v/totalUsd)*100).toFixed(1):'0.0'; const fmt=self.hideAmounts?'••••':(currency==='IDR'?'Rp '+Math.round(v*(idrRate||0)).toLocaleString('en-US'):'$'+v.toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2})); return fmt+' ('+pct+'%)'; } } },
            stroke:{ width:2, colors:[dark?'#1e293b':'#ffffff'] },
          });
          this.pieChart.render();
        },

        // ---- Analysis ----
        PERIODS: [ {k:'1W',d:7}, {k:'1M',d:30}, {k:'3M',d:90}, {k:'6M',d:180}, {k:'1Y',d:365}, {k:'ALL',d:'all'} ],
        periodDays() { const p=this.PERIODS.find(x=>x.k===this.analysisPeriod); return p?p.d:30; },
        async loadAnalysisHistory() {
          this.analysisLoading=true;
          const ep = this.valueMode==='holdings' ? '/dashboard/asset-history' : '/dashboard/history';
          const r=await this.api('GET',ep+'?days='+this.periodDays());
          this.analysisLoading=false;
          if (r&&r.ok) {
            if (this.valueMode==='holdings') { this.analysisHistory=(r.data&&r.data.points)||[]; this.assetPeaks=(r.data&&r.data.peaks)||[]; }
            else { this.analysisHistory=r.data; this.assetPeaks=[]; }
          }
        },
        setValueMode(m) {
          if (this.valueMode===m) return;
          this.valueMode=m;
          this.loadAnalysisHistory().then(()=>this.$nextTick(()=>this.renderAnalysisChart()));
        },
        async loadAnalysis() {
          await this.loadAnalysisHistory();
          this.$nextTick(()=>{ this.renderAnalysisChart(); this.renderAllocPie(); });
        },
        setPeriod(p) {
          this.analysisPeriod=p;
          this.loadAnalysisHistory().then(()=>this.$nextTick(()=>this.renderAnalysisChart()));
        },
        aggAssets() {
          const m={};
          for (const p of (this.overview.portfolios||[])) for (const a of (p.assets||[])) {
            if (!(a.usd>0)) continue;
            if (!m[a.asset]) m[a.asset]={ asset:a.asset, usd:0, amount:0 };
            m[a.asset].usd+=a.usd; m[a.asset].amount+=(Number(a.amount)||0);
          }
          return Object.values(m).sort((x,y)=>y.usd-x.usd);
        },
        allocTotal() { return this.aggAssets().reduce((s,x)=>s+x.usd,0); },
        totalAssets() { return this.aggAssets().length; },
        topAssets() { return this.aggAssets().slice(0, this.topLimit); },
        allocPct(usd) { const t=this.allocTotal(); return t>0? (Number(usd)||0)/t*100 : 0; },
        top5() {
          const a=this.aggAssets(); const total=a.reduce((s,x)=>s+x.usd,0);
          const out=a.slice(0,4).map(x=>({ asset:x.asset, usd:x.usd, pct: total>0? x.usd/total*100:0, isOthers:false }));
          const oth=a.slice(4).reduce((s,x)=>s+x.usd,0);
          if (oth>0) out.push({ asset:'Others', usd:oth, pct: total>0? oth/total*100:0, isOthers:true });
          return out;
        },
        composition() {
          const m={ cex:0, onchain:0, manual:0 };
          for (const p of (this.overview.portfolios||[])) for (const a of (p.assets||[])) { if (a.usd>0 && m[a.origin]!==undefined) m[a.origin]+=a.usd; }
          return { cex:m.cex, onchain:m.onchain, manual:m.manual, total:m.cex+m.onchain+m.manual };
        },
        compPct(v) { const c=this.composition(); return c.total>0? (Number(v)||0)/c.total*100 : 0; },
        isStableAsset(sym) { return this.STABLES_SET.indexOf(sym)>=0 || this.FIATS_SET.indexOf(sym)>=0; },
        stableStats() {
          const a=this.aggAssets(); let stable=0,total=0;
          for (const x of a){ total+=x.usd; if (this.isStableAsset(x.asset)) stable+=x.usd; }
          return { stable:stable, risky: total-stable, total:total, stablePct: total>0? stable/total*100:0 };
        },
        movers() {
          const a=this.aggAssets(); const chg=this.overview.assetChange||{};
          const w=a.filter(x=>chg[x.asset]!==undefined && chg[x.asset]!==null).map(x=>({ asset:x.asset, usd:x.usd, pct:Number(chg[x.asset]) }));
          const s=w.slice().sort((p,q)=>q.pct-p.pct);
          return { best: s.filter(x=>x.pct>0).slice(0,3), worst: s.filter(x=>x.pct<0).slice(-3).reverse() };
        },
        perf() {
          let h=this.analysisHistory||[];
          // Ikuti rentang yang sedang ditampilkan di chart (zoom/pan).
          if (this.chartRange){
            const mn=this.chartRange.min, mx=this.chartRange.max;
            h=h.filter(x=>{ const t=Number(x.captured_at); return (mn==null||t>=mn)&&(mx==null||t<=mx); });
          }
          if (h.length<1) return { has:false, start:0, end:0, peak:0, low:0, abs:0, pct:null, up:true };
          const v=h.map(x=>Number(x.total_usd)||0);
          const start=v[0], end=v[v.length-1];
          let peak=v[0], low=v[0];
          for (const x of v){ if(x>peak)peak=x; if(x<low)low=x; }
          const abs=end-start; const pct= start>0? abs/start*100 : null;
          return { has:true, start:start, end:end, peak:peak, low:low, abs:abs, pct:pct, up: abs>=0 };
        },
        renderAnalysisChart() {
          const wrap=this.$refs.anaChartWrap;
          if (!wrap || typeof ApexCharts==='undefined' || !wrap.isConnected) return;
          if (wrap.clientWidth===0){ setTimeout(()=>this.renderAnalysisChart(),100); return; }
          const dark=this.darkMode, currency=this.displayCurrency, idrMult=currency==='IDR'?(this.idrRate||0):1, self=this;
          let pts=this.analysisHistory.map(h=>[Number(h.captured_at),Number(h.total_usd)*idrMult]);
          const MAX=150;
          if (pts.length>MAX){ const step=(pts.length-1)/(MAX-1); pts=Array.from({length:MAX},(_,i)=>pts[Math.round(i*step)]); }
          if (this.analysisChart){ this.analysisChart.destroy(); this.analysisChart=null; }
          if (pts.length===0) return;
          this.chartRange=null; // chart baru selalu mulai full-range
          this.analysisChart=new ApexCharts(wrap,{
            chart:{ type:'area', height:'100%', background:'transparent', animations:{ enabled:true, easing:'easeinout', speed:550, animateGradually:{enabled:false}, dynamicAnimation:{enabled:true,speed:400} }, toolbar:{ show:true, autoSelected:'zoom', tools:{ download:false, selection:false, zoom:true, zoomin:true, zoomout:true, pan:true, reset:true } }, zoom:{enabled:true,type:'x'}, events:{ zoomed:(ctx,o)=>{ const x=o&&o.xaxis; self.chartRange=(x&&(x.min!=null||x.max!=null))?{min:x.min,max:x.max}:null; }, scrolled:(ctx,o)=>{ const x=o&&o.xaxis; if(x&&(x.min!=null||x.max!=null)) self.chartRange={min:x.min,max:x.max}; }, beforeResetZoom:()=>{ self.chartRange=null; } }, fontFamily:'ui-sans-serif,system-ui,sans-serif' },
            theme:{ mode:dark?'dark':'light' },
            series:[{ name:currency, data:pts }],
            xaxis:{ type:'datetime', labels:{ style:{colors:dark?'#94a3b8':'#64748b',fontSize:'11px'}, datetimeUTC:false }, axisBorder:{show:false}, axisTicks:{show:false}, tooltip:{enabled:false} },
            yaxis:{ labels:{ style:{colors:dark?'#94a3b8':'#64748b',fontSize:'11px'}, formatter:(v)=>self.fmtAxis(v) }, tickAmount:4 },
            stroke:{ curve:'smooth', width:2, colors:['#6366f1'] },
            fill:{ type:'gradient', gradient:{ shade:'dark', type:'vertical', shadeIntensity:0.1, gradientToColors:['#6366f1'], inverseColors:false, opacityFrom:0.35, opacityTo:0, stops:[0,100] } },
            colors:['#6366f1'],
            grid:{ borderColor:dark?'rgba(148,163,184,0.14)':'rgba(100,116,139,0.14)', xaxis:{lines:{show:false}} },
            markers:{ size:0, hover:{size:5} },
            tooltip:{ theme:dark?'dark':'light', x:{format:'dd MMM yyyy HH:mm'}, y:{ formatter:(v)=>self.hideAmounts?(currency==='IDR'?'Rp ••••••':'$ ••••••'):(currency==='IDR'?'Rp '+Math.round(v).toLocaleString('en-US'):'$'+v.toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2})) } },
            dataLabels:{enabled:false}, legend:{show:false},
          });
          this.analysisChart.render();
        },
        renderAllocPie() {
          const wrap=this.$refs.allocWrap;
          if (!wrap || typeof ApexCharts==='undefined' || !wrap.isConnected) return;
          if (wrap.clientWidth===0){ setTimeout(()=>this.renderAllocPie(),100); return; }
          const items=this.top5();
          if (this.analysisPie){ this.analysisPie.destroy(); this.analysisPie=null; }
          if (items.length===0) return;
          const labels=items.map(x=>x.asset), data=items.map(x=>x.usd);
          const COLORS=this.ALLOC_COLORS;
          const dark=this.darkMode, currency=this.displayCurrency, idrRate=this.idrRate, self=this;
          const totalUsd=data.reduce((s,v)=>s+v,0);
          const totalDisp=currency==='IDR'?totalUsd*(idrRate||0):totalUsd;
          this.analysisPie=new ApexCharts(wrap,{
            chart:{ type:'donut', height:'100%', background:'transparent', animations:{enabled:false}, fontFamily:'ui-sans-serif,system-ui,sans-serif' },
            theme:{ mode:dark?'dark':'light' },
            series:data, labels,
            colors:COLORS.slice(0,labels.length),
            plotOptions:{ pie:{ expandOnClick:false, donut:{ size:'62%', labels:{ show:true,
              name:{ show:true, fontSize:'11px', color:dark?'#94a3b8':'#64748b', offsetY:-10 },
              value:{ show:true, fontSize:'20px', fontWeight:700, color:dark?'#e2e8f0':'#0f172a', offsetY:6, formatter:(v)=>{ if(self.hideAmounts) return '••••'; const n=Number(v); const d=currency==='IDR'?n*(idrRate||0):n; return self.fmtAxis(d); } },
              total:{ show:true, showAlways:true, label:'Total', fontSize:'11px', fontWeight:400, color:dark?'#94a3b8':'#64748b', formatter:(w)=>{ if(self.hideAmounts) return '••••'; const sum=w.globals.seriesTotals.reduce((a,b)=>a+b,0); return self.fmtAxis(currency==='IDR'?sum*(idrRate||0):sum); } }
            } } } },
            dataLabels:{enabled:false},
            legend:{show:false},
            tooltip:{ theme:dark?'dark':'light', y:{ formatter:(v)=>{ const pct=totalUsd>0?((v/totalUsd)*100).toFixed(1):'0.0'; const fmt=self.hideAmounts?'••••':(currency==='IDR'?'Rp '+Math.round(v*(idrRate||0)).toLocaleString('en-US'):'$'+v.toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2})); return fmt+' ('+pct+'%)'; } } },
            stroke:{ width:2, colors:[dark?'#1e293b':'#ffffff'] },
          });
          this.analysisPie.render();
        },

        async syncAll() {
          this.syncing=true;
          const r=await this.api('POST','/dashboard/sync', {});
          this.syncing=false;
          if (r&&r.ok) { this.flash('Sync complete ('+r.data.synced+' accounts)'); await Promise.all([this.loadOverview(),this.loadAccounts(),this.loadDeposits(),this.loadHistory()]); if(this.view==='analysis') this.loadAnalysis(); }
          else this.flash('Sync failed');
        },
        async syncAccount(id) {
          const r=await this.api('POST','/accounts/'+id+'/sync', {});
          if (r&&r.ok) { this.flash('Account synced'); await Promise.all([this.loadAccounts(),this.loadOverview()]); }
        },
        async backfillDeposits(id) {
          if (!confirm('Fetch FULL deposit history from the beginning? This runs in the background Worker (may take several minutes) and auto-resumes every 2 minutes.')) return;
          const r=await this.api('POST','/accounts/'+id+'/backfill-deposits', {});
          if (r&&r.ok) { this.flash('Backfill started — running in the background. Monitor status in the account card / Deposits tab.'); await this.loadAccounts(); }
          else if(r) this.flash(r.error);
        },

        openPortfolioModal(p) { this.pf = p ? { id:p.id, name:p.name, description:p.description||'' } : { id:null, name:'', description:'' }; this.modal='portfolio'; },
        async savePortfolio() {
          const body={ name:this.pf.name, description:this.pf.description };
          const r = this.pf.id ? await this.api('PUT','/portfolios/'+this.pf.id, body) : await this.api('POST','/portfolios', body);
          if (r&&r.ok) { this.modal=null; await this.loadPortfolios(); await this.loadOverview(); } else if(r) this.flash(r.error);
        },
        async deletePortfolio(id) { if(!confirm('Delete this portfolio and all its contents?')) return; const r=await this.api('DELETE','/portfolios/'+id); if(r&&r.ok){ await this.loadPortfolios(); await this.loadOverview(); } },

        openHoldingModal(h) { const amt=h?Math.abs(Number(h.amount)||0):null; this.hd = h ? { id:h.id, portfolio_id:h.portfolio_id, label:h.label, currency:h.currency||'USD', amountDisplay:amt?amt.toLocaleString('en-US',{maximumFractionDigits:8}):'', direction:(Number(h.amount)<0?'out':'in'), note:h.note||'', added_at:this.toDateInput(h.added_at||h.created_at) } : { id:null, portfolio_id:(this.portfolios[0]&&this.portfolios[0].id)||'', label:'', currency:'USD', amountDisplay:'', direction:'in', note:'', added_at:this.toDateInput(null) }; this.modal='holding'; },
        async saveHolding() {
          const mag = Math.abs(parseFloat((this.hd.amountDisplay||'').replace(/,/g,''))||0);
          const amount = this.hd.direction==='out' ? -mag : mag;
          const body={ portfolio_id:this.hd.portfolio_id, label:this.hd.label, currency:this.hd.currency, amount, note:this.hd.note, added_at:this.hd.added_at?new Date(this.hd.added_at).getTime():null };
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
