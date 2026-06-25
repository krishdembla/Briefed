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
  }

  return NextResponse.redirect(`${origin}${next}`);
}
