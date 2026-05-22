import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";
import { render } from "@react-email/components";
import { supabase } from "@/lib/db/supabase";
import { generateDigestIntro } from "@/lib/ai/generateDigest";
import BriefedDigest from "@/emails/BriefedDigest";

const resend = new Resend(process.env.RESEND_API_KEY);
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

export async function POST(request: NextRequest) {
  // Verify the request comes from our cron job or an authorized caller
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.PIPELINE_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // ── Fetch today's top 2 pins ──────────────────────────────────────────────
  const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString();

  const { data: pins, error: pinsError } = await supabase
    .from("pins")
    .select("headline, topic, region_label")
    .eq("ai_processed", true)
    .not("lat", "is", null)
    .gte("published_at", since)
    .order("published_at", { ascending: false })
    .limit(2);

  if (pinsError || !pins || pins.length === 0) {
    console.error("[send-digest] No pins found:", pinsError?.message);
    return NextResponse.json({ error: "No pins available" }, { status: 422 });
  }

  // ── Generate Claude intro ─────────────────────────────────────────────────
  const intro = await generateDigestIntro(pins.map((p) => p.headline));

  // ── Fetch all subscribed user emails ─────────────────────────────────────
  // auth.users is only accessible via the service role — we query it directly
  const { data: users, error: usersError } = await supabase
    .from("auth.users")
    .select("email")
    .not("email", "is", null);

  if (usersError || !users || users.length === 0) {
    console.error("[send-digest] No users found:", usersError?.message);
    return NextResponse.json({ error: "No users to send to" }, { status: 422 });
  }

  // ── Render and send ───────────────────────────────────────────────────────
  const html = await render(
    BriefedDigest({
      intro,
      pins: pins.map((p) => ({
        headline: p.headline,
        topic: p.topic ?? "other",
        regionLabel: p.region_label,
      })),
      appUrl: APP_URL,
    })
  );

  const emails = users.map((u: { email: string }) => u.email).filter(Boolean);

  const { data: sendData, error: sendError } = await resend.emails.send({
    from: "Briefed <digest@briefed.app>",
    to: emails,
    subject: "Your world this morning",
    html,
  });

  if (sendError) {
    console.error("[send-digest] Resend error:", sendError);
    return NextResponse.json({ error: sendError.message }, { status: 500 });
  }

  console.log(`[send-digest] Sent to ${emails.length} users. Resend ID: ${sendData?.id}`);
  return NextResponse.json({ sent: emails.length, resendId: sendData?.id });
}
