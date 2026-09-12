-- Aset tetap (properti, kendaraan, emas fisik, dll) — tidak punya harga pasar otomatis.
-- Modal (purchase_price) dipakai untuk cost basis; nilai kini diambil dari valuasi terbaru.
-- kind: property | vehicle | gold | other
-- currency: mata uang nominal (mis. IDR), dikonversi ke USD lewat kurs fiat saat valuasi portofolio.
CREATE TABLE IF NOT EXISTS fixed_assets (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  portfolio_id   INTEGER NOT NULL REFERENCES portfolios(id) ON DELETE CASCADE,
  kind           TEXT NOT NULL,
  label          TEXT NOT NULL,
  currency       TEXT NOT NULL,
  purchase_price REAL NOT NULL,
  purchase_date  INTEGER NOT NULL,
  note           TEXT,
  created_at     INTEGER NOT NULL,
  updated_at     INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_fixed_assets_portfolio ON fixed_assets(portfolio_id);

-- Riwayat taksiran nilai. Valuasi dengan valued_at terbaru = nilai yang berlaku.
-- source: sumber taksiran (appraisal, NJOP, estimasi sendiri, ...).
CREATE TABLE IF NOT EXISTS fixed_asset_valuations (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  asset_id   INTEGER NOT NULL REFERENCES fixed_assets(id) ON DELETE CASCADE,
  value      REAL NOT NULL,
  valued_at  INTEGER NOT NULL,
  source     TEXT,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_fav_asset_time ON fixed_asset_valuations(asset_id, valued_at);
