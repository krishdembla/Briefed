# Briefed — Outstanding Issues

Findings from a code audit of auth, onboarding, check-in, and profile flows.
Fix in order — high priority items should be resolved before launch.

---

## High Priority

- [x] **#1 — Auth callback errors are invisible to the user**
  `app/auth/callback/route.ts` redirects to `/auth?error=recovery_failed` on failure but `app/auth/page.tsx` never reads that query param or displays it. Broken email confirmation links silently drop users on the login page with no explanation.
  **Fix:** Read `searchParams.error` in `auth/page.tsx` and render it as an error message.

- [x] **#6 — OnboardingModal silently swallows a failed preference save**
  `components/onboarding/OnboardingModal.tsx` — `handleContinue()` calls `savePreferences().catch(console.error)` then unconditionally advances to step 2 ("Your feed is ready"). If the save failed, the user has no topics set but believes they do. Their "For You" feed will be empty indefinitely.
  **Fix:** Await `savePreferences()` in a try/catch, only advance to step 2 on success, show an error and stay on step 1 on failure.

- [x] **#4 — Cookie vs localStorage mismatch for onboarding state**
  `proxy.ts` checks a cookie `briefed_onboarded` to decide whether to redirect to onboarding. `components/map/MapContainer.tsx` checks `localStorage` for `briefed-onboarded` (different store, slightly different key). Users can get stuck in redirect loops or see the onboarding modal again after completing it.
  **Fix:** Pick one source of truth (the cookie). Remove the localStorage check from `MapContainer` and rely solely on the cookie that the middleware already reads.

- [x] **#10 — Profile save shows "Saved ✓" even when it failed**
  `app/profile/page.tsx` — `handleSaveTopics` and `handleSaveFrequency` both call `.catch(console.error)` but `setTopicsSaved(true)` / `setFrequencySaved(true)` fires regardless of whether the save succeeded. User sees a success tick, refreshes, and their preferences have reverted.
  **Fix:** Move the success state setter inside `.then()` only, not unconditionally after the call.

---

## Medium Priority

- [x] **#7 — Check-in is fire-and-forget with no retry**
  `components/map/MapContainer.tsx` — `recordCheckin()` is called with `.catch(console.error)`. If it fails (network blip, Supabase timeout), the UI says "Daily check-in complete" but nothing is written to the DB. Streak does not increment. User finds out the next day when their streak resets.
  **Fix:** Await the checkin call, show an error state if it fails, and allow the user to retry rather than marking it complete prematurely.

- [x] **#20 — TODAY is calculated once at component mount**
  `components/map/MapContainer.tsx` — `TODAY` is derived at render time. If a user has the tab open past midnight and continues reading, reads logged after midnight are stored under the wrong localStorage date key and are effectively lost for streak purposes.
  **Fix:** Derive `TODAY` inside the read-recording logic at call time rather than once at mount.

- [x] **#14/#15 — Unauthenticated users can reach `/onboarding`**
  `proxy.ts` allows unauthenticated users through to `/onboarding` because `isOnboarding` exempts the path from the auth redirect. The page then calls `getUser()` which returns null, and the page renders into a broken/empty state with no error message.
  **Fix:** Remove `/onboarding` from the public path exemption in `proxy.ts`. Unauthenticated users hitting that URL should be redirected to `/auth`.

- [x] **#2 — No guidance after signup before email confirmation**
  `app/auth/page.tsx` — after signup, the UI shows a confirmation message and drops the user into sign-in mode. If they immediately try to sign in before confirming their email, Supabase rejects the login with "Invalid login credentials" — the same generic error shown for a wrong password. There is no distinction.
  **Fix:** After signup, keep the user on a "Check your email" state. If they attempt to sign in and fail while in this state, show a message specifically about email confirmation rather than the generic error.

---

## Notes

- Items #9, #19 (multi-tab localStorage sync) and #13 (cookie timing on first request) are low enough risk for a solo-dev launch — revisit if they surface in user feedback.
- Items #17 (batch pin fetch silent failure) and #18 (batch endpoint input validation) are worth a follow-up pass once the above are resolved.
