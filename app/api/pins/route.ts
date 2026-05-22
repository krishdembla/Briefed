import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/db/supabase";

// Returns geo-tagged, AI-processed pins from the last 7 days.
// Wide window keeps the map populated across topics with lower posting frequency (e.g. climate).
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const hours = Math.min(parseInt(searchParams.get("hours") ?? "168"), 168); // cap at 7 days

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
