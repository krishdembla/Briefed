-- ============================================================
-- Card retention features: OG image, why_it_matters, pin reads, reactions
-- ============================================================

-- New columns on pins (NULL for existing rows — UI handles gracefully)
ALTER TABLE pins ADD COLUMN IF NOT EXISTS og_image_url   TEXT;
ALTER TABLE pins ADD COLUMN IF NOT EXISTS why_it_matters TEXT;

-- ── pin_reads read-count index ──────────────────────────────
-- pin_reads table already exists (created prior to migrations).
-- Add the index needed for fast read-count lookups if not present.
CREATE INDEX IF NOT EXISTS pin_reads_pin_idx ON pin_reads (pin_id);

-- Allow authenticated users to read all rows (needed for COUNT queries
-- from the reactions API route which runs under the service role).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'pin_reads' AND policyname = 'Authenticated users can read all pin_reads'
  ) THEN
    CREATE POLICY "Authenticated users can read all pin_reads"
      ON pin_reads FOR SELECT TO authenticated USING (true);
  END IF;
END $$;

-- ── Per-user pin reactions ──────────────────────────────────
CREATE TABLE IF NOT EXISTS pin_reactions (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  pin_id      UUID NOT NULL REFERENCES pins(id)       ON DELETE CASCADE,
  reaction    TEXT NOT NULL CHECK (reaction IN ('fire', 'complex', 'useful')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, pin_id, reaction)
);

CREATE INDEX IF NOT EXISTS pin_reactions_pin_idx ON pin_reactions (pin_id);

ALTER TABLE pin_reactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read all pin_reactions"
  ON pin_reactions FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can insert own pin_reactions"
  ON pin_reactions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own pin_reactions"
  ON pin_reactions FOR DELETE
  USING (auth.uid() = user_id);
