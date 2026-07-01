import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/db/supabase-service";
import { createSupabaseServerClient } from "@/lib/db/supabase-server";

const VALID_REACTIONS = new Set(["like"]);

// GET /api/pins/:id/reactions
// Returns reaction counts, the current user's reaction, and the total read count.
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  // Determine the current user (optional — unauthenticated users see counts only)
  let userId: string | null = null;
  try {
    const serverClient = await createSupabaseServerClient();
    const { data: { user } } = await serverClient.auth.getUser();
    userId = user?.id ?? null;
  } catch {
    // Non-fatal — reactions are still visible without auth
  }

  const [reactionsResult, readCountResult, userReactionResult] = await Promise.all([
    // Aggregate reaction counts for this pin
    supabase
      .from("pin_reactions")
      .select("reaction")
      .eq("pin_id", id),

    // Total read count
    supabase
      .from("pin_reads")
      .select("id", { count: "exact", head: true })
      .eq("pin_id", id),

    // Current user's reaction (null if unauthenticated)
    userId
      ? supabase
          .from("pin_reactions")
          .select("reaction")
          .eq("pin_id", id)
          .eq("user_id", userId)
          .maybeSingle()
      : Promise.resolve({ data: null, error: null }),
  ]);

  if (reactionsResult.error) {
    console.error("[reactions GET] failed:", reactionsResult.error.message);
    return NextResponse.json({ error: "Failed to fetch reactions" }, { status: 500 });
  }

  const counts = { like: 0 };
  for (const row of reactionsResult.data ?? []) {
    if (row.reaction === "like") counts.like++;
  }

  return NextResponse.json({
    counts,
    readCount: readCountResult.count ?? 0,
    userReaction: (userReactionResult.data as { reaction: string } | null)?.reaction ?? null,
  });
}

// POST /api/pins/:id/reactions
// Body: { reaction: "fire" | "complex" | "useful" }
// Toggles the reaction — inserts if not present, deletes if already set.
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const serverClient = await createSupabaseServerClient();
  const { data: { user }, error: authError } = await serverClient.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { reaction?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const reaction = body.reaction;
  if (!reaction || !VALID_REACTIONS.has(reaction)) {
    return NextResponse.json({ error: "Invalid reaction" }, { status: 400 });
  }

  // Check if the user already has this reaction
  const { data: existing } = await supabase
    .from("pin_reactions")
    .select("id")
    .eq("pin_id", id)
    .eq("user_id", user.id)
    .eq("reaction", reaction)
    .maybeSingle();

  if (existing) {
    // Toggle off
    const { error } = await supabase
      .from("pin_reactions")
      .delete()
      .eq("id", existing.id);

    if (error) {
      console.error("[reactions POST] delete failed:", error.message);
      return NextResponse.json({ error: "Failed to remove reaction" }, { status: 500 });
    }
    return NextResponse.json({ action: "removed", reaction });
  } else {
    // Toggle on — also remove any other reaction from this user on this pin first
    await supabase
      .from("pin_reactions")
      .delete()
      .eq("pin_id", id)
      .eq("user_id", user.id);

    const { error } = await supabase
      .from("pin_reactions")
      .insert({ pin_id: id, user_id: user.id, reaction });

    if (error) {
      console.error("[reactions POST] insert failed:", error.message);
      return NextResponse.json({ error: "Failed to add reaction" }, { status: 500 });
    }
    return NextResponse.json({ action: "added", reaction });
  }
}
