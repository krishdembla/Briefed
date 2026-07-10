# UI Upgrade Plan — "Ship-ready" pass

Builds on the Broadsheet redesign (branch `worktree-broadsheet-redesign`). Goal:
take the app from "nicely styled" to "credible enough to onboard real users."

Five workstreams. Each is tagged **[frontend-only]** (safe, ship immediately) or
**[pipeline/data]** (touches ingestion/prompts, needs a pipeline re-run + review).

> ⚠️ **Pipeline re-run note.** Items 3, 4, and 5 change ingestion, prompts, or
> both. None take effect on existing rows until the pipeline re-runs. Per project
> convention we verify last-run recency and only re-run with a genuine reason —
> here the reason is "new sports coverage + richer summaries." We run it **once**,
> manually, after the pipeline changes land and are reviewed.

---

## 1. Profile page — fill the desktop width [frontend-only]

**Problem.** `app/profile/page.tsx` wraps everything in `max-w-md mx-auto` — a
single ~448px mobile column centered on a wide screen, with large empty paper
margins on laptop. Wasteful and reads as unfinished.

**Approach — responsive dashboard.** Keep the single stacked column on mobile;
on `md+` promote to a two-column masonry/bento dashboard inside a wider container
(`max-w-5xl`).

- **Full-width header band**: avatar + email on the left, the three stat figures
  (streak / best / check-ins) as large serif numerals on the right — a proper
  masthead-style header instead of a small stat-card row.
- **Two-column body on `md+`** (single column on mobile):
  - Left: streak calendar (can grow to a fuller 12-week contribution grid to earn
    its space), digest frequency, share-streak card.
  - Right: Saved collections, Reading history.
- Use CSS `columns`/grid so cards flow and fill; no fixed heights.

**Files:** `app/profile/page.tsx` (layout only; `SavedSection`, `ReadingHistory`
already restyled — reuse as-is).

**Risk:** low. Pure layout. Verify mobile still stacks cleanly.

---

## 2. Feed cards — slim horizontal list, thumbnail on the right [frontend-only]

**Problem.** `FeedCard.tsx` renders a full-width 16:9 image *header* on top of each
card. Big, clunky, magazine-y — and every mediocre image is shown at full size.
Reference screenshot: a tight list where each row is text-left / small-thumbnail-right.

**Approach — reformat the card entirely.**

- New layout per card: a horizontal row.
  - **Left (flex-1):** topic dot + label, serif headline (2 lines max), a one-line
    meta row (source · region · time · read-time).
  - **Right (fixed):** a small **96×96** (approx) rounded thumbnail, `object-cover`.
- **Remove the inline expand-in-place behavior.** Today a click expands the card to
  show summary + why-it-matters + stats *inside the list* — that's what leaks ~40%
  of the detail content (see item 4). The slim card becomes a pure list item:
  one tap → opens the full detail view. Simpler, denser, and makes "open" meaningful.
- Denser vertical rhythm: hairline dividers between rows instead of separate bordered
  cards, so the feed reads like a newspaper index. (Active/selected row still gets the
  left topic-color rule + subtle raise.)
- Read state = reduced opacity, as now.

**Interaction with item 3:** the small fixed thumbnail *is itself* a big mitigation
for poor images — flaws are far less visible at 96px than full-width.

**Files:** `components/feed/FeedCard.tsx` (rewrite render), minor spacing in
`FeedPanel.tsx` (list container, skeletons).

**Risk:** medium. This changes the core interaction (no more inline expand). The
`IntersectionObserver` "activate on scroll" logic and `onOpen` stay; only the
expand state is removed. Verify map-pin ↔ feed sync still works.

**Open decision:** thumbnail shape — **rounded square (96px)** [recommended, densest]
vs. a taller **3:2 rounded rect**. Default to rounded square unless you prefer the rect.

---

## 3. Image quality — the honest, shippable options [pipeline/data + frontend]

**Problem.** Low-res/placeholder/logo images from feeds break the aesthetic.

**On the computer-vision idea (super-resolution / ESRGAN-style filter).** Real, and
you learned it this semester — but it's the wrong tool here. It needs a model +
meaningful compute per image, runs poorly in a Vercel/serverless pipeline, adds a
fragile dependency, and still can't invent detail in a 120px logo. This is exactly
the "clever and fragile" infra the project guidelines say to avoid. Recommend we
**not** build CV super-res. Instead, attack the root cause with three cheap layers:

