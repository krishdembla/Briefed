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

export type DigestFrequency = "daily" | "weekdays" | "weekly" | "off";

// Returns the user's saved digest frequency, defaulting to 'daily'.
export async function getDigestFrequency(userId: string): Promise<DigestFrequency> {
  const supabase = createSupabaseBrowserClient();
  const { data } = await supabase
    .from("user_preferences")
    .select("digest_frequency")
    .eq("user_id", userId)
    .single();
  return (data?.digest_frequency as DigestFrequency) ?? "daily";
}

// Saves the user's digest frequency preference.
export async function saveDigestFrequency(userId: string, frequency: DigestFrequency): Promise<void> {
  const supabase = createSupabaseBrowserClient();
  const { error } = await supabase
    .from("user_preferences")
    .upsert({ user_id: userId, digest_frequency: frequency }, { onConflict: "user_id" });

  if (error) {
    console.error("[preferences] Failed to save digest frequency:", error.message);
    throw error;
  }
}
