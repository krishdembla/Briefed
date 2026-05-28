"use client";

import { useEffect, useState } from "react";
import type { MapPin } from "@/types/map";
import type { QuizQuestion } from "@/lib/ai/generateQuiz";

interface QuizModalProps {
  pins: MapPin[]; // the pins that triggered the checkin (first 2 used)
  onClose: () => void;
}

type Phase = "loading" | "question" | "revealed" | "error";

export default function QuizModal({ pins, onClose }: QuizModalProps) {
  const [phase, setPhase] = useState<Phase>("loading");
  const [quiz, setQuiz] = useState<QuizQuestion | null>(null);
  const [selected, setSelected] = useState<number | null>(null);

  useEffect(() => {
    const pin1 = pins[0];
    const pin2 = pins[1];
    if (!pin1 || !pin2) { setPhase("error"); return; }

    fetch("/api/quiz/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pinIds: [pin1.id, pin2.id] }),
    })
      .then(async (r) => {
        if (r.status === 204) { setPhase("error"); return; }
        const data = await r.json() as QuizQuestion;
        setQuiz(data);
        setPhase("question");
      })
      .catch(() => setPhase("error"));
  }, [pins]);

  function handleSelect(idx: number) {
    if (phase !== "question") return;
    setSelected(idx);
    setPhase("revealed");
  }

  const isCorrect = selected === quiz?.correctIndex;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-modal-in">
      <div className="relative w-full max-w-md mx-4 bg-zinc-900 border border-zinc-800 rounded-2xl shadow-2xl overflow-hidden">

        {/* Header */}
        <div className="px-5 pt-5 pb-4 border-b border-zinc-800 flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Connect the dots</p>
            <p className="text-white text-sm font-semibold mt-0.5">Daily check-in complete ✓</p>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-full bg-zinc-800 flex items-center justify-center text-zinc-400 hover:text-white transition-colors text-sm"
          >
            ×
          </button>
        </div>

        {/* Body */}
        <div className="px-5 py-5">
          {phase === "loading" && (
            <div className="flex flex-col items-center gap-3 py-6">
              <div className="w-6 h-6 rounded-full border-2 border-zinc-700 border-t-white animate-spin" />
              <p className="text-zinc-400 text-sm">Generating your question…</p>
            </div>
          )}

          {phase === "error" && (
            <div className="py-6 text-center">
              <p className="text-zinc-400 text-sm">Couldn't generate a question right now.</p>
              <button onClick={onClose} className="mt-4 px-4 py-2 rounded-xl bg-zinc-800 text-zinc-300 text-xs hover:bg-zinc-700 transition-colors">
                Close
              </button>
            </div>
          )}

          {(phase === "question" || phase === "revealed") && quiz && (
            <>
              <p className="text-white text-sm font-medium leading-snug mb-4">{quiz.question}</p>

              <div className="flex flex-col gap-2">
                {quiz.options.map((option, idx) => {
                  let style = "border-zinc-700 text-zinc-300 hover:border-zinc-500 hover:text-white";
                  if (phase === "revealed") {
                    if (idx === quiz.correctIndex) {
                      style = "border-emerald-500/60 bg-emerald-500/10 text-emerald-400";
                    } else if (idx === selected && idx !== quiz.correctIndex) {
                      style = "border-red-500/60 bg-red-500/10 text-red-400";
                    } else {
                      style = "border-zinc-800 text-zinc-600 opacity-50";
                    }
                  }
                  return (
                    <button
                      key={idx}
                      onClick={() => handleSelect(idx)}
                      disabled={phase === "revealed"}
                      className={`w-full text-left px-3 py-2.5 rounded-xl border text-xs font-medium transition-all ${style}`}
                    >
                      {option}
                    </button>
                  );
                })}
              </div>

              {phase === "revealed" && (
                <div className="mt-4">
                  <div className={`text-xs font-semibold mb-1 ${isCorrect ? "text-emerald-400" : "text-red-400"}`}>
                    {isCorrect ? "Correct!" : "Not quite —"}
                  </div>
                  <p className="text-zinc-400 text-xs leading-relaxed">{quiz.explanation}</p>
                  <button
                    onClick={onClose}
                    className="mt-4 w-full py-2 rounded-xl bg-white text-zinc-900 text-xs font-semibold hover:bg-zinc-100 transition-colors"
                  >
                    Back to map
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
