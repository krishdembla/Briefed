"use client";

import { useEffect, useState } from "react";
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
  "sports",
];

const TOPIC_DESCRIPTIONS: Record<PinTopic, string> = {
  politics: "Elections, diplomacy, government",
  economy: "Markets, trade, inflation",
  conflict: "Wars, crises, security",
  health: "Pandemics, medicine, public health",
  climate: "Environment, energy, sustainability",
  tech: "AI, startups, innovation",
  sports: "Major tournaments, championships, records",
  other: "",
};

export default function OnboardingPage() {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<PinTopic>>(new Set());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [sessionReady, setSessionReady] = useState(false);

  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    // Fresh signups can land here before the browser client has hydrated the
    // session cookie. If getUser() returns null, poll onAuthStateChange so we
    // pick up SIGNED_IN as soon as it fires — avoids the "refresh to unblock
    // Save" papercut.
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) {
        setUserId(data.user.id);
        setSessionReady(true);
      }
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        setUserId(session.user.id);
        setSessionReady(true);
      }
    });
    return () => sub.subscription.unsubscribe();
  }, []);

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

  // Resolve the user id: prefer state, otherwise ask supabase directly. Handles
  // the case where the user clicks Save before useEffect's getUser() resolves.
  async function resolveUserId(): Promise<string | null> {
    if (userId) return userId;
    const supabase = createSupabaseBrowserClient();
    const { data } = await supabase.auth.getUser();
    return data.user?.id ?? null;
  }

  async function handleSave() {
    setSaving(true);
    setError(null);

    const id = await resolveUserId();
    if (!id) {
      setError("Session not ready — please refresh the page and try again.");
      setSaving(false);
      return;
    }

    try {
      const topics = selected.size > 0 ? [...selected] : SELECTABLE_TOPICS;
      await savePreferences(id, topics);
      markOnboarded();
      router.push("/map");
      router.refresh();
    } catch (err) {
      console.error("[onboarding] Save failed:", err);
      setError("Something went wrong. Please try again.");
      setSaving(false);
    }
  }

  function handleSkip() {
    markOnboarded();
    router.push("/map");
  }

  return (
    <div className="min-h-screen bg-paper flex items-center justify-center p-4 font-sans">
      <div className="w-full max-w-lg">
        {/* Header */}
        <div className="text-center mb-2">
          <h1 className="font-serif text-4xl tracking-tight text-ink mb-2">
            Personalise your digest
          </h1>
          <p className="text-ink-soft text-sm leading-relaxed">
            Choose which topics appear in your <span className="text-ink font-medium">morning email</span>. The map always shows everything.
          </p>
        </div>

        {/* Divider with label */}
        <div className="flex items-center gap-3 my-6">
          <div className="flex-1 h-px bg-rule" />
          <span className="text-[11px] uppercase tracking-[0.15em] text-ink-faint">pick any you care about</span>
          <div className="flex-1 h-px bg-rule" />
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
                className={`relative flex flex-col items-start gap-1.5 p-4 rounded-md border text-left transition-all ${
                  isSelected
                    ? "bg-paper-sunken"
                    : "bg-paper-raised border-rule hover:border-rule-strong"
                }`}
                style={isSelected ? { borderColor: color } : {}}
              >
                {/* Checkmark */}
                <div
                  className={`absolute top-3 right-3 w-5 h-5 rounded-full border flex items-center justify-center transition-all ${
                    isSelected ? "border-transparent" : "border-rule-strong"
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
                  className="font-serif text-lg"
                  style={{ color: isSelected ? color : "var(--ink)" }}
                >
                  {TOPIC_LABELS[topic]}
                </span>
                <span className="text-xs text-ink-faint leading-snug pr-4">
                  {TOPIC_DESCRIPTIONS[topic]}
                </span>
              </button>
            );
          })}
        </div>

        {error && <p className="text-[#9e4a3c] text-xs text-center mb-4">{error}</p>}

        <button
          onClick={handleSave}
          disabled={saving || !sessionReady}
          className="w-full py-3 rounded-md bg-accent text-white font-medium text-sm hover:bg-accent-hover active:scale-[0.99] transition-all disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {!sessionReady
            ? "Loading your account…"
            : saving
            ? "Saving…"
            : selected.size > 0
            ? `Save ${selected.size} topic${selected.size > 1 ? "s" : ""} & open map`
            : "Save all topics & open map"}
        </button>

        <button
          onClick={handleSkip}
          disabled={!sessionReady}
          className="w-full mt-3 py-2 text-xs text-ink-faint hover:text-ink transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Skip for now — I{"'"}ll get everything in my digest
        </button>
      </div>
    </div>
  );
}
