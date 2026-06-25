import { createSupabaseBrowserClient } from "./supabase-browser";

export interface ReadHistoryEntry {
  pinId: string;
  readAt: string;
  pin: {
    id: string;
    headline: string;
    topic: string | null;
    region_label: string | null;
    source_name: string;
    published_at: string;
  } | null;
}

// Records a read event for the current user. Idempotent — unique constraint
// on (user_id, pin_id) means re-reading a pin doesn't create duplicate rows.
export async function recordRead(userId: string, pinId: string): Promise<void> {
  const supabase = createSupabaseBrowserClient();
  const { error } = await supabase
    .from("pin_reads")
    .upsert({ user_id: userId, pin_id: pinId }, { onConflict: "user_id,pin_id", ignoreDuplicates: true });

  if (error) {
    console.error("[reads] recordRead failed:", error.message);
  }
}

// Fetches the user's reading history (newest first), with headline data
// loaded via the batch API route (bypasses RLS on the pins table).
export async function getReadHistory(userId: string, limit = 30): Promise<ReadHistoryEntry[]> {
  const supabase = createSupabaseBrowserClient();

  const { data: rows, error } = await supabase
    .from("pin_reads")
    .select("pin_id, read_at")
    .eq("user_id", userId)
    .order("read_at", { ascending: false })
    .limit(limit);

  if (error) {
    console.error("[reads] getReadHistory failed:", error.message);
    return [];
  }
  if (!rows?.length) return [];

  const pinIds = rows.map((r) => r.pin_id as string);
  const res = await fetch(`/api/pins/batch?ids=${pinIds.join(",")}`).catch(() => null);
  if (!res?.ok) return rows.map((r) => ({ pinId: r.pin_id as string, readAt: r.read_at as string, pin: null }));

  const pins = await res.json() as ReadHistoryEntry["pin"][];
  const pinMap = new Map((pins ?? []).map((p) => [p!.id, p]));

  return rows.map((row) => ({
    pinId: row.pin_id as string,
    readAt: row.read_at as string,
    pin: pinMap.get(row.pin_id as string) ?? null,
  }));
}
