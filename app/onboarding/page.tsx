"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/db/supabase-browser";
import { savePreferences } from "@/lib/db/preferences";
import { TOPIC_COLORS, TOPIC_LABELS } from "@/types/map";
import type { PinTopic } from "@/types/pipeline";

const SELECTABLE_TOPICS: PinTopic[] = [
  "politics",
  "economy",
  "conflict",
  "health",
  "climate",
  "tech",
];

const TOPIC_DESCRIPTIONS: Record<PinTopic, string> = {
  politics: "Elections, diplomacy, government",
  economy: "Markets, trade, inflation",
  conflict: "Wars, crises, security",
  health: "Pandemics, medicine, public health",
  climate: "Environment, energy, sustainability",
  tech: "AI, startups, innovation",
  other: "",
};

export default function OnboardingPage() {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<PinTopic>>(new Set());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function toggle(topic: PinTopic) {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(topic) ? next.delete(topic) : next.add(topic);
      return next;
    });
  }

  function markOnboarded() {
    // 1-year cookie — middleware reads this to skip the onboarding redirect
    document.cookie = "briefed_onboarded=1; path=/; max-age=31536000; SameSite=Lax";
  }

  async function handleSave() {
    setSaving(true);
    setError(null);

    try {
      const supabase = createSupabaseBrowserClient();
      const { data } = await supabase.auth.getUser();
      if (!data.user) throw new Error("Not authenticated");

      // Save whatever they picked — if nothing selected, save all topics
      const topics = selected.size > 0 ? [...selected] : SELECTABLE_TOPICS;
      await savePreferences(data.user.id, topics);
      markOnboarded();
      router.push("/");
      router.refresh();
    } catch (err) {
      console.error("[onboarding] Save failed:", err);
      setError("Something went wrong. Please try again.");
      setSaving(false);
    }
  }

  function handleSkip() {
    markOnboarded();
    router.push("/");
  }

  return (
    <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-4">
      <div className="w-full max-w-lg">
        {/* Header */}
        <div className="text-center mb-2">
          <h1 className="text-white text-3xl font-bold tracking-tight mb-2">
            Personalise your digest
          </h1>
          <p className="text-zinc-400 text-sm leading-relaxed">
            Choose which topics appear in your <span className="text-white">morning email</span>. The map always shows everything.
          </p>
        </div>

        {/* Divider with label */}
        <div className="flex items-center gap-3 my-6">
          <div className="flex-1 h-px bg-zinc-800" />
          <span className="text-xs text-zinc-600">pick any you care about</span>
          <div className="flex-1 h-px bg-zinc-800" />
        </div>

        {/* Topic grid */}
        <div className="grid grid-cols-2 gap-3 mb-6">
          {SELECTABLE_TOPICS.map((topic) => {
            const isSelected = selected.has(topic);
            const color = TOPIC_COLORS[topic];

            return (
              <button
                key={topic}
                onClick={() => toggle(topic)}
                className={`relative flex flex-col items-start gap-1.5 p-4 rounded-2xl border text-left transition-all ${
                  isSelected
                    ? "border-transparent"
                    : "bg-zinc-900 border-zinc-800 hover:border-zinc-600"
                }`}
                style={
                  isSelected
                    ? { backgroundColor: color + "18", borderColor: color + "80" }
                    : {}
                }
              >
                {/* Checkmark */}
                <div
                  className={`absolute top-3 right-3 w-5 h-5 rounded-full border flex items-center justify-center transition-all ${
                    isSelected ? "border-transparent" : "border-zinc-700"
                  }`}
                  style={isSelected ? { backgroundColor: color } : {}}
                >
                  {isSelected && (
                    <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </div>

                <span
                  className="text-sm font-semibold"
                  style={{ color: isSelected ? color : "#e4e4e7" }}
                >
                  {TOPIC_LABELS[topic]}
                </span>
                <span className="text-xs text-zinc-500 leading-snug pr-4">
                  {TOPIC_DESCRIPTIONS[topic]}
                </span>
              </button>
            );
          })}
        </div>

        {error && <p className="text-red-400 text-xs text-center mb-4">{error}</p>}

        <button
          onClick={handleSave}
          disabled={saving}
          className="w-full py-3 rounded-2xl bg-white text-zinc-900 font-semibold text-sm hover:bg-zinc-100 active:scale-[0.98] transition-all disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {saving
            ? "Saving…"
            : selected.size > 0
            ? `Save ${selected.size} topic${selected.size > 1 ? "s" : ""} & open map`
            : "Save all topics & open map"}
        </button>

        <button
          onClick={handleSkip}
          className="w-full mt-3 py-2 text-xs text-zinc-600 hover:text-zinc-400 transition-colors"
        >
          Skip for now — I'll get everything in my digest
        </button>
      </div>
    </div>
  );
}
