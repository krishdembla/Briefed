# Connect-the-Dots — Full Build Spec

Causal "connect-the-dots" links between news pins: draw dotted lines on the map
between events that are causally related (e.g. "US strikes Iran → closes Strait
of Hormuz" ⟶ "India oil prices spike"), with a clickable card explaining the link.

Grounded in the current codebase:
- Map pin clicks set `expandedPin` and render inline in the feed panel
  (`components/map/MapContainer.tsx:275-281`), not a floating card.
- All pins already live in `MapContainer` state, so the client can resolve
  relation endpoints locally.
- `pins.tags` (`string[]`) is already populated by the AI summarizer
  (`lib/ai/summarize.ts:49`, stored `pipeline/run.ts:261`) — reused for cheap
  candidate filtering.
- Existing `pin_relations` table + `detectThreads` pipeline step + `/related`
  API are reused/extended.

Provider is Groq Qwen3 (cheap), which is why total daily LLM cost is ~10¢.

---

## 0. Scope & naming

Two link *types* live in the existing `pin_relations` table:
- **`continuation`** — same story, later update (what `detectThreads` already
  produces; surfaces as "related" in detail view).
- **`consequence`** — *new* — a causal/knock-on link across events/topics.
  **These are the ones drawn as lines on the map.**

Design principle throughout: label consequence links clearly as **AI-inferred**
and gate them behind a high confidence bar — causal claims are the highest
trust-risk content in the app.

---

## 1. Data model

`pin_relations` isn't in a migration file today (created ad hoc, like
`pins.tags`). This migration formalizes it *and* extends it. Idempotent so it's
safe whether or not the table exists.

```sql
-- supabase/migrations/20260711_consequence_relations.sql
CREATE TABLE IF NOT EXISTS pin_relations (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pin_id_a    uuid NOT NULL REFERENCES pins(id) ON DELETE CASCADE,
  pin_id_b    uuid NOT NULL REFERENCES pins(id) ON DELETE CASCADE,
  confidence  double precision NOT NULL DEFAULT 0,
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (pin_id_a, pin_id_b)
);

-- New columns (NULL-safe for existing continuation rows)
ALTER TABLE pin_relations
  ADD COLUMN IF NOT EXISTS relation_type text NOT NULL DEFAULT 'continuation'
    CHECK (relation_type IN ('continuation', 'consequence'));
ALTER TABLE pin_relations
  ADD COLUMN IF NOT EXISTS explanation text;                 -- causal mechanism, shown in card
ALTER TABLE pin_relations
  ADD COLUMN IF NOT EXISTS direction text
    CHECK (direction IN ('a_to_b', 'b_to_a'));               -- which pin is cause → effect

CREATE INDEX IF NOT EXISTS pin_relations_a_idx    ON pin_relations (pin_id_a);
CREATE INDEX IF NOT EXISTS pin_relations_b_idx    ON pin_relations (pin_id_b);
CREATE INDEX IF NOT EXISTS pin_relations_type_idx ON pin_relations (relation_type);
```

- `pin_id_a`/`pin_id_b` stay **canonically ordered** (smaller UUID first) for
  dedup — reuse the existing `canonicalPair()` from `detectThreads.ts`.
- `direction` records the causal arrow independent of canonical ordering:
  cause = A if `a_to_b`, else B. Drives arrowhead + card ordering.
- Existing continuation rows default cleanly; `detectThreads` needs no change.
- A pair can only have one relation row (unique constraint). A pair being both
  continuation and consequence is rare (consequence is cross-topic, continuation
  is same-story) — accept first-writer-wins for MVP.

---

## 2. Candidate generation (the cost lever — no LLM)

This is what keeps it at ~2–4¢/day. **Never** feed all-new × all-recent to the
model. Pre-filter cheaply using data we already have:

For each **new geolocated pin** from this run, a recent pin (past
`CONSEQUENCE_WINDOW_DAYS = 5`, excluding this run, has lat/lng + summary) is a
**candidate** iff **either**:
1. **Tag overlap** — shares ≥1 entry in `tags` (e.g. both tagged `"oil"`), OR
2. **Geographic proximity** — within ~1500 km great-circle (knock-on effects are
   often regional).

