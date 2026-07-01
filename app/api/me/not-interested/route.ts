import { NextResponse } from "next/server";
import { supabase } from "@/lib/db/supabase-service";
import { createSupabaseServerClient } from "@/lib/db/supabase-server";

// GET /api/me/not-interested
// Returns all pin IDs the current user has dismissed.
// Used by MapContainer on mount to restore the dismissed set across sessions.
export async function GET() {
  const serverClient = await createSupabaseServerClient();
  const { data: { user } } = await serverClient.auth.getUser();
  if (!user) return NextResponse.json([]);

  const { data, error } = await supabase
    .from("user_not_interested")
    .select("pin_id")
    .eq("user_id", user.id);

  if (error) {
    console.error("[/api/me/not-interested] failed:", error.message);
    return NextResponse.json([]);
  }

  return NextResponse.json((data ?? []).map((r: { pin_id: string }) => r.pin_id));
}
