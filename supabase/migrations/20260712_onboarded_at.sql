-- Persist the "user completed onboarding" flag on user_preferences so it
-- survives cookie clears, new browsers, and sign-outs. Previously we only had
-- a `briefed_onboarded` browser cookie, so returning users kept getting
-- re-prompted to pick topics on every fresh sign-in.

ALTER TABLE user_preferences
  ADD COLUMN IF NOT EXISTS onboarded_at timestamptz;

-- Anyone with an existing row has already picked topics — treat them as
-- onboarded so this migration doesn't re-prompt them on next sign-in.
UPDATE user_preferences
   SET onboarded_at = COALESCE(onboarded_at, created_at)
 WHERE onboarded_at IS NULL;

CREATE INDEX IF NOT EXISTS user_preferences_onboarded_at_idx
  ON user_preferences (onboarded_at);
