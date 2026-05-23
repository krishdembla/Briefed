# Project: Briefed (working title)
## An AI-powered interactive news map with daily digest emails and habit-building mechanics

---

## Project Vision
A web app that plots live global news events as interactive pins on a world map, paired with a personalized morning email digest that drives users back to the map. The goal is to make staying informed feel engaging and habit-forming rather than a chore.

## Core Features (MVP)
1. News ingestion pipeline — pulls from APIs every morning, deduplicates, geo-tags
2. AI summarization — turns raw articles into skimmable 3-stat cards
3. Interactive 2D map (Mapbox) — pins clustered by region, filterable by topic
4. Morning email digest — AI-generated, personalized teaser that links back to the map
5. Check-in + streak mechanic — read 3 pins to complete your daily check-in

---

## Coding Style & Principles

### General
- Always plan before writing code. For any non-trivial task, outline the approach first and wait for confirmation before implementing.
- Write clean, readable code over clever code. Optimize for maintainability.
- Use TypeScript strictly. No `any` types unless absolutely unavoidable and commented why.
- Keep files small and focused. One responsibility per file.
- Always add comments for non-obvious logic, especially in the pipeline and AI layers.

### Debugging & Problem Solving
- Fix root causes, never symptoms. If something feels like a workaround, stop and flag it.
- When a bug appears, take a step back — explain what you think is happening before touching code.
- If something is broken and a quick fix isn't obvious, outline 2-3 possible root causes and we will decide together which to investigate first.
- Never silently swallow errors. Always log with context: what failed, where, and what the input was.
- If you are about to do something that could cause data loss or break a working feature, stop and ask first.

### Architecture
- Think in layers: ingestion → processing → storage → serving → presentation. Keep these concerns separated.
- Prefer simple and boring infrastructure over clever and fragile. A working cron job beats a fancy queue system.
- Build the unhappy path first. Assume APIs will fail. Assume emails will bounce. Handle it gracefully.
- Every external API call should have a timeout, retry logic, and a fallback.

### AI / LLM Calls
- All prompts live in a dedicated `/prompts` folder as separate files. Never hardcode prompts inline.
- Every LLM call should be wrapped in a utility function — never call the API directly from business logic.
- Log all LLM inputs and outputs during development so we can debug and improve prompts easily.
- If an LLM call fails, fail gracefully — return a fallback summary rather than crashing the pipeline.

### Git Discipline
- Commit after every meaningful milestone. Small, descriptive commits.
- Never commit broken code to main. Use feature branches for anything non-trivial.
- Commit message format: `feat:`, `fix:`, `refactor:`, `chore:` prefixes always.

---

## Tech Stack (decided)
- **Frontend:** Next.js (App Router) + TypeScript + Tailwind
- **Map:** Mapbox GL JS
- **Backend:** Next.js API routes + cron jobs (Vercel Cron or similar)
- **Database:** Supabase (Postgres + Auth)
- **Email:** Resend
- **AI:** Claude API (summarization, connect-the-dots, email generation, quiz questions)
- **News APIs:** NewsAPI, Finnhub (markets), RSS feeds as fallback
- **Deployment:** Vercel

---

## Folder Structure (target)
/app              → Next.js app router pages
/components       → UI components
/lib              → Shared utilities, API clients, DB helpers
/pipeline         → News ingestion, processing, geo-tagging logic
/prompts          → All LLM prompt templates
/emails           → Email templates (React Email)
/types            → Shared TypeScript types

## Current Phase
**Week 3 — Auth + Email Digest (complete)**
Next: Week 4 TBD.

## What's Built
- **Pipeline** — fetch → dedup → cluster → geo-tag → summarize → Supabase (`pipeline/run.ts`)
- **Map UI** — Mapbox pins, topic filters, 7-day window, read pin demoting, centered pin card modal with source link
- **Auth** — Supabase email/password auth, middleware-protected routes (`app/auth/page.tsx`, `middleware.ts`)
- **Streak tracking** — `checkins` table, daily check-in recorded at 3 reads, streak shown in UI
- **Email digest** — React Email template, Claude-generated intro, Resend send route, Vercel cron at 7am UTC
- `.env.example` — all required keys documented

---

## Things To Never Do
- Do not install a new library without flagging it and explaining why
- Do not refactor working code unless it is blocking the current task
- Do not make the pipeline dependent on a single news source
- Do not skip error handling to move faster
- Do not generate placeholder/mock data and forget to replace it