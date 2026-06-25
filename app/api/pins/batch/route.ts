import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/db/supabase-service";

// GET /api/pins/batch?ids=id1,id2,id3
// Returns full pin data for the given IDs using the service role key,
// bypassing RLS so the browser client can read pins it doesn't have a
// direct SELECT policy for.
export async function GET(request: NextRequest) {
  const raw = new URL(request.url).searchParams.get("ids") ?? "";
  const ids = raw.split(",").map((s) => s.trim()).filter(Boolean);

  if (ids.length === 0) {
    return NextResponse.json([]);
  }

  const { data, error } = await supabase
    .from("pins")
    .select("id, headline, topic, region_label, source_name, source_url, published_at")
    .in("id", ids);

  if (error) {
    console.error("[/api/pins/batch] Supabase error:", error.message);
    return NextResponse.json({ error: "Failed to fetch pins" }, { status: 500 });
  }

  return NextResponse.json(data ?? []);
}
