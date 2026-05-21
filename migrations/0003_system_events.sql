-- Log event sistem: error HTTP, sync gagal, cooldown, dll.
CREATE TABLE IF NOT EXISTS system_events (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  level      TEXT NOT NULL,       -- 'error' | 'warning' | 'info'
  source     TEXT NOT NULL,       -- 'binance' | 'bybit' | 'evm' | 'tron' | 'backfill' | 'cron'
  account_id INTEGER REFERENCES accounts(id) ON DELETE SET NULL,
  message    TEXT NOT NULL,
  detail     TEXT,
  created_at INTEGER NOT NULL,
  read_at    INTEGER
);
CREATE INDEX IF NOT EXISTS idx_sysevents_created ON system_events(created_at DESC);
