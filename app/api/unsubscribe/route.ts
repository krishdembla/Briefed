import { createHmac } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/db/supabase-service";

function generateToken(userId: string): string {
  const secret = process.env.CRON_SECRET ?? "";
  return createHmac("sha256", secret).update(userId).digest("hex");
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const token = searchParams.get("token");
  const userId = searchParams.get("uid");

  if (!token || !userId) {
    return new NextResponse(unsubscribePage("Invalid link — missing parameters."), {
      status: 400,
      headers: { "Content-Type": "text/html" },
    });
  }

  const expected = generateToken(userId);
  if (token !== expected) {
    return new NextResponse(unsubscribePage("Invalid or expired unsubscribe link."), {
      status: 400,
      headers: { "Content-Type": "text/html" },
    });
  }

  // Upsert so this works whether or not the user has a preferences row yet
  const { error } = await supabase
    .from("user_preferences")
    .upsert({ user_id: userId, unsubscribed: true }, { onConflict: "user_id" });

  if (error) {
    console.error("[unsubscribe] Failed to set unsubscribed flag:", error.message);
    return new NextResponse(unsubscribePage("Something went wrong. Please try again."), {
      status: 500,
      headers: { "Content-Type": "text/html" },
    });
  }

  return new NextResponse(unsubscribePage(null), {
    status: 200,
    headers: { "Content-Type": "text/html" },
  });
}

// Returns a minimal inline HTML page so the user sees a clear confirmation,
// without needing a full Next.js page for a one-off action.
function unsubscribePage(errorMsg: string | null): string {
  const body = errorMsg
    ? `<p style="color:#f87171">${errorMsg}</p><p>If the problem persists, reply to any Briefed email and we'll remove you manually.</p>`
    : `<p>You've been unsubscribed from Briefed daily digests.</p><p style="color:#71717a;font-size:13px;margin-top:8px">You can re-enable emails at any time from your profile settings.</p><a href="/" style="display:inline-block;margin-top:20px;background:#ffffff;color:#09090b;padding:10px 20px;border-radius:10px;font-weight:600;font-size:13px;text-decoration:none">Back to Briefed</a>`;

  return `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Unsubscribed — Briefed</title><style>*{box-sizing:border-box;margin:0;padding:0}body{background:#09090b;color:#d4d4d8;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;min-height:100vh;display:flex;align-items:center;justify-content:center;padding:24px}.card{background:#18181b;border:1px solid #27272a;border-radius:16px;padding:32px;max-width:400px;width:100%;text-align:center}h1{font-size:20px;font-weight:700;color:#fff;margin-bottom:16px}p{font-size:14px;line-height:1.6;color:#a1a1aa}</style></head><body><div class="card"><h1>Briefed</h1>${body}</div></body></html>`;
}

// Export a helper so send-digest can generate matching tokens without importing crypto directly
export { generateToken as generateUnsubscribeToken };
