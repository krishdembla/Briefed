-- ============================================================
-- Briefed — initial schema
-- Run this in the Supabase SQL editor (Project > SQL Editor > New query)
-- ============================================================

-- Audit log for every pipeline run
CREATE TABLE IF NOT EXISTS pipeline_runs (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  started_at   timestamptz NOT NULL DEFAULT now(),
  finished_at  timestamptz,
  status       text NOT NULL DEFAULT 'running' CHECK (status IN ('running', 'success', 'error')),
  error_msg    text,
  pins_fetched int NOT NULL DEFAULT 0,
  pins_stored  int NOT NULL DEFAULT 0,
  pins_ai_done int NOT NULL DEFAULT 0
);

-- Core pins table
CREATE TABLE IF NOT EXISTS pins (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Source
  source_url     text NOT NULL UNIQUE,
  source_name    text NOT NULL,
  published_at   timestamptz NOT NULL,

  -- Content
  headline       text NOT NULL,
  raw_body       text,

  -- AI-generated card (null until ai_processed = true)
  summary        text,
  stat_1         text,
  stat_2         text,
  stat_3         text,

  -- Geo (null if story has no clear location)
  lat            double precision,
  lng            double precision,
  country_code   text,
  region_label   text,

  -- Taxonomy
  topic          text CHECK (topic IN ('politics', 'economy', 'climate', 'conflict', 'health', 'tech', 'other')),

  -- Pipeline bookkeeping
  pipeline_run_id  uuid REFERENCES pipeline_runs(id),
  ai_processed     boolean NOT NULL DEFAULT false,
  geo_processed    boolean NOT NULL DEFAULT false,
  created_at       timestamptz NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS pins_published_at_idx ON pins (published_at DESC);
CREATE INDEX IF NOT EXISTS pins_geo_idx          ON pins (lat, lng) WHERE lat IS NOT NULL;
CREATE INDEX IF NOT EXISTS pins_topic_idx        ON pins (topic);
CREATE INDEX IF NOT EXISTS pins_run_idx          ON pins (pipeline_run_id);

-- Row Level Security
-- Service role key bypasses RLS so the pipeline is unaffected.
-- Anon/authenticated access is blocked until we add explicit policies in Week 2.
ALTER TABLE pipeline_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE pins ENABLE ROW LEVEL SECURITY;
