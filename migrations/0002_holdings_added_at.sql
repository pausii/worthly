-- Tambah kolom added_at (kapan aset ditambahkan, diisi user).
-- Backfill dari created_at untuk data lama.
ALTER TABLE manual_holdings ADD COLUMN added_at INTEGER;
UPDATE manual_holdings SET added_at = created_at WHERE added_at IS NULL;