**Layer A — Quality-gate at ingest [pipeline/data] (highest ROI).**
When storing a pin, reject images that are obviously bad *before* they reach the UI:
- Fetch the image `HEAD`/dimensions; drop if width < ~400px or aspect ratio is
  extreme (banners/logos).
- URL denylist for known placeholder/logo patterns (e.g. `/logo`, `default`, 1×1
  trackers, source-brand sprites).
- Store `og_image_url = null` when gated. A gated card simply renders **text-only**
  (clean, intentional) rather than showing a broken/ugly image.

**Layer B — Better extraction [pipeline/data].**
Today we only take NewsAPI `urlToImage` / RSS `og:image` (RSS items often have
none — `newsapi.ts:155`, `run.ts:247`). Add fallbacks: parse the article page's
`og:image` → `twitter:image` → first large `<article> img`. More candidates =
more good images, especially for the RSS half of the feed.

**Layer C — Consistent rendering [frontend-only].**
Render the (now smaller, item-2) thumbnails through a uniform pipeline:
`object-cover`, fixed box, subtle paper background while loading, graceful
text-only fallback on error. Optionally adopt `next/image` for automatic
resizing/compression (needs `next.config` `images.remotePatterns` + CSP review).

**Recommendation:** A + B + C. Explicitly skip CV super-res. Net effect: fewer
images shown, but the ones shown are good and uniform — which reads as *premium*.

**Files:** `pipeline/run.ts` (gate on store), new `lib/images/quality.ts`
(dimension/denylist checks), `pipeline/sources/*.ts` (extraction fallback),
`FeedCard.tsx` + `FeedDetail.tsx` (rendering/fallback).

**Risk:** medium. Extra network fetches per article at ingest (bounded, with
timeout + retry per project rules). Needs the re-run to populate.

---

## 4. Opened-card view — kill the AI vibe, add real substance [pipeline/data + frontend]

**Problem.** (a) The "Why it matters" labeled callout screams AI-generated.
(b) Opening a card barely differs from the feed snippet — because the card's
inline-expand and the detail view render the **same** `summary` string, and item 2
already removes that leak. But the detail itself is still thin.

**Root cause on depth.** `process-article.txt` asks for 150–200 words, but the
source body is often ~200 chars (NewsAPI free tier truncates `content`;
`summarize.ts`/`processArticle.ts` send `body.slice(0, 3000)` but there's little
to slice). So summaries pad out generic. We fix both the *format* and the *source*.

**Approach.**

**4a. Replace "Why it matters" with an editorial standfirst [frontend + prompt].**
Instead of a colored labeled box, render it as a **standfirst / dek**: a single
italic serif line directly under the headline (how real papers lead), or a serif
pull-quote with a thin left rule — no "Why it matters" label, no tinted box.
Reuses the existing `why_it_matters` field; just restyled. (Prompt tweak: make it
read as a standfirst sentence, not an "importance" statement.)

**4b. Give the detail view a real structure [frontend].**
Make "open" clearly worth it:
- **Standfirst** (4a) under the headline.
- **The brief** — the full summary as 2 short paragraphs (body serif, comfortable
  measure), visibly longer than anything shown in the feed.
- **Key facts** — the 3 stats promoted from tiny chips to a proper figure block
  (big serif numerals + label), the signature stat treatment.
- **Topic tags** as small chips (see note below).
- Source row with favicon + read-time; keep like / save / share / related.

**4c. Actually lengthen the summary [pipeline/data].**
- Update `process-article.txt` to emit a richer, structured summary (e.g. a
  `standfirst` + a 2-paragraph `brief`), and to explicitly note when the source
  body is thin so it doesn't hallucinate specifics.
- Where feasible, feed more source text (prefer RSS full content; for NewsAPI,
  the description+content is the ceiling — documented limitation).
- **Tags:** the active `process-article.txt` doesn't emit `tags` (only the unused
  `summarize.txt` does), so existing pins have null tags. Add `tags` to the active
  prompt so 4b's tag chips have data. Cheap, high-substance win.

