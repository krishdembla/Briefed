import "@/lib/env"; // validates required env vars at module load
import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";
import { render } from "@react-email/components";
import { supabase } from "@/lib/db/supabase-service";
import { generateDigestIntro } from "@/lib/ai/generateDigest";
import { generateUnsubscribeToken } from "@/app/api/unsubscribe/route";
import BriefedDigest from "@/emails/BriefedDigest";
import { sendAlertEmail } from "@/lib/email/alerts";
import { selectDigestPins, buildSubject, type DigestPin } from "@/lib/digestUtils";

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

  // ── Fetch today's pins (last 24h) ─────────────────────────────────────────
  const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString();

  const { data: allPins, error: pinsError } = await supabase
    .from("pins")
    .select("headline, topic, region_label")
    .eq("ai_processed", true)
    .not("lat", "is", null)
    .gte("published_at", since)
    .order("published_at", { ascending: false })
    .limit(50); // fetch enough to cover all topic combinations

  if (pinsError || !allPins || allPins.length === 0) {
    console.error("[send-digest] No pins found:", pinsError?.message);
    return NextResponse.json({ error: "No pins available" }, { status: 422 });
  }

  // ── Fetch all users and their preferences ────────────────────────────────
  const { data: usersData, error: usersError } = await supabase.auth.admin.listUsers();

  if (usersError || !usersData?.users?.length) {
    console.error("[send-digest] No users found:", usersError?.message);
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
      // Skip users who have unsubscribed or whose frequency doesn't match today
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

  console.log(`[send-digest] Sent: ${sent}, Failed: ${failures.length}`);

  if (failures.length > 0) {
    await sendAlertEmail(
      `Digest send failures (${failures.length})`,
      `${failures.length} of ${sent + failures.length} digest emails failed to send.\n\nFailed addresses:\n${failures.join("\n")}`
    );
  }

  return NextResponse.json({ sent, failures });
}

export const GET = handle;
export const POST = handle;
