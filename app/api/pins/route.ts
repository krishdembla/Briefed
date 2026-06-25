import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/db/supabase-service";

// Returns geo-tagged pins from the last 7 days.
// Requires lat/lng (placeable on map) and a headline — summary/stats are optional
// and the card degrades gracefully when absent.
// Uses the service role key (server-side only) — never exposed to the browser.
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
    .not("lat", "is", null)
    .not("lng", "is", null)
    .not("headline", "is", null)
    .gte("published_at", since)
    .order("published_at", { ascending: false });

  if (error) {
    console.error("[/api/pins] Supabase error:", error.message);
    return NextResponse.json({ error: "Failed to fetch pins" }, { status: 500 });
  }

  return NextResponse.json(data ?? []);
}
