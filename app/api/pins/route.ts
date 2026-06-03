import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/db/supabase";

// Returns geo-tagged, AI-processed pins from the last 7 days.
// Uses the service role key (server-side only) — pins are public read data but
// the anon key is blocked by RLS. This route never exposes the key to the browser.
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const rawHours = parseInt(searchParams.get("hours") ?? "168", 10);
  // Guard against NaN (non-numeric input) and clamp to [1, 168]
  const hours = Math.min(Math.max(Number.isNaN(rawHours) ? 168 : rawHours, 1), 168);

  const since = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();

  const { data, error } = await supabase
    .from("pins")
    .select(
      "id, headline, summary, stat_1, stat_2, stat_3, topic, source_name, source_url, published_at, lat, lng, country_code, region_label"
    )
    .eq("ai_processed", true)
    .not("lat", "is", null)
    .not("lng", "is", null)
    .gte("published_at", since)
    .order("published_at", { ascending: false });

  if (error) {
    console.error("[/api/pins] Supabase error:", error.message);
    return NextResponse.json({ error: "Failed to fetch pins" }, { status: 500 });
  }

  return NextResponse.json(data ?? []);
}
