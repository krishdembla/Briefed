-- ============================================================
-- Feature 1: pin primers ("What led to this?")
-- One primer per pin. Generated lazily on user click, cached forever.
-- ============================================================

CREATE TABLE IF NOT EXISTS pin_primers (
  pin_id       uuid PRIMARY KEY REFERENCES pins(id) ON DELETE CASCADE,
  primer_md    text NOT NULL,
  sources_used uuid[] NOT NULL DEFAULT '{}',
  -- from_coverage: primer built primarily from prior Briefed pins
  -- hybrid:        mix of prior pins + LLM general knowledge (sparse coverage)
  -- background_only: no relevant prior pins, LLM used its own knowledge
  -- no_backstory:  discrete event without significant prior context
  mode         text NOT NULL CHECK (mode IN ('from_coverage', 'hybrid', 'background_only', 'no_backstory')),
  model        text NOT NULL,
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS pin_primers_created_idx ON pin_primers (created_at DESC);

ALTER TABLE pin_primers ENABLE ROW LEVEL SECURITY;

-- Service role writes (via /api/pins/[id]/primer). Authenticated users read
-- directly if we ever bypass the API — matches the pins policy pattern.
CREATE POLICY "Authenticated users can read pin primers"
  ON pin_primers FOR SELECT
  TO authenticated
  USING (true);
