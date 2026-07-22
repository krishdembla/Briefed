-- ============================================================
-- Feature 2 (pivot): market takeaway
-- Editorial "why this news matters to these tickers" note, generated lazily
-- and cached forever per pin. Replaces the abandoned chart approach — real
-- chart data providers all rate-limit or bot-block, and a naked chart without
-- interpretation was decorative anyway. The takeaway explains the causal read.
-- ============================================================

CREATE TABLE IF NOT EXISTS pin_market_takeaways (
  pin_id       uuid PRIMARY KEY REFERENCES pins(id) ON DELETE CASCADE,
  sector_label text NOT NULL,
  takeaway_md  text NOT NULL,
  model        text NOT NULL,
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS pin_market_takeaways_created_idx
  ON pin_market_takeaways (created_at DESC);

ALTER TABLE pin_market_takeaways ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read market takeaways"
  ON pin_market_takeaways FOR SELECT
  TO authenticated
  USING (true);
