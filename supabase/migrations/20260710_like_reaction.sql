-- ============================================================
-- Fix: allow 'like' as a pin reaction
-- ============================================================
-- The pin_reactions.reaction CHECK constraint was originally written for the
-- old three-emoji reaction set ('fire', 'complex', 'useful'). The UI has since
-- moved to a single "like" reaction, but the constraint was never updated, so
-- every INSERT of 'like' fails and the optimistic like in the UI rolls back
-- (heart fills then disappears). Widen the constraint to include 'like'.
--
-- We keep the legacy values in the allowed set so any historical rows remain
-- valid and the ALTER doesn't fail validation.

ALTER TABLE pin_reactions
  DROP CONSTRAINT IF EXISTS pin_reactions_reaction_check;

ALTER TABLE pin_reactions
  ADD CONSTRAINT pin_reactions_reaction_check
  CHECK (reaction IN ('like', 'fire', 'complex', 'useful'));
