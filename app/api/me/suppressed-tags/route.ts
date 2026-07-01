import { NextResponse } from "next/server";
import { supabase } from "@/lib/db/supabase-service";
import { createSupabaseServerClient } from "@/lib/db/supabase-server";

// GET /api/me/suppressed-tags
// Returns fine-grained tags that appear on 2+ pins the user has dismissed as "not interested".
// These are used to soft-suppress matching content from the "For You" feed.
// Broad topic labels (tech, sports, politics…) are never returned — suppression
// only targets the specific fine-grained tags stored on each pin.
export async function GET() {
  const serverClient = await createSupabaseServerClient();
  const { data: { user } } = await serverClient.auth.getUser();
  if (!user) return NextResponse.json([]);

  // Unnest the tags arrays and count how many dismissed pins each tag appears on.
  // Only tags with count >= 2 are returned — a single dismissal never suppresses a tag.
  const { data, error } = await supabase.rpc("get_suppressed_tags", {
    p_user_id: user.id,
    p_threshold: 2,
  });

  if (error) {
    console.error("[/api/me/suppressed-tags] failed:", error.message);
    return NextResponse.json([]);
  }

  return NextResponse.json((data ?? []).map((r: { tag: string }) => r.tag));
}
