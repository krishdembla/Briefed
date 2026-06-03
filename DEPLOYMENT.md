# Deployment Checklist

Things that must be configured before going live. Each item here represents a known gap between local dev and production.

---

## Supabase — Authentication URL Configuration

**Location:** Supabase Dashboard → Authentication → URL Configuration

### Site URL
Set to your production domain, e.g.:
```
https://your-app.vercel.app
```

### Redirect URLs (allowlist)
Add both local and production callback URLs:
```
http://localhost:3000/auth/callback
http://localhost:3000/auth/reset-password
https://your-app.vercel.app/auth/callback
https://your-app.vercel.app/auth/reset-password
```

**Why this matters:** Supabase blocks redirects to any URL not in this list. The password recovery and email confirmation flows both rely on these routes. Without them, recovery emails silently redirect to the site root and users can never reset their password.

---

## Environment Variables (Vercel)

Copy every key from `.env.local` into Vercel → Settings → Environment Variables. The critical ones:

| Key | Notes |
|-----|-------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Public anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role — keep secret, server-only |
| `ANTHROPIC_API_KEY` | Claude API key |
| `PIPELINE_SECRET` | Guards `/api/pipeline/run` — pick a strong value in prod |
| `ADMIN_EMAIL` | Email address that can access `/admin` |
| `RESEND_API_KEY` | For email digest sends |
| `NEXT_PUBLIC_MAPBOX_TOKEN` | Mapbox GL JS |

---

## Vercel Cron Jobs

The morning digest cron (`/api/email/send-digest`) is configured in `vercel.json`. Verify it is enabled in Vercel → Settings → Cron Jobs after first deploy.

---

## Mapbox

Ensure the Mapbox token has the correct allowed URLs set in your Mapbox account (restrict to your production domain to prevent token abuse).
