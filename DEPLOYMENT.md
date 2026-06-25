# Briefed — Deployment Guide

Complete reference for deploying Briefed to production. Follow steps in order.

---

## Cost Summary

| Service | Plan | Cost |
|---------|------|------|
| Vercel | Pro (required — 5 cron jobs; Hobby only allows 2) | $20/month |
| Groq | Paid (spend limit set to $15) | up to $15/month |
| Supabase | Free tier (500MB, won't auto-pause — pipeline writes 3×/day) | Free |
| Resend | Free tier (3,000 emails/month — sufficient at launch) | Free |
| NewsAPI | Free Developer tier (100 req/day — covers 3 pipeline runs/day) | Free |
| Finnhub | Free tier | Free |
| Mapbox | Free tier (50,000 map loads/month) | Free |
| Sentry | Free tier (5,000 errors/month) | Free |

**Total: ~$35/month**

---

## Step 1 — Fix the Resend sender domain (do this first)

The app currently sends from `onboarding@resend.dev`, which only delivers to the Resend account owner's email. Every other user's digest will silently fail.

**You need a domain you own.** If you already own one, a subdomain (e.g. `mail.yourdomain.com`) works fine at no extra cost. If you don't own one, buy a `.com` from Cloudflare Registrar or Namecheap (~$10–15/year).

**Resend domain verification is free** — you're just proving ownership via DNS records.

### Steps
1. Go to **Resend dashboard → Domains → Add Domain**
2. Enter your domain (or subdomain)
3. Add the DNS records Resend gives you (TXT + MX + DKIM) at your domain registrar
4. Wait for verification (usually under 10 minutes)
5. Update the `from` address in two files:
   - `app/api/email/send-digest/route.ts` line ~167
   - `app/api/email/send-reminder/route.ts` line ~105
   - Change `"Briefed <onboarding@resend.dev>"` → `"Briefed <digest@yourdomain.com>"`

---

## Step 2 — Environment variables in Vercel

After connecting the repo (Step 3), add all of these in **Vercel → Project → Settings → Environment Variables**.

| Variable | Value | Notes |
|----------|-------|-------|
| `NEXT_PUBLIC_SUPABASE_URL` | From Supabase dashboard | |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | From Supabase dashboard | |
| `SUPABASE_SERVICE_ROLE_KEY` | From Supabase dashboard | Server-only — never expose to client |
| `GROQ_API_KEY` | Your Groq key | |
| `GROQ_MODEL` | `llama-3.3-70b-versatile` | |
| `NEWSAPI_KEY` | Your NewsAPI key | |
| `FINNHUB_API_KEY` | Your Finnhub key | |
| `NEXT_PUBLIC_MAPBOX_TOKEN` | Your Mapbox token | |
| `RESEND_API_KEY` | Your Resend key | |
| `NEXT_PUBLIC_APP_URL` | `https://your-app.vercel.app` | **Must be your real production URL** — used in all email links |
| `PIPELINE_SECRET` | Any strong random string | Guards manual pipeline triggers |
| `CRON_SECRET` | Any strong random string | Vercel Cron sends this; also signs unsubscribe tokens |
| `ADMIN_EMAIL` | Your email address | Gates `/admin` and receives pipeline failure alerts |
| `SENTRY_DSN` | From Sentry dashboard | Server-side error capture |
| `NEXT_PUBLIC_SENTRY_DSN` | Same value as `SENTRY_DSN` | Client-side (needs NEXT_PUBLIC_ prefix) |
| `SENTRY_ORG` | Your Sentry org slug | Found in Sentry → Settings → General |
| `SENTRY_PROJECT` | Your Sentry project slug | Found in Sentry → Projects |

**Do NOT add `TEST_EMAIL_OVERRIDE`** — if present in Vercel, all digest and reminder emails go to one address only.

Generate random secrets at: https://randomkeygen.com (use the "Strong Passwords" section)

---

## Step 3 — Deploy to Vercel

1. Merge the current branch to `main` and push to GitHub
2. Go to **vercel.com → New Project → Import Git Repository**
3. Select the Briefed repo
4. Framework will be detected as Next.js automatically — leave it
5. Add all environment variables from Step 2 before clicking Deploy
6. Click **Deploy**

If the first deploy fails, check the build logs. The most common cause is a missing `NEXT_PUBLIC_*` variable (they're inlined at build time).

---

## Step 4 — Configure Supabase auth URLs

Go to **Supabase dashboard → Authentication → URL Configuration** and set:

**Site URL:**
```
https://your-app.vercel.app
```

**Redirect URLs (add all four):**
```
http://localhost:3001/auth/callback
http://localhost:3001/auth/reset-password
https://your-app.vercel.app/auth/callback
https://your-app.vercel.app/auth/reset-password
```

Without this, password reset emails and email confirmation links will silently fail — Supabase blocks any redirect not on this allowlist.

---

## Step 5 — Confirm cron jobs are active

Go to **Vercel dashboard → your project → Cron Jobs**. You should see 5 jobs matching `vercel.json`:

| Schedule | Route | Purpose |
|----------|-------|---------|
| `0 6 * * *` | `/api/pipeline` | Morning pipeline run |
| `0 13 * * *` | `/api/pipeline` | Afternoon pipeline run |
| `0 20 * * *` | `/api/pipeline` | Evening pipeline run |
| `0 7 * * *` | `/api/email/send-digest` | Morning digest email |
| `0 18 * * *` | `/api/email/send-reminder` | Evening habit nudge |

If cron jobs are not listed, you're likely on the Hobby plan — upgrade to Pro.

---

## Step 6 — Restrict the Mapbox token (recommended)

Go to **mapbox.com → Account → Tokens**, edit your token, and add your production URL to the allowed URLs list. Prevents your token from being used on third-party sites if someone reads the source.

---

## Step 7 — Smoke test

Run these checks after deploy to confirm everything is wired up end-to-end:

1. **Landing page** — visit `https://your-app.vercel.app` without being logged in. Should see the marketing page, not a redirect to `/auth`.
2. **Sign up** — create a new account. Should hit `/onboarding`, then `/map` after saving topics.
3. **Map loads** — pins should appear within a few seconds. If the map is blank, check `NEXT_PUBLIC_MAPBOX_TOKEN`.
4. **Admin dashboard** — visit `/admin` while logged in as `ADMIN_EMAIL`. Should show pipeline history and stats.
5. **Manual pipeline trigger** — run this from your terminal to confirm the pipeline works end-to-end:
   ```bash
   curl -X POST https://your-app.vercel.app/api/pipeline/run \
     -H "Authorization: Bearer YOUR_PIPELINE_SECRET"
   ```
   Check the admin dashboard after ~2 minutes for new pins.
6. **Test email** — temporarily set `TEST_EMAIL_OVERRIDE` in Vercel env vars to your own email, trigger `/api/email/send-digest` manually, confirm you receive the digest, then remove `TEST_EMAIL_OVERRIDE`.
7. **Sentry** — after the above, check your Sentry project dashboard for any captured errors.

---

## Scaling limits (when you'll need to upgrade)

| Service | Free limit | Upgrade cost |
|---------|-----------|-------------|
| Supabase | 500MB storage, ~50k MAU | $25/month (Pro) |
| Resend | 3,000 emails/month | $20/month (Pro, 50k emails) |
| NewsAPI | 100 req/day | $449/month — consider replacing with more RSS feeds instead |
| Mapbox | 50,000 map loads/month | Pay-as-you-go after ($0.50/1k loads) |
