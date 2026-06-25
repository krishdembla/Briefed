import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/db/supabase-service";

// GET /api/pins/:id/related
// Returns pins that are story-thread matches for the given pin, ordered by
// published_at descending. Uses the service role key so pins RLS is bypassed.
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  // Find all relation rows where this pin appears on either side
  const { data: relations, error: relErr } = await supabase
    .from("pin_relations")
    .select("pin_id_a, pin_id_b")
    .or(`pin_id_a.eq.${id},pin_id_b.eq.${id}`);

  if (relErr) {
    console.error("[/api/pins/[id]/related] relations query failed:", relErr.message);
    return NextResponse.json({ error: "Failed to fetch relations" }, { status: 500 });
  }

  if (!relations?.length) {
    return NextResponse.json([]);
  }

  // Collect the related pin IDs (the other side of each relation)
  const relatedIds = relations.map((r) => (r.pin_id_a === id ? r.pin_id_b : r.pin_id_a));

  const { data: pins, error: pinsErr } = await supabase
    .from("pins")
    .select("id, headline, summary, stat_1, stat_2, stat_3, topic, source_name, source_url, published_at, lat, lng, country_code, region_label")
    .in("id", relatedIds)
    .order("published_at", { ascending: false });

  if (pinsErr) {
    console.error("[/api/pins/[id]/related] pins query failed:", pinsErr.message);
    return NextResponse.json({ error: "Failed to fetch pins" }, { status: 500 });
  }

  return NextResponse.json(pins ?? []);
}
