import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/db/supabase-service";
import { createSupabaseServerClient } from "@/lib/db/supabase-server";

// POST /api/pins/:id/read
// Records a read for the authenticated user. Idempotent — the UNIQUE(user_id, pin_id)
// constraint means re-calling this never creates duplicates.
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

  const { error } = await supabase
    .from("pin_reads")
    .upsert({ user_id: user.id, pin_id: id }, { onConflict: "user_id,pin_id", ignoreDuplicates: true });

  if (error) {
    console.error("[read POST] upsert failed:", error.message);
    return NextResponse.json({ error: "Failed to record read" }, { status: 500 });
  }

  // Return the updated read count for this pin
  const { count } = await supabase
    .from("pin_reads")
    .select("id", { count: "exact", head: true })
    .eq("pin_id", id);

  return NextResponse.json({ readCount: count ?? 0 });
}