**Files:** `components/feed/FeedDetail.tsx` (restructure), `prompts/process-article.txt`
(standfirst + longer brief + tags), `lib/ai/processArticle.ts` (parse new fields),
possibly `types/map.ts` / DB (only if we split summary into standfirst+brief columns —
otherwise reuse `why_it_matters` + `summary`).

**Risk:** medium. Prompt/format changes need the re-run. Keep DB changes minimal —
prefer reusing existing columns (`why_it_matters` = standfirst, `summary` = brief)
over a migration.

---

## 5. Sports coverage — currently near-zero by design [pipeline/data]

**Problem.** Only ~3 sports stories, all World Cup. Confirmed causes:
1. **No sports query.** `newsapi.ts` has topic queries for politics/economy/tech/
   climate/health/regions — **none for sports**.
2. **Sports sources are blocked.** `newsapi.ts:12-15` denylists ESPN, Bleacher
   Report, The Athletic, Sky Sports, Goal, NBA.com, etc.
3. **No sports RSS feeds** in `rss.ts`.
4. **The active prompt can't label sports.** `process-article.txt:9` topic enum is
   `politics|economy|climate|conflict|health|tech|other` — **no `sports`**. So even
   a stray sports story becomes "other". (DB constraint already allows `sports`.)

**Approach.**
- Add a dedicated **sports query** to `newsapi.ts` covering leagues/competitions:
  NFL, NBA, MLB, NHL, Premier League / La Liga / Serie A / Bundesliga / UCL,
  transfers, F1, tennis Grand Slams, cricket, plus "transfer" / "trade" / "playoffs".
- **Un-block quality sports sources** (move ESPN, The Athletic, Sky Sports, Goal out
  of the denylist) — keep tabloids blocked.
- Add a few **sports RSS feeds** (e.g. BBC Sport, ESPN, Guardian Football) to `rss.ts`.
- Add **`sports`** to `process-article.txt`'s topic enum (+ a geo hint: map a league
  to its city/country, e.g. Premier League → London; NFL → US) so sports pins get
  placed on the map sensibly.
- Sanity-cap sports volume in clustering so it doesn't swamp the feed.

**Files:** `pipeline/sources/newsapi.ts`, `pipeline/sources/rss.ts`,
`prompts/process-article.txt`, possibly `pipeline/run.ts` (topic balancing).

**Risk:** low-medium. More sources = more volume; watch dedup and the per-run
`MAX_ARTICLES = 100` cap so sports doesn't crowd out hard news. Needs the re-run.

---

## Suggested execution order

**Phase 1 — Frontend-only, ship first (no re-run needed):**
1. Item 1 — profile desktop dashboard.
2. Item 2 — slim feed cards + remove inline expand.
3. Item 4a/4b — detail view restructure + standfirst (using existing fields).
4. Item 3c — thumbnail rendering + graceful text-only fallback.

→ Verify in browser, commit, PR. This alone is a big visible upgrade and is safe.

**Phase 2 — Pipeline/data (one coordinated re-run):**
5. Item 5 — sports ingestion + prompt topic.
6. Item 3a/3b — image quality-gate + extraction fallback.
7. Item 4c — richer summary prompt + tags.

→ Review pipeline diffs, confirm last-run recency, **run the pipeline once**,
spot-check output (sports present, summaries richer, images cleaner), then commit.

## Decisions (locked 2026-07-10)
- **Scope:** Phase 1 (frontend-only) now → verify + commit + PR. Phase 2 (pipeline
  + one re-run) is a separate follow-up.
- **Item 2:** thumbnail = **rounded square, ~96px**.
- **Item 3:** **skip CV super-res.** Gate + extraction (Phase 2) + small uniform
  thumbs & text-only fallback (Phase 1 rendering).
- **Item 4:** standfirst = **unlabeled italic serif dek** under the headline (no label,
  no tinted box). Reuse the existing `why_it_matters` field for now.

### Phase 1 execution checklist (this session)
1. Profile → responsive desktop dashboard.
2. Feed cards → slim horizontal rows, 96px thumbnail right, remove inline expand.
3. Detail view → standfirst (italic dek) + longer brief + promoted stat block;
   align PinCard's stat/standfirst styling for consistency.
4. Thumbnail rendering + graceful text-only fallback.
5. Verify in browser → commit → PR.
