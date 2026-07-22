import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/db/supabase-service";
import { createSupabaseServerClient } from "@/lib/db/supabase-server";
import { generateMarketTakeaway } from "@/lib/ai/generateMarketTakeaway";
import { LLM_MODEL } from "@/lib/ai/client";

// POST /api/pins/:id/market-takeaway
// Returns a short editorial takeaway explaining why this news matters to the
// tickers attached to the pin. Generated lazily on first click and cached in
// pin_market_takeaways forever.
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  // Auth gate — matches primer route.
  const serverClient = await createSupabaseServerClient();
  const {
    data: { user },
    error: authError,
  } = await serverClient.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Cache check first
  const { data: cached } = await supabase
    .from("pin_market_takeaways")
    .select("sector_label, takeaway_md")
    .eq("pin_id", id)
    .maybeSingle();

  if (cached) {
    return NextResponse.json({
      sector_label: cached.sector_label,
      takeaway_md: cached.takeaway_md,
      cached: true,
    });
  }

  // Load target pin. We need headline, summary, and the tickers the classifier
  // attached — the takeaway is grounded in those.
  const { data: target, error: targetErr } = await supabase
    .from("pins")
    .select("id, headline, summary, tickers, market_relevance")
    .eq("id", id)
    .maybeSingle();

  if (targetErr || !target) {
    return NextResponse.json({ error: "Pin not found" }, { status: 404 });
  }

  const tickers = (target.tickers as string[]) ?? [];
  if (tickers.length === 0 || target.market_relevance !== "high") {
    // Guard: this endpoint shouldn't be reachable from the UI in this state,
    // but if a client force-hits it we return a clear signal.
    return NextResponse.json(
      { error: "No market takeaway for this pin" },
      { status: 400 }
    );
  }

  let result;
  try {
    result = await generateMarketTakeaway({
      headline: target.headline,
      summary: target.summary,
      tickers,
    });
  } catch (err) {
    console.error("[market-takeaway POST] generation failed:", err);
    return NextResponse.json(
      { error: "Failed to generate takeaway" },
      { status: 502 }
    );
  }

  const { error: upsertErr } = await supabase
    .from("pin_market_takeaways")
    .upsert({
      pin_id: id,
      sector_label: result.sector_label,
      takeaway_md: result.takeaway_md,
      model: LLM_MODEL,
    });
  if (upsertErr) {
    console.error("[market-takeaway POST] cache write failed:", upsertErr.message);
    // Non-fatal — user still gets the takeaway, we re-generate next time.
  }

  return NextResponse.json({
    sector_label: result.sector_label,
    takeaway_md: result.takeaway_md,
    cached: false,
  });
}
