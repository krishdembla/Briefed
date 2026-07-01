import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/db/supabase-service";
import { createSupabaseServerClient } from "@/lib/db/supabase-server";

// POST /api/pins/:id/not-interested
// Records that the user is not interested in this pin.
// Stores the pin's current tags so suppression scoring can use them later.
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const serverClient = await createSupabaseServerClient();
  const { data: { user }, error: authError } = await serverClient.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Fetch the pin's current tags so we can snapshot them on the record
  const { data: pin } = await supabase
    .from("pins")
    .select("tags")
    .eq("id", id)
    .maybeSingle();

  const tagsAtTime: string[] = (pin?.tags as string[] | null) ?? [];

  const { error } = await supabase
    .from("user_not_interested")
    .upsert(
      { user_id: user.id, pin_id: id, tags_at_time: tagsAtTime },
      { onConflict: "user_id,pin_id", ignoreDuplicates: true }
    );

  if (error) {
    console.error("[not-interested POST] failed:", error.message);
    return NextResponse.json({ error: "Failed to record" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
