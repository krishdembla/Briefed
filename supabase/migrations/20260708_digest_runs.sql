-- Tracks every invocation of the /api/email/send-digest cron so the admin
-- dashboard can show per-day digest history and surface silent failures.
CREATE TABLE IF NOT EXISTS digest_runs (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  started_at    timestamptz NOT NULL DEFAULT now(),
  finished_at   timestamptz,
  status        text        NOT NULL DEFAULT 'running'
                            CHECK (status IN ('running', 'success', 'error', 'skipped')),
  emails_sent   integer     NOT NULL DEFAULT 0,
  emails_failed integer     NOT NULL DEFAULT 0,
  pins_found    integer     NOT NULL DEFAULT 0,
  users_found   integer     NOT NULL DEFAULT 0,
  error_msg     text,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS digest_runs_started_at_idx ON digest_runs (started_at DESC);
