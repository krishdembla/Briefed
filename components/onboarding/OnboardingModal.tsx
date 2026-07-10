"use client";

import { useState } from "react";
import { TOPIC_COLORS, TOPIC_LABELS } from "@/types/map";
import { savePreferences } from "@/lib/db/preferences";
import type { PinTopic } from "@/types/pipeline";

const SELECTABLE_TOPICS: PinTopic[] = ["politics", "economy", "conflict", "health", "climate", "tech"];

interface OnboardingModalProps {
  userId: string;
  onComplete: (topics: PinTopic[]) => void;
}

export default function OnboardingModal({ userId, onComplete }: OnboardingModalProps) {
  const [step, setStep] = useState<1 | 2>(1);
  const [selected, setSelected] = useState<Set<PinTopic>>(new Set());
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  function toggle(topic: PinTopic) {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(topic) ? next.delete(topic) : next.add(topic);
      return next;
    });
  }

  async function handleContinue() {
    setSaving(true);
    setSaveError(null);
    const topics = selected.size > 0 ? [...selected] : SELECTABLE_TOPICS;
    try {
      await savePreferences(userId, topics);
      setStep(2);
    } catch (err) {
      console.error("[OnboardingModal] Failed to save preferences:", err);
      setSaveError("Couldn't save your topics. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  function handleDone() {
    const topics = selected.size > 0 ? [...selected] : SELECTABLE_TOPICS;
    // Set cookie so middleware can detect onboarding completion on the server side
    document.cookie = "briefed_onboarded=1; path=/; max-age=31536000; SameSite=Lax";
    onComplete(topics);
  }

  return (
    <div className="absolute inset-0 z-50 flex items-end sm:items-center justify-center bg-ink/40 backdrop-blur-sm font-sans">
      <div className="bg-paper-raised border border-rule rounded-t-2xl sm:rounded-xl w-full sm:max-w-sm p-7 shadow-2xl animate-modal-in">

        {step === 1 && (
          <>
            <div className="mb-6 text-center">
              <p className="font-serif text-3xl tracking-tight text-ink">Briefed</p>
              <p className="text-ink font-serif text-xl mt-3">What do you follow?</p>
              <p className="text-ink-soft text-sm mt-1.5 leading-relaxed">
                Pick your interests and we{"'"}ll personalise your feed and morning email.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-2 mb-6">
              {SELECTABLE_TOPICS.map((topic) => {
                const isSelected = selected.has(topic);
                const color = TOPIC_COLORS[topic];
                return (
                  <button
                    key={topic}
                    onClick={() => toggle(topic)}
                    className={`flex items-center gap-2.5 px-3 py-3 rounded-md border text-left transition-all ${
                      isSelected
                        ? "bg-paper-sunken"
                        : "bg-paper border-rule hover:border-rule-strong"
                    }`}
                    style={isSelected ? { borderColor: color } : {}}
                  >
                    <div
                      className="w-2.5 h-2.5 rounded-full shrink-0"
                      style={{ backgroundColor: isSelected ? color : "#c8c2b6" }}
                    />
                    <span
                      className="text-sm font-medium"
                      style={{ color: isSelected ? color : "var(--ink-soft)" }}
                    >
                      {TOPIC_LABELS[topic]}
                    </span>
                  </button>
                );
              })}
            </div>

            {saveError && <p className="text-[#9e4a3c] text-xs text-center mb-3">{saveError}</p>}

            <button
              onClick={handleContinue}
              disabled={saving}
              className="w-full py-3 rounded-md bg-accent text-white font-medium text-sm hover:bg-accent-hover active:scale-[0.99] transition-all disabled:opacity-40"
            >
              {saving ? "Saving…" : selected.size === 0 ? "Skip — show everything" : "Set my feed"}
            </button>
          </>
        )}

        {step === 2 && (
          <div className="text-center py-2">
            <p className="font-serif text-2xl text-ink mb-2">Your feed is ready</p>
            <p className="text-ink-soft text-sm mb-6 leading-relaxed">
              {selected.size > 0
                ? `You'll see ${selected.size} topic${selected.size > 1 ? "s" : ""} in your feed and morning digest.`
                : "You'll see all topics — update anytime from your profile."}
            </p>
            <p className="text-ink-faint text-xs mb-7 leading-relaxed">
              Read 3 stories a day to build a streak. Check in every morning to stay on track.
            </p>
            <button
              onClick={handleDone}
              className="w-full py-3 rounded-md bg-accent text-white font-medium text-sm hover:bg-accent-hover active:scale-[0.99] transition-all"
            >
              Start reading
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
