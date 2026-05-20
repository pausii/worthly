-- Wallet Tracker — skema awal
-- Catatan: D1 (SQLite). Semua timestamp disimpan sebagai epoch milidetik (INTEGER).

-- User aplikasi (single-user, tapi tabel dibuat generik).
CREATE TABLE IF NOT EXISTS users (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  username      TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  password_salt TEXT NOT NULL,
  iterations    INTEGER NOT NULL DEFAULT 600000,
  created_at    INTEGER NOT NULL,
  updated_at    INTEGER NOT NULL
);

-- Pengaturan aplikasi (key/value).
CREATE TABLE IF NOT EXISTS settings (
  key        TEXT PRIMARY KEY,
  value      TEXT,
  updated_at INTEGER NOT NULL
);

-- Portofolio = grup sumber (mis. "my-cex", "my-onchain").
CREATE TABLE IF NOT EXISTS portfolios (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  name        TEXT NOT NULL,
  description TEXT,
  sort_order  INTEGER NOT NULL DEFAULT 0,
  created_at  INTEGER NOT NULL,
  updated_at  INTEGER NOT NULL
);

-- Account = satu sumber data di dalam portofolio.
-- type: binance | bybit | tron | eth | bsc
-- enc_credentials: JSON terenkripsi AES-GCM (apiKey/secret untuk CEX; address/endpoint untuk on-chain).
-- config: JSON non-rahasia (mis. daftar token yang ditrack).
CREATE TABLE IF NOT EXISTS accounts (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  portfolio_id    INTEGER NOT NULL REFERENCES portfolios(id) ON DELETE CASCADE,
  type            TEXT NOT NULL,
  label           TEXT NOT NULL,
  enc_credentials TEXT,
  config          TEXT,
  enabled         INTEGER NOT NULL DEFAULT 1,
  status          TEXT,
  last_error      TEXT,
  last_synced_at  INTEGER,
  created_at      INTEGER NOT NULL,
  updated_at      INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_accounts_portfolio ON accounts(portfolio_id);

-- Holding manual (di luar CEX). asset_class: fiat | crypto.
CREATE TABLE IF NOT EXISTS manual_holdings (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  portfolio_id INTEGER NOT NULL REFERENCES portfolios(id) ON DELETE CASCADE,
  label        TEXT NOT NULL,
  asset_class  TEXT NOT NULL,
  currency     TEXT NOT NULL,
  amount       REAL NOT NULL,
  note         TEXT,
  created_at   INTEGER NOT NULL,
  updated_at   INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_manual_portfolio ON manual_holdings(portfolio_id);

-- Snapshot saldo terkini per account/wallet/asset.
-- wallet_type: spot | futures | earn | funding | onchain
CREATE TABLE IF NOT EXISTS balances (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  account_id  INTEGER NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  wallet_type TEXT NOT NULL,
  asset       TEXT NOT NULL,
  free        REAL NOT NULL DEFAULT 0,
  locked      REAL NOT NULL DEFAULT 0,
  total       REAL NOT NULL DEFAULT 0,
  updated_at  INTEGER NOT NULL,
  UNIQUE(account_id, wallet_type, asset)
);
CREATE INDEX IF NOT EXISTS idx_balances_account ON balances(account_id);

-- Riwayat deposit (dari CEX maupun on-chain incoming).
CREATE TABLE IF NOT EXISTS deposits (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  account_id INTEGER NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  tx_id      TEXT NOT NULL,
  asset      TEXT NOT NULL,
  amount     REAL NOT NULL,
  network    TEXT,
  address    TEXT,
  status     TEXT,
  ts         INTEGER NOT NULL,
  raw        TEXT,
  created_at INTEGER NOT NULL,
  UNIQUE(account_id, tx_id)
);
CREATE INDEX IF NOT EXISTS idx_deposits_account_ts ON deposits(account_id, ts);

-- Cache harga aset -> USD. USD selalu 1.
CREATE TABLE IF NOT EXISTS prices (
  asset      TEXT PRIMARY KEY,
  usd        REAL NOT NULL,
  source     TEXT,
  updated_at INTEGER NOT NULL
);

-- Snapshot nilai portofolio (untuk chart pergerakan nilai).
CREATE TABLE IF NOT EXISTS portfolio_snapshots (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  portfolio_id INTEGER NOT NULL REFERENCES portfolios(id) ON DELETE CASCADE,
  total_usd    REAL NOT NULL,
  captured_at  INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_snapshots_pf_time ON portfolio_snapshots(portfolio_id, captured_at);

-- State sinkronisasi per account (cursor pagination, last fetch time, dst).
CREATE TABLE IF NOT EXISTS sync_state (
  account_id INTEGER NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  key        TEXT NOT NULL,
  value      TEXT,
  updated_at INTEGER NOT NULL,
  PRIMARY KEY (account_id, key)
);
