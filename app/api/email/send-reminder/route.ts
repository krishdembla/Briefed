import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";
import { render } from "@react-email/components";
import { supabase } from "@/lib/db/supabase-service";
import BriefedReminder from "@/emails/BriefedReminder";

const resend = new Resend(process.env.RESEND_API_KEY);
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

function isAuthorized(request: NextRequest): boolean {
  const auth = request.headers.get("authorization");
  return (
    auth === `Bearer ${process.env.CRON_SECRET}` ||
    auth === `Bearer ${process.env.PIPELINE_SECRET}`
  );
}

// Computes the current consecutive-day streak from an array of completed dates.
function computeStreak(completedDates: string[]): number {
  if (completedDates.length === 0) return 0;
  const dateSet = new Set(completedDates);
  const today = new Date().toISOString().slice(0, 10);
  const yesterday = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10);
  const anchor = dateSet.has(yesterday) ? yesterday : null;
  if (!anchor) return 0;

  let streak = 0;
  let cursor = new Date(anchor);
  while (true) {
    const d = cursor.toISOString().slice(0, 10);
    if (!dateSet.has(d)) break;
    streak++;
    cursor = new Date(cursor.getTime() - 86_400_000);
  }
  // Don't count today (they haven't checked in yet — that's why we're nudging)
  void today;
  return streak;
}

async function handle(request: NextRequest): Promise<NextResponse> {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const today = new Date().toISOString().slice(0, 10);

  // Users who have already checked in today — exclude them
  const { data: checkedInToday } = await supabase
    .from("checkins")
    .select("user_id")
    .eq("date", today)
    .gte("pins_read", 3);

  const checkedInIds = new Set((checkedInToday ?? []).map((r: { user_id: string }) => r.user_id));

  // All users
  const { data: usersData, error: usersError } = await supabase.auth.admin.listUsers();
  if (usersError || !usersData?.users?.length) {
    return NextResponse.json({ error: "No users found" }, { status: 422 });
  }

  // Only send to users who haven't checked in today
  const targets = usersData.users.filter(
    (u) => !!u.email && !checkedInIds.has(u.id)
  );

  if (targets.length === 0) {
    return NextResponse.json({ sent: 0, message: "All users already checked in today" });
  }

  // Fetch streak data for each target (last 60 days of checkins)
  const targetIds = targets.map((u) => u.id);
  const { data: checkinRows } = await supabase
    .from("checkins")
    .select("user_id, date")
    .in("user_id", targetIds)
    .gte("pins_read", 3)
    .order("date", { ascending: false });

  const checkinsByUser = new Map<string, string[]>();
  for (const row of checkinRows ?? []) {
    const existing = checkinsByUser.get(row.user_id) ?? [];
    existing.push(row.date);
    checkinsByUser.set(row.user_id, existing);
  }

  const testOverride = process.env.TEST_EMAIL_OVERRIDE;
  const recipients = testOverride
    ? [{ email: testOverride, userId: targets[0]?.id ?? "" }]
    : targets.map((u) => ({ email: u.email as string, userId: u.id }));

  let sent = 0;
  const failures: string[] = [];

  for (const { email, userId } of recipients) {
    try {
      const streak = computeStreak(checkinsByUser.get(userId) ?? []);
      const html = await render(BriefedReminder({ streak, appUrl: APP_URL }));

      const subject = streak > 0
        ? `Don't lose your ${streak}-day streak 🔥`
        : "Your daily briefing is waiting";

      const { error: sendError } = await resend.emails.send({
        from: "Briefed <onboarding@resend.dev>",
        to: email,
        subject,
        html,
      });

      if (sendError) {
        console.error(`[send-reminder] Resend error for ${email}:`, sendError);
        failures.push(email);
      } else {
        sent++;
      }
    } catch (err) {
      console.error(`[send-reminder] Unexpected error for ${email}:`, err);
      failures.push(email);
    }
  }

  console.log(`[send-reminder] Sent: ${sent}, Failed: ${failures.length}`);
  return NextResponse.json({ sent, failures });
}

export const GET = handle;
export const POST = handle;
