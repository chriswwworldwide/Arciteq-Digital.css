BEGIN;

-- Imported bank/booking-app rows carry a fingerprint (date, direction,
-- amount, description, occurrence) so importing an overlapping statement
-- twice never double-counts. Voided rows don't block a re-import.
ALTER TABLE ledger_entries
  ADD COLUMN IF NOT EXISTS import_hash text;

CREATE UNIQUE INDEX IF NOT EXISTS ledger_entries_import_hash_uidx
  ON ledger_entries (tenant_id, import_hash)
  WHERE import_hash IS NOT NULL AND voided_at IS NULL;

COMMIT;
