import { createSupabaseBrowserClient } from "./supabase-browser";

export interface PinAlbum {
  id: string;
  name: string;
  created_at: string;
  pinCount: number;
}

export interface SavedPinEntry {
  id: string;
  savedAt: string;
  pinId: string;
  pin: {
    id: string;
    headline: string;
    topic: string | null;
    region_label: string | null;
    source_name: string;
    source_url: string;
    published_at: string;
  } | null;
}

// Returns all albums for a user with pin counts.
export async function getAlbums(userId: string): Promise<PinAlbum[]> {
  const supabase = createSupabaseBrowserClient();
  const { data, error } = await supabase
    .from("pin_albums")
    .select("id, name, created_at, saved_pins(count)")
    .eq("user_id", userId)
    .order("created_at", { ascending: true });

  if (error) {
    console.error("[saves] getAlbums failed:", error.message);
    return [];
  }

  return (data ?? []).map((row) => ({
    id: row.id as string,
    name: row.name as string,
    created_at: row.created_at as string,
    pinCount: (row.saved_pins as { count: number }[])[0]?.count ?? 0,
  }));
}

// Creates a new album. Returns the created album.
export async function createAlbum(userId: string, name: string): Promise<PinAlbum> {
  const supabase = createSupabaseBrowserClient();
  const { data, error } = await supabase
    .from("pin_albums")
    .insert({ user_id: userId, name: name.trim() })
    .select("id, name, created_at")
    .single();

  if (error || !data) {
    throw new Error(`[saves] createAlbum failed: ${error?.message}`);
  }

  return { id: data.id as string, name: data.name as string, created_at: data.created_at as string, pinCount: 0 };
}

// Deletes an album and all its saved pins (via FK cascade).
export async function deleteAlbum(albumId: string): Promise<void> {
  const supabase = createSupabaseBrowserClient();
  const { error } = await supabase.from("pin_albums").delete().eq("id", albumId);
  if (error) throw new Error(`[saves] deleteAlbum failed: ${error.message}`);
}

// Returns all pin IDs saved by the user across all albums — used to show filled bookmark icons.
export async function getSavedPinIds(userId: string): Promise<string[]> {
  const supabase = createSupabaseBrowserClient();
  const { data, error } = await supabase
    .from("saved_pins")
    .select("pin_id")
    .eq("user_id", userId);

  if (error) {
    console.error("[saves] getSavedPinIds failed:", error.message);
    return [];
  }

  return [...new Set((data ?? []).map((r) => r.pin_id as string))];
}

// Returns album IDs that contain a specific pin (for album picker checkmarks).
export async function getPinAlbumIds(userId: string, pinId: string): Promise<string[]> {
  const supabase = createSupabaseBrowserClient();
  const { data, error } = await supabase
    .from("saved_pins")
    .select("album_id")
    .eq("user_id", userId)
    .eq("pin_id", pinId);

  if (error) {
    console.error("[saves] getPinAlbumIds failed:", error.message);
    return [];
  }

  return (data ?? []).map((r) => r.album_id as string);
}

// Saves a pin to an album. Ignores duplicate if already saved there.
export async function savePin(userId: string, pinId: string, albumId: string): Promise<void> {
  const supabase = createSupabaseBrowserClient();
  const { error } = await supabase
    .from("saved_pins")
    .upsert({ user_id: userId, pin_id: pinId, album_id: albumId }, { onConflict: "user_id,pin_id,album_id", ignoreDuplicates: true });

  if (error) throw new Error(`[saves] savePin failed: ${error.message}`);
}

// Removes a pin from a specific album.
export async function unsavePin(pinId: string, albumId: string): Promise<void> {
  const supabase = createSupabaseBrowserClient();
  const { error } = await supabase
    .from("saved_pins")
    .delete()
    .eq("pin_id", pinId)
    .eq("album_id", albumId);

  if (error) throw new Error(`[saves] unsavePin failed: ${error.message}`);
}

// Returns all saved pins in an album with full pin data.
// Uses two queries instead of a join — PostgREST column-hint joins are unreliable
// and silently return null when the FK hint doesn't match the constraint name exactly.
export async function getSavedPins(albumId: string): Promise<SavedPinEntry[]> {
  const supabase = createSupabaseBrowserClient();

  const { data: rows, error } = await supabase
    .from("saved_pins")
    .select("id, saved_at, pin_id")
    .eq("album_id", albumId)
    .order("saved_at", { ascending: false });

  if (error) {
    console.error("[saves] getSavedPins rows failed:", error.message);
    return [];
  }
  if (!rows?.length) return [];

  const pinIds = rows.map((r) => r.pin_id as string);

  // Fetch pin data via the server-side API route — uses the service role key
  // so it bypasses RLS on the pins table (anon key has no direct SELECT policy).
  const res = await fetch(`/api/pins/batch?ids=${pinIds.join(",")}`)
    .catch(() => null);

  if (!res?.ok) {
    console.error("[saves] getSavedPins pins batch fetch failed");
    return [];
  }

  const pins = await res.json() as { id: string; headline: string; topic: string | null; region_label: string | null; source_name: string; source_url: string; published_at: string }[];
  const pinMap = new Map(pins.map((p) => [p.id, p]));

  return rows.map((row) => ({
    id: row.id as string,
    savedAt: row.saved_at as string,
    pinId: row.pin_id as string,
    pin: (pinMap.get(row.pin_id as string) ?? null) as SavedPinEntry["pin"],
  }));
}
