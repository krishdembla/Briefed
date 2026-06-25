import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/db/supabase-server";
import { supabase as adminSupabase } from "@/lib/db/supabase-service";

// GET /api/me/read-topics
// Returns topic read counts for the current user (last 30 reads).
// Used to blend explicit preferences with actual reading behaviour in For You.
export async function GET() {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({}, { status: 401 });

  // Fetch the last 30 pin_ids the user has read
  const { data: reads, error: readsError } = await adminSupabase
    .from("pin_reads")
    .select("pin_id")
    .eq("user_id", user.id)
    .order("read_at", { ascending: false })
    .limit(30);

  if (readsError || !reads?.length) return NextResponse.json({});

  const pinIds = reads.map((r) => r.pin_id as string);

  // Fetch topics for those pins using the service role (bypasses RLS)
  const { data: pins, error: pinsError } = await adminSupabase
    .from("pins")
    .select("id, topic")
    .in("id", pinIds);

  if (pinsError || !pins?.length) return NextResponse.json({});

  // Count reads per topic
  const counts: Record<string, number> = {};
  for (const pin of pins) {
    const t = (pin.topic as string) ?? "other";
    counts[t] = (counts[t] ?? 0) + 1;
  }

  return NextResponse.json(counts);
}
