import "@/lib/env"; // validates required env at module load
import { NextResponse } from "next/server";
import { Resend } from "resend";
import { render } from "@react-email/components";
import { createSupabaseServerClient } from "@/lib/db/supabase-server";
import BriefedWelcome from "@/emails/BriefedWelcome";

// Sends a branded welcome email via Resend after signup. Non-fatal: we always
// return 200 (with `sent: boolean`) so a bad email infra call never blocks the
// signup flow. Email address is read from the caller's authenticated session,
// not the request body, so this route can't be abused to spam arbitrary inboxes.
export const runtime = "nodejs";
export const maxDuration = 15;

const resend = new Resend(process.env.RESEND_API_KEY);
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
const FROM = process.env.RESEND_FROM ?? "Briefed <onboarding@resend.dev>";

export async function POST() {
  const supabase = await createSupabaseServerClient();
  const { data: userData } = await supabase.auth.getUser();
  const email = userData.user?.email;

  if (!email) {
    // Not signed in yet — likely email-confirmation flow. Caller will retry
    // after the confirmation link exchange, or Supabase's own confirmation
    // email covers this path.
    return NextResponse.json({ sent: false, reason: "no-session" });
  }

  try {
    const html = await render(BriefedWelcome({ appUrl: APP_URL }));
    const { error } = await resend.emails.send({
      from: FROM,
      to: email,
      subject: "Welcome to Briefed",
      html,
    });
    if (error) {
      console.error("[/api/auth/welcome] Resend error:", error);
      return NextResponse.json({ sent: false, reason: "resend-error" });
    }
    return NextResponse.json({ sent: true });
  } catch (err) {
    console.error("[/api/auth/welcome] Failed to send welcome email:", err);
    return NextResponse.json({ sent: false, reason: "exception" });
  }
}
