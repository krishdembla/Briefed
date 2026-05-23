import { createSupabaseBrowserClient } from "./supabase-browser";

const CHECKIN_REQUIRED = 3;

// Upsert today's checkin record. Safe to call multiple times — idempotent.
export async function recordCheckin(userId: string, pinsRead: number): Promise<void> {
  const supabase = createSupabaseBrowserClient();
  const today = new Date().toISOString().slice(0, 10);

  const { error } = await supabase
    .from("checkins")
    .upsert(
      { user_id: userId, date: today, pins_read: pinsRead },
      { onConflict: "user_id,date" }
    );

  if (error) {
    console.error("[checkins] Failed to record checkin:", error.message);
  }
}

// Returns the current consecutive-day streak for a user.
// A streak counts today (if complete) or yesterday as the anchor day,
// so the number doesn't drop to 0 mid-day before the user has checked in.
export async function fetchStreak(userId: string): Promise<number> {
  const supabase = createSupabaseBrowserClient();

  const { data, error } = await supabase
    .from("checkins")
    .select("date")
    .eq("user_id", userId)
    .gte("pins_read", CHECKIN_REQUIRED)
    .order("date", { ascending: false })
    .limit(60);

  if (error || !data || data.length === 0) return 0;

  const dates = new Set(data.map((r: { date: string }) => r.date));
  const today = new Date().toISOString().slice(0, 10);
  const yesterday = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10);

  // Streak anchor: today if already complete, otherwise yesterday
  const anchor = dates.has(today) ? today : dates.has(yesterday) ? yesterday : null;
  if (!anchor) return 0;

  let streak = 0;
  let cursor = new Date(anchor);

  while (true) {
    const dateStr = cursor.toISOString().slice(0, 10);
    if (!dates.has(dateStr)) break;
    streak++;
    cursor = new Date(cursor.getTime() - 86_400_000);
  }

  return streak;
}