Cross-topic is explicitly *allowed* (that's the whole point — conflict→economy).
Then:
- Cap candidates per new pin to top `MAX_CANDIDATES_PER_PIN = 12`, ranked by
  (tag-overlap count desc, recency desc).
- Drop new pins with zero candidates (no LLM call at all).

Turns an O(N×M) LLM problem into a bounded set: only new pins with plausible
antecedents get a call, each seeing ≤12 candidates.

---

## 3. Detection pass — `lib/ai/detectConsequences.ts`

Mirrors `detectThreads.ts` structure (same `callLLM`, same canonical dedup, same
non-fatal contract).

```ts
export async function detectConsequences(runId: string): Promise<number> {
  // 1. New geolocated pins from this run (id, headline, summary, topic, tags, lat, lng, published_at)
  // 2. Recent geolocated pins, past CONSEQUENCE_WINDOW_DAYS, excluding runId, summary NOT NULL, limit ~300
  // 3. For each new pin: build candidate set via §2 (tag overlap OR proximity), cap at MAX_CANDIDATES_PER_PIN
  // 4. For each new pin WITH candidates: ONE LLM call — prompt = new pin + numbered candidates
  // 5. Parse JSON; keep matches with confidence >= CONSEQUENCE_CONFIDENCE_MIN (0.8)
  // 6. canonicalPair(newId, candidateId); set direction from the model's cause/effect;
  //    upsert { pin_id_a, pin_id_b, relation_type:'consequence', confidence, explanation, direction }
  //    onConflict 'pin_id_a,pin_id_b', ignoreDuplicates:true
  // 7. Log each match (like detectThreads) and return count
}
```

Constants (new `lib/ai/consequenceConfig.ts` or inline):
- `CONSEQUENCE_WINDOW_DAYS = 5`
- `MAX_CANDIDATES_PER_PIN = 12`
- `CONSEQUENCE_CONFIDENCE_MIN = 0.8` (higher than threads' 0.7 — causal bar is stricter)
- `PROXIMITY_KM = 1500`

One call per new-pin-with-candidates keeps prompts small and outputs bounded. If
daily new-pin volume ever spikes, batch multiple new pins into one call — future
optimization, not needed now.

---

## 4. Prompt — `prompts/detect-consequences.txt`

```
You are a geopolitical/economics analyst identifying CAUSAL links between news events.

You are given ONE new event and a numbered list of EARLIER events. Identify which
earlier events (if any) are a genuine CAUSE or DRIVER of the new event, OR which the
new event is a direct consequence of.

A match requires ALL of:
- A concrete causal mechanism you can state in one sentence (event X did Y, which led to Z).
- The link is specific and non-obvious, not mere shared topic, country, or keyword.
- Confidence >= 0.8.

NOT a match:
- Two events that merely share a region, sector, or tag but have no causal chain.
- Generic "both about the economy / both in the Middle East" similarity.
- Coincidental timing with no mechanism.

For each match, state DIRECTION: which event is the CAUSE and which is the EFFECT.

NEW EVENT:
"{{newHeadline}}" | {{newSummary}} | tags: {{newTags}} | {{newDate}}

EARLIER EVENTS:
{{candidates}}   // each line: [i] "headline" | summary | tags | date

Return ONLY a JSON array (empty if none qualify):
[{"index": <number>, "confidence": <0.8-1.0>, "cause": "new" | "earlier",
  "explanation": "<one clear sentence naming the causal mechanism>"}]
No markdown, no prose outside the JSON.
```

- `cause: "earlier"` → earlier pin is cause, new pin is effect → maps to `direction`.
- The `explanation` is stored verbatim and shown in the card.

---

## 5. Pipeline integration

In `pipeline/run.ts`, call it right after `detectThreads`, with the same
non-fatal guard (a thrown error must never fail the run):

```ts
try {
  await detectConsequences(runId);
} catch (err) {
  console.error("[pipeline] consequence detection failed (non-fatal):", err);
}
```

Runs once per daily pipeline — no new cron, no change to `maxDuration`
expectations beyond a handful of extra small LLM calls.

---

## 6. Serving API — `GET /api/relations`

Returns consequence relations within the active window, resolved to compact pin
objects server-side (like `/related` does) so the card always renders even if an
endpoint pin is filtered out of the client's set.

```
GET /api/relations?days=5&type=consequence
→ [{
    id, confidence, explanation,
    cause:  { id, headline, topic, region_label, published_at, source_name, lat, lng },
    effect: { id, headline, topic, region_label, published_at, source_name, lat, lng }
  }, ...]
```

- Filters to relations where **both** pins are geolocated and within `days`.
- Service-role client (bypasses RLS), same as existing pin routes.
- `MapContainer` fetches this alongside `/api/pins` and holds `relations` in state.

---

## 7. UI — map lines

Add a second, **non-clustered** GeoJSON source in `BriefedMap.tsx`, fed a
`LineString` per relation. Two layers (standard Mapbox pattern):

```tsx
<Source id="relations" type="geojson" data={relationsGeojson}>
  {/* Wide invisible hit target for easy clicking/tapping */}
  <Layer id="relations-hit" type="line"
    paint={{ "line-width": 16, "line-opacity": 0, "line-color": "#000" }} />
  {/* Visible dotted connection */}
  <Layer id="relations-line" type="line"
    layout={{ "line-cap": "round" }}
    paint={{
      "line-color": "#a9762f",              // ochre "insight" accent, distinct from topic dots
      "line-width": ["case", ["==", ["get","id"], activeRelationId ?? ""], 2.5, 1.4],
      "line-opacity": ["case", ["==", ["get","id"], activeRelationId ?? ""], 0.95, 0.4],
      "line-dasharray": [2, 2],
    }} />
</Source>
```

Add `"relations-hit"` to `interactiveLayerIds`, and in `handleClick`, when
`layerId === "relations-hit"` call a new `onRelationClick(feature.properties)`.

**Arc, not straight line.** A straight geodesic clips through other pins and
reads as a border. Bow each connection with a gentle quadratic Bézier —
hand-rolled, **no new dependency** (CLAUDE.md forbids silent installs; `turf` is
unnecessary here):

```ts
// lib/map/arc.ts — midpoint offset perpendicular to the A→B chord, ~15 interpolated points
function arcBetween(a: [number, number], b: [number, number]): [number, number][] { /* ... */ }
```

**Direction cue.** A `symbol` layer over `relations-line` with
`symbol-placement: "line"`, `"text-field": "▸"`, spaced along the arc, oriented
toward the **effect** end. MVP-optional; the card already conveys direction.

**Clutter control** (critical — avoids a spider-web):
- Lines render faint by default (`opacity 0.4`) so the feature is discoverable.
- When a pin is active (`activePinId`) **or** a relation is active, its line(s)
  go bold/opaque and others dim — filter-driven, cheap.
- Hide the whole `relations` source below `zoom < 2.5` (tunable) so the world
  view stays clean.
- Optional global cap: top `MAX_VISIBLE_RELATIONS = 40` by confidence.

---

## 8. UI — the connection card

New state in `MapContainer`: `activeRelation: RelationDTO | null`, set by
`onRelationClick`, cleared on dismiss. New component
`components/relations/ConnectionCard.tsx`.

**Placement:** a centered overlay modal on the map (a relation spans two
locations — it isn't "a pin," so the feed-panel `expandedPin` slot is the wrong
home). Reuses the app's paper/rule/serif tokens.

```
┌─────────────────────────────────────────────┐
│  ⟿  HOW THESE CONNECT        AI-inferred · 0.9│   ← label + confidence, dismiss ✕
├──────────────────────┬──────────────────────┤
│  ● CONFLICT   3d ago  │  ● ECONOMY   today    │
│  US strikes Iran,     │  Indian oil prices    │   ← two mini pin cards,
│  closes Strait of     │  spike 12%            │     cause (left) → effect (right)
│  Hormuz               │  New Delhi · Reuters  │
│  Tehran · AP          │                       │
├──────────────────────┴──────────────────────┤
│           ⟶  (animated dotted arrow)          │
│  "Closing the Strait of Hormuz choked ~20%    │   ← explanation, editorial serif
│   of seaborne crude, driving the price spike   │     (same style as why_it_matters)
│   India imports feel first."                   │
└─────────────────────────────────────────────┘
```

Behaviors:
- Each mini card is clickable → calls existing `handleMapPinClick(pin)` (opens
  that pin's full detail in the feed panel) and `flyTo` its coords; closes the
  connection card.
- Cause/effect ordering from `direction`.
- Confidence shown subtly (e.g. `0.9` or a small "high confidence" pip),
  reinforcing the AI-inferred framing.
- Dismiss on ✕, Esc, or backdrop click.
- Mobile: same card as a bottom sheet.

---

## 9. UI — detail-view entry point (non-map discovery)

Not everyone explores the map. In `FeedDetail.tsx`, add a **"Connections"**
section (distinct from the existing continuation "related" list), rendered when
the pin has consequence relations:

- Each row: topic dot + other pin's headline + a one-line clipped explanation.
- Row click opens the same `ConnectionCard`.
- Fetched via the pin's relations (either from the already-loaded `relations`
  set, or a `?pinId=` filter on `/api/relations`).

Gives the feature a home for users who never open the map tab.

---

## 10. Cost & guardrails

- **Cost:** with §2's tag/geo pre-filter, ~30–60K tokens/day on Groq Qwen3 →
  **~2–4¢/day** added (≈13–14¢ total). The pre-filter is the entire difference
  from the ~10–15¢ naive path.
- **Hallucination is the real risk, not dollars.** Mitigations, all in-spec: 0.8
  confidence floor; prompt demands a stated mechanism and rejects topical-only
  matches; every surface labels it **AI-inferred**; explanation must cite
  specifics. Consider a lightweight admin/QA view to eyeball new consequence rows
  during rollout.
- **Both endpoints must be geolocated** for a line; a relation lacking geo is
  still stored and can appear in the detail-view "Connections" list (no line).
- **Non-fatal** in the pipeline, matching `detectThreads`.

---

## 11. Build order

1. **Phase 1 — Detection (backend, invisible):** migration §1 + `detectConsequences.ts`
   §3 + prompt §4 + pipeline hook §5. Run pipeline, inspect `pin_relations` rows
   by hand. *This is where you validate causal-detection quality before spending
   any UI effort.*
2. **Phase 2 — Serving:** `/api/relations` §6, wire `relations` into
   `MapContainer` state.
3. **Phase 3 — Map lines:** §7 source/layers/arc + clutter control.
4. **Phase 4 — Connection card:** §8.
5. **Phase 5 — Detail-view Connections:** §9.

---

## 12. Testing

- Unit: `arcBetween` (endpoints preserved, bow direction), candidate-generation
  filter (tag overlap + proximity), JSON parse/threshold in `detectConsequences`
  (reuse the `__tests__` patterns already present).
- Integration: `/api/relations` shape + geo/window filtering (mirror
  `__tests__/api/pins.test.ts`).
- Manual: seed two known-causal pins, run pipeline, confirm line renders, click →
  card, click mini-card → detail opens.

---

## Open decisions (worth a sanity check before Phase 1)

- **(a)** Map lines are scoped to `consequence` relations only (continuations
  stay in the detail list, not drawn) to avoid clutter.
- **(b)** The connection card is a centered map overlay, not the feed-panel
  detail slot.

Both are reversible.

---

## 13. Auth + Onboarding fixes (bundled with this build)

Three unrelated auth/onboarding papercuts get fixed in the same PR because they
share the same code paths (`proxy.ts`, `app/auth/page.tsx`, `app/onboarding/page.tsx`,
`user_preferences`). All three are execute-immediately, not deferred.

### 13.1 Onboarded state is not persistent per user (topic re-prompt every sign-in)

**Bug.** `proxy.ts:39` reads only the `briefed_onboarded` browser cookie to
decide whether to force `/onboarding`. A user who has already picked topics
(row exists in `user_preferences`) still gets re-prompted after clearing
cookies, using a new browser, or signing in on another device.

**Fix.**
- **Migration** `supabase/migrations/20260712_onboarded_at.sql`:
  ```sql
  ALTER TABLE user_preferences
    ADD COLUMN IF NOT EXISTS onboarded_at timestamptz;
  -- Existing rows have already completed onboarding — backfill so returning
  -- users don't get re-prompted after this deploys.
  UPDATE user_preferences
     SET onboarded_at = COALESCE(onboarded_at, created_at)
   WHERE onboarded_at IS NULL;
  ```
- `lib/db/preferences.ts` — `savePreferences` also writes
  `onboarded_at: new Date().toISOString()` in the upsert (idempotent on repeat).
- `proxy.ts` — when the cookie is missing but the user is authenticated,
  query `user_preferences.onboarded_at` with the same request-scoped supabase
  client already created for `getUser()`. If non-null, treat as onboarded and
  set the cookie on the outgoing response so the next request skips the DB.
  If null, redirect to `/onboarding` as today. **Read cost:** one extra
  primary-key lookup per authenticated request that lacks the cookie —
  bounded by "until cookie is set."

### 13.2 Signup → onboarding page requires a manual refresh before Save works

**Bug.** `app/onboarding/page.tsx:38-43` fetches the user in a `useEffect` and
stores `userId` in state. `handleSave` reads that state, so the first render
after Supabase's confirmation-link redirect has `userId === null` and the Save
handler bails with "Session not ready — please wait a moment and try again."
A refresh works because the session cookie is now present at load time.

**Fix.**
- Disable the Save + Skip buttons while `userId` is `null`, with a subtle
  "Loading your account…" hint — no more silent race.
- In `handleSave`, if `userId` is still null, call `supabase.auth.getUser()`
  once inline and use its result; only surface an error if that also fails.
- `app/auth/page.tsx` signup: pass
  `emailRedirectTo: ${window.location.origin}/auth/callback?next=/onboarding`
  so the confirmation-link lands users on the onboarding page with the session
  cookie already set by `/auth/callback`'s `exchangeCodeForSession`.
- If Supabase auto-confirmation is enabled (i.e. `signUp` returns
  `data.session`), navigate straight to `/onboarding` instead of showing the
  "check your inbox" message — avoids leaving a signed-in user staring at the
  signup form.

### 13.3 New signups don't receive a confirmation email

**Bug.** Users report not receiving Supabase's default confirmation email.
Two failure modes: (a) Supabase project has confirmations disabled, or
(b) Supabase's default sender is going to spam. Either way, from the app's
perspective the user never hears from us after signup.

**Fix (in-code).** Ship a branded welcome email from our own Resend account,
which we already use for the daily digest.
- `emails/BriefedWelcome.tsx` — React Email template matching the digest
  visual style (dark bg, serif "Briefed" heading, single CTA to `/map`).
- `app/api/auth/welcome/route.ts` — POST endpoint. Requires an authenticated
  session (server-side supabase check); reads the caller's email from the
  session, not from the request body (prevents send-to-anyone abuse). Sends
  via the existing `Resend` client. Non-fatal: logs and returns 200 even on
  send failure so signup UX is never blocked by email infra.
- `app/auth/page.tsx` — after a successful `signUp`, fires a fire-and-forget
  `POST /api/auth/welcome`. If Supabase returned a session immediately, the
  request has the cookie; if not, we skip (Supabase's own confirm email is
  responsible in that path).
- **Out of scope (dashboard action, not code):** ensure Supabase Auth →
  Email settings has confirmation enabled and SMTP pointed at Resend for
  deliverability. Documented in `.env.example` / README notes.

### 13.4 Build order for §13

Do these before or after Phase 1 of the consequence build — they touch
independent files:

1. Migration §13.1 + `savePreferences` write.
2. `proxy.ts` DB fallback + cookie set on hit.
3. Onboarding page race fix + auth `emailRedirectTo`.
4. Welcome email template + `/api/auth/welcome` + auth-page trigger.
