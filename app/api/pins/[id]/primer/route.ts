import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/db/supabase-service";
import { createSupabaseServerClient } from "@/lib/db/supabase-server";
import { generatePrimer } from "@/lib/ai/generatePrimer";
import { LLM_MODEL } from "@/lib/ai/client";

// POST /api/pins/:id/primer
// Returns the "What led to this?" primer for a pin. Generated lazily on first
// click and cached in pin_primers forever (primers about past events don't age).
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  // Require auth — prevents anonymous LLM cost drain and keeps this tied to
  // real users the same way the read/related routes are.
  const serverClient = await createSupabaseServerClient();
  const {
    data: { user },
    error: authError,
  } = await serverClient.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Cache check first — most repeat clicks land here.
  const { data: cached } = await supabase
    .from("pin_primers")
    .select("primer_md, sources_used, mode")
    .eq("pin_id", id)
    .maybeSingle();

  if (cached) {
    const sources = await loadSourcePins((cached.sources_used as string[]) ?? []);
    return NextResponse.json({
      primer_md: cached.primer_md,
      mode: cached.mode,
      sources,
      cached: true,
    });
  }

  // Load target pin
  const { data: target, error: targetErr } = await supabase
    .from("pins")
    .select("id, headline, summary, published_at")
    .eq("id", id)
    .maybeSingle();

  if (targetErr || !target) {
    return NextResponse.json({ error: "Pin not found" }, { status: 404 });
  }

  // Retrieve candidate prior pins via pin_relations graph (up to 2 hops).
  const candidates = await getCandidatePriorPins(id, target.published_at);

  // Generate primer via LLM
  let result;
  try {
    result = await generatePrimer(
      {
        headline: target.headline,
        summary: target.summary,
        published_at: target.published_at,
      },
      candidates
    );
  } catch (err) {
    console.error("[primer POST] generation failed:", err);
    return NextResponse.json(
      { error: "Failed to generate primer" },
      { status: 502 }
    );
  }

  // Persist — upsert handles the concurrent-click race harmlessly.
  const { error: upsertErr } = await supabase.from("pin_primers").upsert({
    pin_id: id,
    primer_md: result.primer_md,
    sources_used: result.sources_used,
    mode: result.mode,
    model: LLM_MODEL,
  });
  if (upsertErr) {
    console.error("[primer POST] cache write failed:", upsertErr.message);
    // Non-fatal — user still gets the generated primer, we just re-generate next time.
  }

  const sources = await loadSourcePins(result.sources_used);
  return NextResponse.json({
    primer_md: result.primer_md,
    mode: result.mode,
    sources,
    cached: false,
  });
}

// Walks pin_relations up to 2 hops to gather candidate prior pins for the
// primer. Two hops matters because detectThreads only links pins within a
// 5-day window at ingestion — 2 hops lets us reach ~10 days of transitive
// context. Filters to pins published strictly before the target.
async function getCandidatePriorPins(pinId: string, publishedAt: string) {
  // Hop 1: direct neighbors
  const { data: hop1 } = await supabase
    .from("pin_relations")
    .select("pin_id_a, pin_id_b")
    .or(`pin_id_a.eq.${pinId},pin_id_b.eq.${pinId}`);

  const firstHop = new Set<string>();
  for (const r of hop1 ?? []) {
    firstHop.add(r.pin_id_a === pinId ? r.pin_id_b : r.pin_id_a);
  }

  // Hop 2: neighbors of neighbors
  const allIds = new Set<string>(firstHop);
  const firstHopArr = [...firstHop];
  if (firstHopArr.length > 0) {
    const [{ data: h2a }, { data: h2b }] = await Promise.all([
      supabase
        .from("pin_relations")
        .select("pin_id_a, pin_id_b")
        .in("pin_id_a", firstHopArr),
      supabase
        .from("pin_relations")
        .select("pin_id_a, pin_id_b")
        .in("pin_id_b", firstHopArr),
    ]);
    for (const r of [...(h2a ?? []), ...(h2b ?? [])]) {
      allIds.add(r.pin_id_a);
      allIds.add(r.pin_id_b);
    }
  }
  allIds.delete(pinId);

  if (allIds.size === 0) return [];

  const { data: pins } = await supabase
    .from("pins")
    .select("id, headline, summary, published_at")
    .in("id", [...allIds])
    .lt("published_at", publishedAt)
    .order("published_at", { ascending: false })
    .limit(15);

  return pins ?? [];
}

// Load display details for the primer's sources footer.
async function loadSourcePins(ids: string[]) {
  if (!ids.length) return [];
  const { data } = await supabase
    .from("pins")
    .select("id, headline, published_at, source_name, source_url")
    .in("id", ids)
    .order("published_at", { ascending: false });
  return data ?? [];
}
