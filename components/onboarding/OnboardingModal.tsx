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

  function toggle(topic: PinTopic) {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(topic) ? next.delete(topic) : next.add(topic);
      return next;
    });
  }

  async function handleContinue() {
    setSaving(true);
    const topics = selected.size > 0 ? [...selected] : SELECTABLE_TOPICS;
    await savePreferences(userId, topics).catch(console.error);
    setSaving(false);
    setStep(2);
  }

  function handleDone() {
    const topics = selected.size > 0 ? [...selected] : SELECTABLE_TOPICS;
    localStorage.setItem("briefed-onboarded", "1");
    onComplete(topics);
  }

  return (
    <div className="absolute inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-zinc-950 border border-zinc-800 rounded-t-3xl sm:rounded-3xl w-full sm:max-w-sm p-6 shadow-2xl">

        {step === 1 && (
          <>
            <div className="mb-5 text-center">
              <p className="text-2xl font-black tracking-tight bg-gradient-to-r from-indigo-400 to-sky-400 bg-clip-text text-transparent">
                Briefed
              </p>
              <p className="text-white font-semibold mt-2">What do you follow?</p>
              <p className="text-zinc-500 text-sm mt-1">
                Pick your interests and we'll personalise your feed and morning email.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-2 mb-5">
              {SELECTABLE_TOPICS.map((topic) => {
                const isSelected = selected.has(topic);
                const color = TOPIC_COLORS[topic];
                return (
                  <button
                    key={topic}
                    onClick={() => toggle(topic)}
                    className={`flex items-center gap-2.5 px-3 py-3 rounded-xl border text-left transition-all ${
                      isSelected
                        ? "border-transparent"
                        : "bg-zinc-900 border-zinc-800 hover:border-zinc-600"
                    }`}
                    style={isSelected ? { backgroundColor: color + "18", borderColor: color + "60" } : {}}
                  >
                    <div
                      className="w-2.5 h-2.5 rounded-full shrink-0"
                      style={{ backgroundColor: isSelected ? color : "#52525b" }}
                    />
                    <span
                      className="text-sm font-semibold"
                      style={{ color: isSelected ? color : "#a1a1aa" }}
                    >
                      {TOPIC_LABELS[topic]}
                    </span>
                  </button>
                );
              })}
            </div>

            <button
              onClick={handleContinue}
              disabled={saving}
              className="w-full py-3 rounded-2xl bg-white text-zinc-900 font-semibold text-sm hover:bg-zinc-100 active:scale-[0.98] transition-all disabled:opacity-40"
            >
              {saving ? "Saving…" : selected.size === 0 ? "Skip — show everything" : "Set my feed →"}
            </button>
          </>
        )}

        {step === 2 && (
          <div className="text-center py-2">
            <div className="text-4xl mb-4">🌍</div>
            <p className="text-white font-bold text-lg mb-2">Your feed is ready</p>
            <p className="text-zinc-500 text-sm mb-6">
              {selected.size > 0
                ? `You'll see ${selected.size} topic${selected.size > 1 ? "s" : ""} in your feed and morning digest.`
                : "You'll see all topics — update anytime from your profile."}
            </p>
            <p className="text-zinc-600 text-xs mb-6">
              Read 3 stories a day to build a streak. Check in every morning to stay on track.
            </p>
            <button
              onClick={handleDone}
              className="w-full py-3 rounded-2xl bg-white text-zinc-900 font-semibold text-sm hover:bg-zinc-100 active:scale-[0.98] transition-all"
            >
              Start reading →
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
