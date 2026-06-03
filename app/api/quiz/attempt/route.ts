import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/db/supabase-server";
import { supabase } from "@/lib/db/supabase";

// POST /api/quiz/attempt
// Body: { correct: boolean }
// Records the authenticated user's quiz answer. Uses the session from cookies
// to identify the user — no userId in the body to prevent spoofing.
export async function POST(request: NextRequest) {
  let correct: boolean;
  try {
    const body = await request.json() as { correct: boolean };
    if (typeof body.correct !== "boolean") {
      return NextResponse.json({ error: "correct must be a boolean" }, { status: 400 });
    }
    correct = body.correct;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const serverSupabase = await createSupabaseServerClient();
  const { data: { user } } = await serverSupabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const today = new Date().toISOString().slice(0, 10);

  const { error } = await supabase
    .from("quiz_attempts")
    .insert({ user_id: user.id, date: today, correct });

  if (error) {
    console.error("[/api/quiz/attempt] Insert failed:", error.message);
    return NextResponse.json({ error: "Failed to save attempt" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
