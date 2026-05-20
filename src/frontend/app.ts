// App shell (SPA Alpine). Tailwind + Alpine + Chart.js via CDN.
// Catatan: hindari penggunaan `${` dan backtick di dalam <script> karena file ini template literal.
export const appHtml = `<!doctype html>
<html lang="id" class="h-full">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
  <meta name="robots" content="noindex,nofollow" />
  <title>Dashboard — Wallet Tracker</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <script defer src="https://cdn.jsdelivr.net/npm/chart.js@4.4.3/dist/chart.umd.min.js"></script>
  <script defer src="https://cdn.jsdelivr.net/npm/alpinejs@3.x.x/dist/cdn.min.js"></script>
  <style>
    [x-cloak]{display:none!important}
    ::-webkit-scrollbar{width:8px;height:8px}
    ::-webkit-scrollbar-thumb{background:#cbd5e1;border-radius:9999px}
  </style>
</head>
<body class="h-full bg-slate-100 text-slate-900 antialiased">
<div x-data="app()" x-init="init()" x-cloak class="flex h-full">

  <!-- Overlay mobile -->
  <div x-show="sidebarOpen" @click="sidebarOpen=false" class="fixed inset-0 z-20 bg-slate-900/40 lg:hidden"></div>

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
          class="group flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition"
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
          <button @click="logout()" class="text-[11px] text-indigo-200/80 hover:text-white">Keluar</button>
        </div>
      </div>
    </div>
  </aside>

  <!-- Main -->
  <div class="flex min-w-0 flex-1 flex-col">
    <!-- Topbar -->
    <header class="sticky top-0 z-10 flex items-center gap-3 border-b border-slate-200 bg-white/80 px-4 py-3 backdrop-blur lg:px-6">
      <button @click="sidebarOpen=!sidebarOpen" class="rounded-lg p-2 text-slate-600 hover:bg-slate-100 lg:hidden">
        <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M4 6h16M4 12h16M4 18h16"/></svg>
      </button>
      <h1 class="text-base font-semibold capitalize" x-text="navLabel()"></h1>
      <div class="ml-auto flex items-center gap-3">
        <div class="hidden text-right sm:block">
          <div class="text-[11px] uppercase tracking-wide text-slate-400">Total Nilai</div>
          <div class="text-sm font-semibold text-slate-900" x-text="fmtUsd(overview.grandTotalUsd||0)"></div>
        </div>
        <button @click="syncAll()" :disabled="syncing"
          class="flex items-center gap-2 rounded-xl bg-indigo-600 px-3 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-indigo-700 disabled:opacity-60">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" :class="syncing&&'animate-spin'" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/></svg>
          <span x-text="syncing ? 'Sinkron…' : 'Sinkron'"></span>
        </button>
      </div>
    </header>

    <main class="flex-1 overflow-y-auto p-4 lg:p-6">
      <p x-show="toast" x-text="toast" class="mb-4 rounded-xl bg-indigo-50 px-4 py-2 text-sm text-indigo-700"></p>

      <!-- DASHBOARD -->
      <section x-show="view==='dashboard'" class="space-y-6">
        <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div class="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div class="text-[11px] uppercase tracking-wide text-slate-400">Total Portofolio</div>
            <div class="mt-1 text-2xl font-semibold" x-text="fmtUsd(overview.grandTotalUsd||0)"></div>
          </div>
          <div class="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div class="text-[11px] uppercase tracking-wide text-slate-400">Jumlah Grup</div>
            <div class="mt-1 text-2xl font-semibold" x-text="overview.portfolios.length"></div>
          </div>
          <div class="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div class="text-[11px] uppercase tracking-wide text-slate-400">Account Tersambung</div>
            <div class="mt-1 text-2xl font-semibold" x-text="accounts.length"></div>
          </div>
          <div class="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div class="text-[11px] uppercase tracking-wide text-slate-400">Account Bermasalah</div>
            <div class="mt-1 text-2xl font-semibold text-rose-600" x-text="accounts.filter(a=>a.status==='error').length"></div>
          </div>
        </div>

        <div class="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div class="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 class="text-sm font-semibold">Pergerakan Nilai (USD)</h3>
              <p class="text-xs text-slate-400">Dari snapshot berkala</p>
            </div>
            <div class="flex items-center gap-2">
              <select x-model="historyPortfolio" @change="loadHistory()" class="rounded-lg border border-slate-300 px-2 py-1.5 text-xs">
                <option value="">Semua portofolio</option>
                <template x-for="p in portfolios" :key="p.id"><option :value="p.id" x-text="p.name"></option></template>
              </select>
              <select x-model.number="historyRange" @change="loadHistory()" class="rounded-lg border border-slate-300 px-2 py-1.5 text-xs">
                <option :value="7">7 hari</option><option :value="30">30 hari</option><option :value="90">90 hari</option>
              </select>
            </div>
          </div>
          <div class="relative h-64"><canvas x-ref="chart"></canvas></div>
          <p x-show="history.length===0" class="mt-2 text-center text-xs text-slate-400">Belum ada snapshot. Data terbentuk otomatis sesuai interval.</p>
        </div>

        <div class="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <template x-for="p in overview.portfolios" :key="p.id">
            <div class="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div class="mb-3 flex items-center justify-between">
                <div>
                  <h3 class="text-sm font-semibold" x-text="p.name"></h3>
                  <p class="text-xs text-slate-400" x-text="p.description || ''"></p>
                </div>
                <div class="text-right">
                  <div class="text-lg font-semibold" x-text="fmtUsd(p.totalUsd)"></div>
                </div>
              </div>
              <div class="space-y-1.5">
                <template x-for="a in p.assets.slice(0,8)" :key="a.asset+a.origin">
                  <div class="flex items-center justify-between text-sm">
                    <div class="flex items-center gap-2">
                      <span class="inline-flex h-5 items-center rounded-full px-2 text-[10px] font-medium"
                        :class="a.origin==='manual' ? 'bg-amber-100 text-amber-700' : a.origin==='onchain' ? 'bg-emerald-100 text-emerald-700' : 'bg-indigo-100 text-indigo-700'"
                        x-text="a.origin"></span>
                      <span class="font-medium" x-text="a.asset"></span>
                      <span class="text-slate-400" x-text="fmtNum(a.amount)"></span>
                    </div>
                    <span class="text-slate-700" x-text="fmtUsd(a.usd)"></span>
                  </div>
                </template>
                <p x-show="p.assets.length===0" class="text-xs text-slate-400">Belum ada aset.</p>
              </div>
            </div>
          </template>
          <p x-show="overview.portfolios.length===0" class="text-sm text-slate-400">Belum ada portofolio. Buat di menu Portofolio.</p>
        </div>
      </section>

      <!-- PORTOFOLIO -->
      <section x-show="view==='portfolios'" class="space-y-4">
        <div class="flex justify-end">
          <button @click="openPortfolioModal()" class="rounded-xl bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-700">+ Portofolio</button>
        </div>
        <div class="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <table class="min-w-full divide-y divide-slate-100 text-sm">
            <thead class="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-400">
              <tr><th class="px-4 py-3">Nama</th><th class="px-4 py-3">Deskripsi</th><th class="px-4 py-3 text-right">Aksi</th></tr>
            </thead>
            <tbody class="divide-y divide-slate-100">
              <template x-for="p in portfolios" :key="p.id">
                <tr>
                  <td class="px-4 py-3 font-medium" x-text="p.name"></td>
                  <td class="px-4 py-3 text-slate-500" x-text="p.description||'—'"></td>
                  <td class="px-4 py-3 text-right">
                    <button @click="openPortfolioModal(p)" class="text-xs text-indigo-600 hover:underline">Edit</button>
                    <button @click="deletePortfolio(p.id)" class="ml-3 text-xs text-rose-600 hover:underline">Hapus</button>
                  </td>
                </tr>
              </template>
              <tr x-show="portfolios.length===0"><td colspan="3" class="px-4 py-6 text-center text-slate-400">Belum ada portofolio.</td></tr>
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
            <div class="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <div class="flex items-start justify-between">
                <div>
                  <div class="flex items-center gap-2">
                    <span class="rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-semibold uppercase text-slate-600" x-text="a.type"></span>
                    <span class="font-medium" x-text="a.label"></span>
                  </div>
                  <div class="mt-1 text-xs text-slate-400" x-text="portfolioName(a.portfolio_id)"></div>
                </div>
                <span class="rounded-full px-2 py-0.5 text-[11px] font-medium"
                  :class="a.status==='ok' ? 'bg-emerald-100 text-emerald-700' : a.status==='error' ? 'bg-rose-100 text-rose-700' : 'bg-slate-100 text-slate-500'"
                  x-text="a.status||'pending'"></span>
              </div>
              <div class="mt-2 text-xs text-slate-400">
                <span x-show="a.last_synced_at">Sinkron: <span x-text="timeAgo(a.last_synced_at)"></span></span>
                <span x-show="!a.last_synced_at">Belum pernah sinkron</span>
              </div>
              <p x-show="a.last_error" x-text="a.last_error" class="mt-2 rounded-lg bg-rose-50 px-2 py-1 text-[11px] text-rose-600"></p>
              <div class="mt-3 flex gap-2">
                <button @click="syncAccount(a.id)" class="rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-medium hover:bg-slate-200">Sinkron</button>
                <button @click="openAccountModal(a)" class="rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-medium hover:bg-slate-200">Edit</button>
                <button @click="deleteAccount(a.id)" class="ml-auto rounded-lg px-3 py-1.5 text-xs font-medium text-rose-600 hover:bg-rose-50">Hapus</button>
              </div>
            </div>
          </template>
          <p x-show="accounts.length===0" class="text-sm text-slate-400">Belum ada account. Tambahkan Binance/Bybit atau wallet on-chain.</p>
        </div>
      </section>

      <!-- HOLDINGS -->
      <section x-show="view==='holdings'" class="space-y-4">
        <div class="flex justify-end">
          <button @click="openHoldingModal()" class="rounded-xl bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-700">+ Holding Manual</button>
        </div>
        <div class="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <table class="min-w-full divide-y divide-slate-100 text-sm">
            <thead class="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-400">
              <tr><th class="px-4 py-3">Label</th><th class="px-4 py-3">Portofolio</th><th class="px-4 py-3">Aset</th><th class="px-4 py-3 text-right">Jumlah</th><th class="px-4 py-3 text-right">Aksi</th></tr>
            </thead>
            <tbody class="divide-y divide-slate-100">
              <template x-for="h in holdings" :key="h.id">
                <tr>
                  <td class="px-4 py-3 font-medium" x-text="h.label"></td>
                  <td class="px-4 py-3 text-slate-500" x-text="portfolioName(h.portfolio_id)"></td>
                  <td class="px-4 py-3"><span class="rounded bg-slate-100 px-1.5 py-0.5 text-[11px]" x-text="h.currency"></span> <span class="text-[11px] text-slate-400" x-text="h.asset_class"></span></td>
                  <td class="px-4 py-3 text-right" x-text="fmtNum(h.amount)"></td>
                  <td class="px-4 py-3 text-right">
                    <button @click="openHoldingModal(h)" class="text-xs text-indigo-600 hover:underline">Edit</button>
                    <button @click="deleteHolding(h.id)" class="ml-3 text-xs text-rose-600 hover:underline">Hapus</button>
                  </td>
                </tr>
              </template>
              <tr x-show="holdings.length===0"><td colspan="5" class="px-4 py-6 text-center text-slate-400">Belum ada holding manual.</td></tr>
            </tbody>
          </table>
        </div>
      </section>

      <!-- DEPOSITS -->
      <section x-show="view==='deposits'" class="space-y-4">
        <div class="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <table class="min-w-full divide-y divide-slate-100 text-sm">
            <thead class="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-400">
              <tr><th class="px-4 py-3">Waktu</th><th class="px-4 py-3">Account</th><th class="px-4 py-3">Aset</th><th class="px-4 py-3 text-right">Jumlah</th><th class="px-4 py-3">Network</th><th class="px-4 py-3">Status</th></tr>
            </thead>
            <tbody class="divide-y divide-slate-100">
              <template x-for="d in deposits" :key="d.id">
                <tr>
                  <td class="px-4 py-3 text-slate-500" x-text="fmtDate(d.ts)"></td>
                  <td class="px-4 py-3"><span x-text="d.account_label"></span> <span class="text-[11px] text-slate-400" x-text="d.portfolio_name"></span></td>
                  <td class="px-4 py-3 font-medium" x-text="d.asset"></td>
                  <td class="px-4 py-3 text-right" x-text="fmtNum(d.amount)"></td>
                  <td class="px-4 py-3 text-slate-500" x-text="d.network||'—'"></td>
                  <td class="px-4 py-3"><span class="rounded-full px-2 py-0.5 text-[11px]" :class="d.status==='success'||d.status==='credited' ? 'bg-emerald-100 text-emerald-700':'bg-slate-100 text-slate-500'" x-text="d.status"></span></td>
                </tr>
              </template>
              <tr x-show="deposits.length===0"><td colspan="6" class="px-4 py-6 text-center text-slate-400">Belum ada data deposit.</td></tr>
            </tbody>
          </table>
        </div>
      </section>

      <!-- SETTINGS -->
      <section x-show="view==='settings'" class="max-w-md space-y-4">
        <div class="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h3 class="mb-4 text-sm font-semibold">Ganti Password</h3>
          <form @submit.prevent="changePassword()" class="space-y-3">
            <input x-model="pw.current" type="password" placeholder="Password saat ini" class="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm" />
            <input x-model="pw.next" type="password" placeholder="Password baru (min 10)" class="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm" />
            <button class="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700">Simpan</button>
          </form>
        </div>
      </section>
    </main>
  </div>

  <!-- MODAL: Portofolio -->
  <div x-show="modal==='portfolio'" class="fixed inset-0 z-40 flex items-center justify-center p-4">
    <div @click="modal=null" class="absolute inset-0 bg-slate-900/40"></div>
    <div class="relative w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
      <h3 class="mb-4 text-base font-semibold" x-text="pf.id ? 'Edit Portofolio' : 'Portofolio Baru'"></h3>
      <form @submit.prevent="savePortfolio()" class="space-y-3">
        <input x-model="pf.name" placeholder="Nama (mis. my-cex)" class="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm" />
        <textarea x-model="pf.description" placeholder="Deskripsi" rows="2" class="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm"></textarea>
        <div class="flex justify-end gap-2 pt-2">
          <button type="button" @click="modal=null" class="rounded-xl px-4 py-2 text-sm text-slate-600 hover:bg-slate-100">Batal</button>
          <button class="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700">Simpan</button>
        </div>
      </form>
    </div>
  </div>

  <!-- MODAL: Holding -->
  <div x-show="modal==='holding'" class="fixed inset-0 z-40 flex items-center justify-center p-4">
    <div @click="modal=null" class="absolute inset-0 bg-slate-900/40"></div>
    <div class="relative w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
      <h3 class="mb-4 text-base font-semibold" x-text="hd.id ? 'Edit Holding' : 'Holding Manual Baru'"></h3>
      <form @submit.prevent="saveHolding()" class="space-y-3">
        <select x-model.number="hd.portfolio_id" class="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm">
          <option value="">Pilih portofolio…</option>
          <template x-for="p in portfolios" :key="p.id"><option :value="p.id" x-text="p.name"></option></template>
        </select>
        <input x-model="hd.label" placeholder="Label (mis. Tabungan BCA)" class="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm" />
        <div class="grid grid-cols-2 gap-3">
          <select x-model="hd.asset_class" class="rounded-xl border border-slate-300 px-3 py-2.5 text-sm">
            <option value="fiat">Fiat</option><option value="crypto">Crypto</option>
          </select>
          <input x-model="hd.currency" placeholder="IDR / USD / BTC" class="rounded-xl border border-slate-300 px-3 py-2.5 text-sm uppercase" />
        </div>
        <input x-model.number="hd.amount" type="number" step="any" placeholder="Jumlah (mis. 100000000)" class="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm" />
        <input x-model="hd.note" placeholder="Catatan (opsional)" class="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm" />
        <div class="flex justify-end gap-2 pt-2">
          <button type="button" @click="modal=null" class="rounded-xl px-4 py-2 text-sm text-slate-600 hover:bg-slate-100">Batal</button>
          <button class="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700">Simpan</button>
        </div>
      </form>
    </div>
  </div>

  <!-- MODAL: Account -->
  <div x-show="modal==='account'" class="fixed inset-0 z-40 flex items-center justify-center p-4">
    <div @click="modal=null" class="absolute inset-0 bg-slate-900/40"></div>
    <div class="relative max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-6 shadow-xl">
      <h3 class="mb-4 text-base font-semibold" x-text="ac.id ? 'Edit Account' : 'Account Baru'"></h3>
      <form @submit.prevent="saveAccount()" class="space-y-3">
        <div class="grid grid-cols-2 gap-3">
          <select x-model="ac.type" :disabled="ac.id" class="rounded-xl border border-slate-300 px-3 py-2.5 text-sm disabled:bg-slate-100">
            <option value="binance">Binance</option><option value="bybit">Bybit</option>
            <option value="eth">Ethereum</option><option value="bsc">BSC</option><option value="tron">Tron</option>
          </select>
          <select x-model.number="ac.portfolio_id" class="rounded-xl border border-slate-300 px-3 py-2.5 text-sm">
            <option value="">Portofolio…</option>
            <template x-for="p in portfolios" :key="p.id"><option :value="p.id" x-text="p.name"></option></template>
          </select>
        </div>
        <input x-model="ac.label" placeholder="Label (mis. Binance Utama)" class="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm" />

        <!-- CEX -->
        <template x-if="ac.type==='binance' || ac.type==='bybit'">
          <div class="space-y-3 rounded-xl bg-slate-50 p-3">
            <p class="text-xs text-slate-500">Gunakan API key <b>read-only</b> (tanpa izin trade/withdraw). Key disimpan terenkripsi.</p>
            <input x-model="ac.apiKey" :placeholder="ac.id ? 'API Key (kosongkan jika tidak diubah)' : 'API Key'" class="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm" />
            <input x-model="ac.apiSecret" type="password" :placeholder="ac.id ? 'API Secret (kosongkan jika tidak diubah)' : 'API Secret'" class="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm" />
          </div>
        </template>

        <!-- ON-CHAIN -->
        <template x-if="ac.type==='eth' || ac.type==='bsc' || ac.type==='tron'">
          <div class="space-y-3 rounded-xl bg-slate-50 p-3">
            <input x-model="ac.address" placeholder="Address wallet" class="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm" />
            <input x-model="ac.rpcUrl" placeholder="QuickNode RPC URL (opsional, pakai default jika kosong)" class="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm" />
            <label class="flex items-center gap-2 text-sm"><input type="checkbox" x-model="ac.trackNative" /> Track native coin</label>
            <div class="space-y-2">
              <div class="flex items-center justify-between"><span class="text-xs font-medium text-slate-600">Token yang ditrack</span>
                <button type="button" @click="ac.tokens.push({contract:'',symbol:'',decimals:18})" class="text-xs text-indigo-600">+ token</button></div>
              <template x-for="(t,i) in ac.tokens" :key="i">
                <div class="grid grid-cols-12 gap-2">
                  <input x-model="t.contract" placeholder="Contract" class="col-span-6 rounded-lg border border-slate-300 px-2 py-1.5 text-xs" />
                  <input x-model="t.symbol" placeholder="Simbol" class="col-span-3 rounded-lg border border-slate-300 px-2 py-1.5 text-xs uppercase" />
                  <input x-model.number="t.decimals" type="number" placeholder="Dec" class="col-span-2 rounded-lg border border-slate-300 px-2 py-1.5 text-xs" />
                  <button type="button" @click="ac.tokens.splice(i,1)" class="col-span-1 text-rose-500">✕</button>
                </div>
              </template>
            </div>
          </div>
        </template>

        <p x-show="ac.error" x-text="ac.error" class="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-600"></p>
        <div class="flex justify-end gap-2 pt-2">
          <button type="button" @click="modal=null" class="rounded-xl px-4 py-2 text-sm text-slate-600 hover:bg-slate-100">Batal</button>
          <button class="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700">Simpan</button>
        </div>
      </form>
    </div>
  </div>

  <script>
    function app() {
      return {
        view: 'dashboard', sidebarOpen: false, csrf: '', username: '',
        syncing: false, toast: '', modal: null,
        nav: [
          { id:'dashboard', label:'Dashboard', icon:'<svg xmlns=\\'http://www.w3.org/2000/svg\\' class=\\'h-5 w-5\\' fill=\\'none\\' viewBox=\\'0 0 24 24\\' stroke=\\'currentColor\\' stroke-width=\\'2\\'><path stroke-linecap=\\'round\\' stroke-linejoin=\\'round\\' d=\\'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6\\'/></svg>' },
          { id:'portfolios', label:'Portofolio', icon:'<svg xmlns=\\'http://www.w3.org/2000/svg\\' class=\\'h-5 w-5\\' fill=\\'none\\' viewBox=\\'0 0 24 24\\' stroke=\\'currentColor\\' stroke-width=\\'2\\'><path stroke-linecap=\\'round\\' stroke-linejoin=\\'round\\' d=\\'M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10\\'/></svg>' },
          { id:'accounts', label:'Accounts', icon:'<svg xmlns=\\'http://www.w3.org/2000/svg\\' class=\\'h-5 w-5\\' fill=\\'none\\' viewBox=\\'0 0 24 24\\' stroke=\\'currentColor\\' stroke-width=\\'2\\'><path stroke-linecap=\\'round\\' stroke-linejoin=\\'round\\' d=\\'M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-2m-3-7h6m-3-3v6\\'/></svg>' },
          { id:'holdings', label:'Holding Manual', icon:'<svg xmlns=\\'http://www.w3.org/2000/svg\\' class=\\'h-5 w-5\\' fill=\\'none\\' viewBox=\\'0 0 24 24\\' stroke=\\'currentColor\\' stroke-width=\\'2\\'><path stroke-linecap=\\'round\\' stroke-linejoin=\\'round\\' d=\\'M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1\\'/></svg>' },
          { id:'deposits', label:'Deposit', icon:'<svg xmlns=\\'http://www.w3.org/2000/svg\\' class=\\'h-5 w-5\\' fill=\\'none\\' viewBox=\\'0 0 24 24\\' stroke=\\'currentColor\\' stroke-width=\\'2\\'><path stroke-linecap=\\'round\\' stroke-linejoin=\\'round\\' d=\\'M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4\\'/></svg>' },
          { id:'settings', label:'Pengaturan', icon:'<svg xmlns=\\'http://www.w3.org/2000/svg\\' class=\\'h-5 w-5\\' fill=\\'none\\' viewBox=\\'0 0 24 24\\' stroke=\\'currentColor\\' stroke-width=\\'2\\'><path stroke-linecap=\\'round\\' stroke-linejoin=\\'round\\' d=\\'M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z\\'/><path stroke-linecap=\\'round\\' stroke-linejoin=\\'round\\' d=\\'M15 12a3 3 0 11-6 0 3 3 0 016 0z\\'/></svg>' }
        ],
        overview: { portfolios: [], grandTotalUsd: 0 },
        portfolios: [], accounts: [], holdings: [], deposits: [],
        history: [], historyRange: 30, historyPortfolio: '', chart: null,
        pf: { id:null, name:'', description:'' },
        hd: { id:null, portfolio_id:'', label:'', asset_class:'fiat', currency:'', amount:null, note:'' },
        ac: { id:null, type:'binance', portfolio_id:'', label:'', apiKey:'', apiSecret:'', address:'', rpcUrl:'', trackNative:true, tokens:[], error:'' },
        pw: { current:'', next:'' },

        async init() {
          const me = await this.api('GET','/auth/me');
          if (!me) return;
          this.csrf = me.data.csrf; this.username = me.data.username;
          await this.loadPortfolios();
          await Promise.all([this.loadOverview(), this.loadAccounts(), this.loadHoldings(), this.loadDeposits()]);
          await this.loadHistory();
        },

        async api(method, path, body) {
          const opts = { method, headers: {} };
          if (body !== undefined) { opts.headers['Content-Type']='application/json'; opts.body=JSON.stringify(body); }
          if (method !== 'GET') opts.headers['X-CSRF-Token'] = this.csrf;
          const res = await fetch('/api'+path, opts);
          if (res.status === 401) { location.href='/login'; return null; }
          const data = await res.json().catch(()=>({ ok:false, error:'Respon tidak valid' }));
          return data;
        },

        go(id) { this.view = id; this.sidebarOpen = false; if (id==='dashboard') this.$nextTick(()=>this.renderChart()); },
        navLabel() { const n=this.nav.find(x=>x.id===this.view); return n?n.label:''; },
        portfolioName(id) { const p=this.portfolios.find(x=>x.id===id); return p?p.name:'—'; },
        flash(msg) { this.toast = msg; setTimeout(()=>{ this.toast=''; }, 3000); },

        fmtUsd(n) { return '$'+(Number(n)||0).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2}); },
        fmtNum(n) { const v=Number(n)||0; return v.toLocaleString('en-US',{maximumFractionDigits:8}); },
        fmtDate(ts) { if(!ts) return '—'; return new Date(Number(ts)).toLocaleString('id-ID'); },
        timeAgo(ts) { if(!ts) return '—'; const s=Math.floor((Date.now()-Number(ts))/1000); if(s<60) return s+'d lalu'; if(s<3600) return Math.floor(s/60)+'m lalu'; if(s<86400) return Math.floor(s/3600)+'j lalu'; return Math.floor(s/86400)+'h lalu'; },

        async loadOverview() { const r=await this.api('GET','/dashboard/overview'); if(r&&r.ok) this.overview=r.data; },
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
          const el = this.$refs.chart; if(!el || typeof Chart==='undefined') return;
          const labels = this.history.map(h=>new Date(Number(h.captured_at)).toLocaleDateString('id-ID',{day:'2-digit',month:'short'}));
          const data = this.history.map(h=>Number(h.total_usd));
          if (this.chart) this.chart.destroy();
          this.chart = new Chart(el, {
            type:'line',
            data:{ labels, datasets:[{ label:'USD', data, borderColor:'#6366f1', backgroundColor:'rgba(99,102,241,0.12)', fill:true, tension:0.3, pointRadius:2 }] },
            options:{ responsive:true, maintainAspectRatio:false, plugins:{ legend:{ display:false } }, scales:{ y:{ ticks:{ callback:(v)=>'$'+Number(v).toLocaleString('en-US') } } } }
          });
        },

        async syncAll() {
          this.syncing=true;
          const r=await this.api('POST','/dashboard/sync', {});
          this.syncing=false;
          if (r&&r.ok) { this.flash('Sinkronisasi selesai ('+r.data.synced+' account)'); await Promise.all([this.loadOverview(),this.loadAccounts(),this.loadDeposits(),this.loadHistory()]); }
          else this.flash('Sinkronisasi gagal');
        },
        async syncAccount(id) {
          const r=await this.api('POST','/accounts/'+id+'/sync', {});
          if (r&&r.ok) { this.flash('Account disinkron'); await Promise.all([this.loadAccounts(),this.loadOverview()]); }
        },

        openPortfolioModal(p) { this.pf = p ? { id:p.id, name:p.name, description:p.description||'' } : { id:null, name:'', description:'' }; this.modal='portfolio'; },
        async savePortfolio() {
          const body={ name:this.pf.name, description:this.pf.description };
          const r = this.pf.id ? await this.api('PUT','/portfolios/'+this.pf.id, body) : await this.api('POST','/portfolios', body);
          if (r&&r.ok) { this.modal=null; await this.loadPortfolios(); await this.loadOverview(); } else if(r) this.flash(r.error);
        },
        async deletePortfolio(id) { if(!confirm('Hapus portofolio ini beserta isinya?')) return; const r=await this.api('DELETE','/portfolios/'+id); if(r&&r.ok){ await this.loadPortfolios(); await this.loadOverview(); } },

        openHoldingModal(h) { this.hd = h ? { id:h.id, portfolio_id:h.portfolio_id, label:h.label, asset_class:h.asset_class, currency:h.currency, amount:h.amount, note:h.note||'' } : { id:null, portfolio_id:(this.portfolios[0]&&this.portfolios[0].id)||'', label:'', asset_class:'fiat', currency:'', amount:null, note:'' }; this.modal='holding'; },
        async saveHolding() {
          const body={ portfolio_id:this.hd.portfolio_id, label:this.hd.label, asset_class:this.hd.asset_class, currency:this.hd.currency, amount:this.hd.amount, note:this.hd.note };
          const r = this.hd.id ? await this.api('PUT','/holdings/'+this.hd.id, body) : await this.api('POST','/holdings', body);
          if (r&&r.ok) { this.modal=null; await this.loadHoldings(); await this.loadOverview(); } else if(r) this.flash(r.error);
        },
        async deleteHolding(id) { if(!confirm('Hapus holding ini?')) return; const r=await this.api('DELETE','/holdings/'+id); if(r&&r.ok){ await this.loadHoldings(); await this.loadOverview(); } },

        openAccountModal(a) {
          if (a) {
            const cfg = a.config || {};
            this.ac = { id:a.id, type:a.type, portfolio_id:a.portfolio_id, label:a.label, apiKey:'', apiSecret:'', address:cfg.address||'', rpcUrl:'', trackNative:cfg.trackNative!==false, tokens:(cfg.tokens||[]).map(t=>({...t})), error:'' };
          } else {
            this.ac = { id:null, type:'binance', portfolio_id:(this.portfolios[0]&&this.portfolios[0].id)||'', label:'', apiKey:'', apiSecret:'', address:'', rpcUrl:'', trackNative:true, tokens:[], error:'' };
          }
          this.modal='account';
        },
        async saveAccount() {
          this.ac.error='';
          const body={ type:this.ac.type, portfolio_id:this.ac.portfolio_id, label:this.ac.label };
          if (this.ac.type==='binance'||this.ac.type==='bybit') { if(this.ac.apiKey) body.apiKey=this.ac.apiKey; if(this.ac.apiSecret) body.apiSecret=this.ac.apiSecret; }
          else { body.address=this.ac.address; body.trackNative=this.ac.trackNative; body.tokens=this.ac.tokens; if(this.ac.rpcUrl) body.rpcUrl=this.ac.rpcUrl; }
          const r = this.ac.id ? await this.api('PUT','/accounts/'+this.ac.id, body) : await this.api('POST','/accounts', body);
          if (r&&r.ok) { this.modal=null; await this.loadAccounts(); if(this.ac.id===null && r.data.id){ await this.syncAccount(r.data.id);} } else if(r) this.ac.error=r.error;
        },
        async deleteAccount(id) { if(!confirm('Hapus account ini?')) return; const r=await this.api('DELETE','/accounts/'+id); if(r&&r.ok){ await this.loadAccounts(); await this.loadOverview(); } },

        async changePassword() {
          if (this.pw.next.length<10) { this.flash('Password baru minimal 10 karakter'); return; }
          const r=await this.api('POST','/auth/change-password', { current:this.pw.current, next:this.pw.next });
          if (r&&r.ok) { this.pw={current:'',next:''}; this.flash('Password berhasil diganti'); } else if(r) this.flash(r.error);
        },
        async logout() { await this.api('POST','/auth/logout', {}); location.href='/login'; }
      };
    }
  </script>
</div>
</body>
</html>`;
