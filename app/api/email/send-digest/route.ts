import "@/lib/env"; // validates required env vars at module load
import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";
import { render } from "@react-email/components";
import { supabase } from "@/lib/db/supabase-service";
import { generateDigestIntro } from "@/lib/ai/generateDigest";
import { generateUnsubscribeToken } from "@/app/api/unsubscribe/route";
import BriefedDigest from "@/emails/BriefedDigest";
import { sendAlertEmail } from "@/lib/email/alerts";
import { selectDigestPins, buildSubject } from "@/lib/digestUtils";

// One LLM call per user + Resend sends — 60s is ample, but set explicitly to
// avoid being caught by Vercel's default 10s limit on non-cron invocations.
export const maxDuration = 60;

const resend = new Resend(process.env.RESEND_API_KEY);
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

function isAuthorized(request: NextRequest): boolean {
  const auth = request.headers.get("authorization");
  return (
    auth === `Bearer ${process.env.CRON_SECRET}` ||
    auth === `Bearer ${process.env.PIPELINE_SECRET}`
  );
}

async function handle(request: NextRequest): Promise<NextResponse> {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // ── Create audit record ───────────────────────────────────────────────────
  let runId: string | null = null;
  try {
    const { data: run } = await supabase
      .from("digest_runs")
      .insert({ status: "running" })
      .select("id")
      .single();
    runId = run?.id ?? null;
  } catch {
    // Non-fatal — tracking must never block the actual send.
  }

  async function finishDigestRun(
    status: "success" | "error" | "skipped",
    counts: {
      emailsSent?: number;
      emailsFailed?: number;
      pinsFound?: number;
      usersFound?: number;
      errorMsg?: string;
    }
  ): Promise<void> {
    if (!runId) return;
    try {
      await supabase
        .from("digest_runs")
        .update({
          status,
          finished_at: new Date().toISOString(),
          emails_sent:   counts.emailsSent   ?? 0,
          emails_failed: counts.emailsFailed ?? 0,
          pins_found:    counts.pinsFound    ?? 0,
          users_found:   counts.usersFound   ?? 0,
          error_msg:     counts.errorMsg     ?? null,
        })
        .eq("id", runId);
    } catch {
      // Non-fatal.
    }
  }

  // ── Fetch today's pins (last 36h) ─────────────────────────────────────────
  // Use created_at (DB insertion time) rather than published_at (news source's
  // article date) — the latter can be 30-48h old from NewsAPI "everything"
  // queries, which would cause the digest to find 0 pins and silently skip.
  // 36h window (not 24h) because the pipeline runs at 5am UTC and the digest
  // runs at 7am UTC — yesterday's pins are already 26h old by send time.
  const since = new Date(Date.now() - 36 * 3600 * 1000).toISOString();

  const { data: allPins, error: pinsError } = await supabase
    .from("pins")
    .select("headline, topic, region_label")
    .eq("ai_processed", true)
    .not("lat", "is", null)
    .gte("created_at", since)
    .order("created_at", { ascending: false })
    .limit(50);

  if (pinsError || !allPins || allPins.length === 0) {
    const msg = pinsError?.message ?? "0 pins with created_at in last 36h";
    console.error("[send-digest] No pins found:", msg);
    await Promise.all([
      finishDigestRun("error", { errorMsg: `No pins: ${msg}` }),
      sendAlertEmail("Digest skipped — no pins", `No AI-processed, geo-tagged pins were found in the last 36 hours.\n\nDB error: ${msg}`),
    ]);
    return NextResponse.json({ error: "No pins available" }, { status: 422 });
  }

  // ── Fetch all users and their preferences ────────────────────────────────
  const { data: usersData, error: usersError } = await supabase.auth.admin.listUsers();

  if (usersError || !usersData?.users?.length) {
    const msg = usersError?.message ?? "listUsers returned empty";
    console.error("[send-digest] No users found:", msg);
    await Promise.all([
      finishDigestRun("error", { pinsFound: allPins.length, errorMsg: `No users: ${msg}` }),
      sendAlertEmail("Digest skipped — no users", `Could not load user list from Supabase Auth.\n\nError: ${msg}`),
    ]);
    return NextResponse.json({ error: "No users to send to" }, { status: 422 });
  }

  const { data: prefsData } = await supabase
    .from("user_preferences")
    .select("user_id, topics, unsubscribed, digest_frequency");

  // Determine which frequency values should receive a digest today
  const todayUTC = new Date().getUTCDay(); // 0=Sun … 6=Sat
  function shouldSendToday(frequency: string | null): boolean {
    switch (frequency ?? "daily") {
      case "off":      return false;
      case "weekly":   return todayUTC === 1; // Monday only
      case "weekdays": return todayUTC >= 1 && todayUTC <= 5;
      default:         return true; // "daily"
    }
  }

  const prefsByUserId = new Map<string, string[]>(
    (prefsData ?? [])
      .filter((p: { unsubscribed: boolean | null; digest_frequency: string | null }) =>
        !p.unsubscribed && shouldSendToday(p.digest_frequency)
      )
      .map((p: { user_id: string; topics: string[] }) => [p.user_id, p.topics])
  );
  const skipIds = new Set(
    (prefsData ?? [])
      .filter((p: { unsubscribed: boolean | null; digest_frequency: string | null }) =>
        !!p.unsubscribed || !shouldSendToday(p.digest_frequency)
      )
      .map((p: { user_id: string }) => p.user_id)
  );

  // ── In dev mode, send only to the test override address ──────────────────
  const testOverride = process.env.TEST_EMAIL_OVERRIDE;

  const recipients = testOverride
    ? [{ email: testOverride, userId: usersData.users[0]?.id ?? "" }]
    : usersData.users
        .filter((u) => !!u.email)
        .map((u) => ({ email: u.email as string, userId: u.id }));

  // ── Send one personalised email per recipient ────────────────────────────
  let sent = 0;
  const failures: string[] = [];

  for (const { email, userId } of recipients) {
    try {
      if (skipIds.has(userId)) continue;

      const userTopics = prefsByUserId.get(userId) ?? [];
      const digestPins = selectDigestPins(allPins, userTopics);

      if (digestPins.length === 0) {
        console.warn(`[send-digest] No pins for user ${userId} — skipping`);
        continue;
      }

      const intro = await generateDigestIntro(
        digestPins.map((p) => p.headline),
        { topTopics: userTopics }
      );

      const unsubscribeUrl = `${APP_URL}/api/unsubscribe?uid=${userId}&token=${generateUnsubscribeToken(userId)}`;

      const html = await render(
        BriefedDigest({
          intro,
          pins: digestPins.map((p) => ({
            headline: p.headline,
            topic: p.topic ?? "other",
            regionLabel: p.region_label,
          })),
          appUrl: APP_URL,
          unsubscribeUrl,
        })
      );

      const subject = buildSubject(digestPins, userTopics);

      const { error: sendError } = await resend.emails.send({
        from: "Briefed <digest@stay-briefed.com>",
        to: email,
        subject,
        html,
      });

      if (sendError) {
        console.error(`[send-digest] Resend error for ${email}:`, sendError);
        failures.push(email);
      } else {
        sent++;
      }
    } catch (err) {
      console.error(`[send-digest] Unexpected error for ${email}:`, err);
      failures.push(email);
    }
  }

  const testOverrideActive = !!process.env.TEST_EMAIL_OVERRIDE;
  console.log(`[send-digest] Sent: ${sent}, Failed: ${failures.length}, TEST_OVERRIDE: ${testOverrideActive}`);

  // ── Determine final status ────────────────────────────────────────────────
  const finalStatus =
    sent > 0 ? "success" :
    failures.length > 0 ? "error" :
    "skipped";

  const errorMsg = failures.length > 0
    ? `Failed addresses: ${failures.join(", ")}`
    : sent === 0
    ? `All recipients skipped (frequency/unsubscribe). TEST_OVERRIDE: ${testOverrideActive}`
    : undefined;

  await finishDigestRun(finalStatus, {
    emailsSent:   sent,
    emailsFailed: failures.length,
    pinsFound:    allPins.length,
    usersFound:   usersData.users.length,
    errorMsg,
  });

  if (finalStatus === "skipped") {
    await sendAlertEmail(
      "Digest sent 0 emails",
      `The digest cron ran but sent nothing and had no failures.\n\nPossible causes:\n- All users were skipped (unsubscribed or frequency mismatch)\n- digest_pins was empty for every user\n- TEST_EMAIL_OVERRIDE active: ${testOverrideActive}\n\nUsers found: ${usersData.users.length}, Pins found: ${allPins.length}`
    );
  }

  if (failures.length > 0) {
    await sendAlertEmail(
      `Digest send failures (${failures.length})`,
      `${failures.length} of ${sent + failures.length} digest emails failed to send.\n\nFailed addresses:\n${failures.join("\n")}`
    );
  }

  return NextResponse.json({ sent, failures, pinsFound: allPins.length, usersFound: usersData.users.length });
}

export const GET = handle;
export const POST = handle;
