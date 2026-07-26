-- Multi-topic pins: a single pin can belong to 1-2 topics
-- (e.g. semiconductor company financials → economy + tech).
-- `topic` remains the canonical/primary topic (drives map colour, headline pill,
-- default label). `topics` is the full set including the primary at index 0.

ALTER TABLE pins
  ADD COLUMN IF NOT EXISTS topics text[] NOT NULL DEFAULT '{}';

-- Backfill existing rows: every pin's `topics` starts as [topic] so the new
-- filter logic sees the same set of matches as the old single-topic filter.
UPDATE pins
  SET topics = ARRAY[topic]
  WHERE topic IS NOT NULL
    AND (topics IS NULL OR array_length(topics, 1) IS NULL);

-- GIN index enables efficient `topics @> ARRAY['tech']` lookups if we ever
-- push topic filtering to Postgres. Filtering is currently client-side but
-- adding the index now costs nothing and future-proofs the schema.
CREATE INDEX IF NOT EXISTS pins_topics_gin_idx ON pins USING GIN (topics);
