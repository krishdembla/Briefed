import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/db/supabase";
import { generateQuiz } from "@/lib/ai/generateQuiz";
import type { MapPin } from "@/types/map";

// POST /api/quiz/generate
// Body: { pinIds: [id1, id2] }
// Returns a QuizQuestion or 204 if generation failed.
export async function POST(request: NextRequest) {
  let pinIds: string[];
  try {
    const body = await request.json() as { pinIds: string[] };
    pinIds = body.pinIds;
    if (!Array.isArray(pinIds) || pinIds.length !== 2 || pinIds.some((id) => typeof id !== "string")) {
      return NextResponse.json({ error: "pinIds must be an array of exactly 2 strings" }, { status: 400 });
    }
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("pins")
    .select("id, headline, summary, stat_1, stat_2, stat_3, topic, source_name, source_url, published_at, lat, lng, country_code, region_label")
    .in("id", pinIds);

  if (error || !data || data.length < 2) {
    console.error("[/api/quiz/generate] DB fetch failed:", error?.message);
    return new NextResponse(null, { status: 204 });
  }

  // Preserve order matching pinIds
  const ordered = pinIds.map((id) => data.find((p) => p.id === id)).filter(Boolean) as MapPin[];
  if (ordered.length < 2) return new NextResponse(null, { status: 204 });

  const quiz = await generateQuiz(ordered[0], ordered[1]);
  if (!quiz) return new NextResponse(null, { status: 204 });

  return NextResponse.json(quiz);
}
