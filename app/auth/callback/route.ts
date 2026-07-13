import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/db/supabase-server";

// Handles Supabase auth redirects (email confirmation, password recovery, magic links).
// Supabase sends the user here with a `code` param; we exchange it for a session
// and forward to `next` (defaults to home).
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/";

  if (code) {
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) {
      console.error("[/auth/callback] Code exchange failed:", error.message);
      return NextResponse.redirect(`${origin}/auth?error=recovery_failed`);
    }

    // If this callback is landing a first-time signup (next=/onboarding and no
    // preferences row yet), send our branded welcome email. Non-blocking on
    // any error path so we never delay the redirect meaningfully.
    if (next.startsWith("/onboarding")) {
      try {
        const { data: userData } = await supabase.auth.getUser();
        if (userData.user) {
          const { data: prefs } = await supabase
            .from("user_preferences")
            .select("user_id")
            .eq("user_id", userData.user.id)
            .maybeSingle();
          if (!prefs) {
            await fetch(`${origin}/api/auth/welcome`, {
              method: "POST",
              headers: { cookie: request.headers.get("cookie") ?? "" },
            }).catch(() => {});
          }
        }
      } catch (err) {
        console.error("[/auth/callback] Welcome-email hook failed:", err);
      }
    }
  }

  return NextResponse.redirect(`${origin}${next}`);
}
