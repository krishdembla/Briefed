-- ============================================================
-- Feature 2: market impact ("news ↔ ticker overlay")
-- Adds ticker classification to pins + cache table for chart candles.
-- ============================================================

-- Ticker classification lives on pins itself — small, always-loaded together.
ALTER TABLE pins
  ADD COLUMN IF NOT EXISTS tickers               text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS market_relevance      text
    CHECK (market_relevance IN ('high', 'medium', 'low', 'none')),
  ADD COLUMN IF NOT EXISTS market_classified_at  timestamptz;

-- Partial index — the UI only surfaces high/medium relevance, so keep the
-- index scoped to those rows to stay small.
CREATE INDEX IF NOT EXISTS pins_market_relevance_idx
  ON pins (market_relevance)
  WHERE market_relevance IN ('high', 'medium');

-- ------------------------------------------------------------
-- Chart candle cache
-- Historical daily candles never change, so cached rows have effectively
-- infinite TTL. Key is (symbol, from_date, to_date) — different requested
-- windows for the same symbol just produce independent rows; cost is tiny.
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS chart_cache (
  symbol     text        NOT NULL,
  from_date  date        NOT NULL,
  to_date    date        NOT NULL,
  candles    jsonb       NOT NULL,
  fetched_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (symbol, from_date, to_date)
);

CREATE INDEX IF NOT EXISTS chart_cache_symbol_idx ON chart_cache (symbol);

ALTER TABLE chart_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read chart cache"
  ON chart_cache FOR SELECT
  TO authenticated
  USING (true);
