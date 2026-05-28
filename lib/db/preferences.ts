import { createSupabaseBrowserClient } from "./supabase-browser";
import type { PinTopic } from "@/types/pipeline";

export type UserTopics = PinTopic[];

// Returns the user's saved topic preferences, or [] if none saved yet.
export async function getPreferences(userId: string): Promise<UserTopics> {
  const supabase = createSupabaseBrowserClient();
  const { data, error } = await supabase
    .from("user_preferences")
    .select("topics")
    .eq("user_id", userId)
    .single();

  if (error || !data) return [];
  return (data.topics as UserTopics) ?? [];
}

// Upserts the user's topic preferences. Throws on failure.
export async function savePreferences(userId: string, topics: UserTopics): Promise<void> {
  const supabase = createSupabaseBrowserClient();
  const { error } = await supabase
    .from("user_preferences")
    .upsert({ user_id: userId, topics }, { onConflict: "user_id" });

  if (error) {
    console.error("[preferences] Failed to save:", error.message);
    throw error;
  }
}
