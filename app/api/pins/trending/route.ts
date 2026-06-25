import { NextResponse } from "next/server";
import { supabase } from "@/lib/db/supabase-service";

// GET /api/pins/trending
// Returns up to 15 pins with the most reads in the last 48 hours.
export async function GET() {
  const since48h = new Date(Date.now() - 48 * 3600 * 1000).toISOString();

  // Count reads per pin in the last 48h
  const { data: readCounts, error: countError } = await supabase
    .from("pin_reads")
    .select("pin_id")
    .gte("read_at", since48h);

  if (countError) {
    console.error("[/api/pins/trending] read count query failed:", countError.message);
    return NextResponse.json({ error: "Failed to fetch trending" }, { status: 500 });
  }

  if (!readCounts?.length) {
    // No read data yet — fall back to most recent pins
    const { data: recent } = await supabase
      .from("pins")
      .select("id, headline, summary, stat_1, stat_2, stat_3, topic, source_name, source_url, published_at, lat, lng, country_code, region_label")
      .not("lat", "is", null)
      .not("headline", "is", null)
      .order("published_at", { ascending: false })
      .limit(15);
    return NextResponse.json(recent ?? []);
  }

  // Tally reads per pin_id
  const tally: Record<string, number> = {};
  for (const row of readCounts) {
    const id = row.pin_id as string;
    tally[id] = (tally[id] ?? 0) + 1;
  }

  // Top 15 by read count
  const topIds = Object.entries(tally)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 15)
    .map(([id]) => id);

  const { data: pins, error: pinsError } = await supabase
    .from("pins")
    .select("id, headline, summary, stat_1, stat_2, stat_3, topic, source_name, source_url, published_at, lat, lng, country_code, region_label")
    .in("id", topIds);

  if (pinsError) {
    console.error("[/api/pins/trending] pins query failed:", pinsError.message);
    return NextResponse.json({ error: "Failed to fetch pins" }, { status: 500 });
  }

  // Preserve the read-count order
  const pinMap = new Map((pins ?? []).map((p) => [p.id as string, p]));
  const ordered = topIds.map((id) => pinMap.get(id)).filter(Boolean);

  return NextResponse.json(ordered);
}
