"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/db/supabase-browser";
import { getPreferences, savePreferences } from "@/lib/db/preferences";
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

interface UserMenuProps {
  userId: string;
  userEmail: string;
}

export default function UserMenu({ userId, userEmail }: UserMenuProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [topics, setTopics] = useState<Set<PinTopic>>(new Set());
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  const initial = (userEmail[0] ?? "?").toUpperCase();

  // Load saved preferences when panel opens
  useEffect(() => {
    if (!open) return;
    getPreferences(userId).then((prefs) => {
      setTopics(new Set(prefs));
    }).catch(console.error);
  }, [open, userId]);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  function toggle(topic: PinTopic) {
    setTopics((prev) => {
      const next = new Set(prev);
      next.has(topic) ? next.delete(topic) : next.add(topic);
      return next;
    });
    setSaved(false);
  }

  async function handleSave() {
    setSaving(true);
    try {
      const topicsToSave = topics.size > 0 ? [...topics] : SELECTABLE_TOPICS;
      await savePreferences(userId, topicsToSave);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err) {
      console.error("[UserMenu] Failed to save preferences:", err);
    } finally {
      setSaving(false);
    }
  }

  async function handleSignOut() {
    setSigningOut(true);
    const supabase = createSupabaseBrowserClient();
    await supabase.auth.signOut();
    router.push("/auth");
    router.refresh();
  }

  return (
    <div ref={panelRef} className="absolute left-4 z-10" style={{ top: "calc(1rem + env(safe-area-inset-top, 0px))" }}>
      {/* Avatar button */}
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label="Open profile"
        className={`w-10 h-10 rounded-full flex items-center justify-center text-xs font-bold transition-all shadow-lg border ${
          open
            ? "bg-white text-zinc-900 border-white"
            : "bg-zinc-900/80 backdrop-blur-sm border-zinc-700 text-zinc-300 hover:border-zinc-500 hover:text-white"
        }`}
      >
        {initial}
      </button>

      {/* Profile panel */}
      {open && (
        <div className="absolute top-10 left-0 w-72 bg-zinc-900 border border-zinc-800 rounded-2xl shadow-2xl overflow-hidden animate-modal-in">
          {/* Header */}
          <div className="px-4 py-4 border-b border-zinc-800">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-zinc-700 flex items-center justify-center text-sm font-bold text-white shrink-0">
                {initial}
              </div>
              <div className="min-w-0">
                <p className="text-white text-sm font-semibold truncate">{userEmail}</p>
                <p className="text-zinc-500 text-xs mt-0.5">Briefed member</p>
              </div>
            </div>
          </div>

          {/* Digest preferences */}
          <div className="px-4 py-4">
            <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-3">
              Morning digest topics
            </p>
            <div className="grid grid-cols-3 gap-1.5">
              {SELECTABLE_TOPICS.map((topic) => {
                const isSelected = topics.has(topic);
                const color = TOPIC_COLORS[topic];
                return (
                  <button
                    key={topic}
                    onClick={() => toggle(topic)}
                    className={`px-2 py-1.5 rounded-xl text-xs font-medium transition-all border text-center ${
                      isSelected
                        ? "border-transparent"
                        : "bg-zinc-800 border-zinc-700 text-zinc-400 hover:border-zinc-500"
                    }`}
                    style={
                      isSelected
                        ? { backgroundColor: color + "20", borderColor: color + "70", color }
                        : {}
                    }
                  >
                    {TOPIC_LABELS[topic]}
                  </button>
                );
              })}
            </div>

            <button
              onClick={handleSave}
              disabled={saving}
              className={`mt-3 w-full py-2 rounded-xl text-xs font-semibold transition-all ${
                saved
                  ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                  : "bg-white text-zinc-900 hover:bg-zinc-100 active:scale-[0.98]"
              } disabled:opacity-50`}
            >
              {saved ? "Saved ✓" : saving ? "Saving…" : "Save preferences"}
            </button>
          </div>

          {/* Sign out */}
          <div className="px-4 pb-4">
            <div className="h-px bg-zinc-800 mb-3" />
            <button
              onClick={handleSignOut}
              disabled={signingOut}
              className="w-full py-2 rounded-xl text-xs font-semibold text-zinc-400 hover:text-red-400 hover:bg-red-500/10 border border-zinc-800 hover:border-red-500/30 transition-all disabled:opacity-50"
            >
              {signingOut ? "Signing out…" : "Sign out"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
