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
        className={`w-10 h-10 rounded-full flex items-center justify-center text-xs font-semibold font-serif transition-all shadow-md border ${
          open
            ? "bg-accent text-white border-accent"
            : "bg-paper-raised/90 backdrop-blur-sm border-rule text-ink hover:border-rule-strong"
        }`}
      >
        {initial}
      </button>

      {/* Profile panel */}
      {open && (
        <div className="absolute top-12 left-0 w-72 bg-paper-raised border border-rule rounded-lg shadow-2xl overflow-hidden animate-modal-in">
          {/* Header */}
          <div className="px-4 py-4 border-b border-rule">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-accent flex items-center justify-center text-sm font-semibold font-serif text-white shrink-0">
                {initial}
              </div>
              <div className="min-w-0">
                <p className="text-ink text-sm font-medium truncate">{userEmail}</p>
                <p className="text-ink-faint text-xs mt-0.5">Briefed member</p>
              </div>
            </div>
          </div>

          {/* Digest preferences */}
          <div className="px-4 py-4">
            <p className="text-[11px] font-semibold text-ink-faint uppercase tracking-[0.15em] mb-3">
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
                    className={`px-2 py-1.5 rounded-md text-xs font-medium transition-all border text-center ${
                      isSelected
                        ? "bg-paper-sunken"
                        : "bg-paper border-rule text-ink-soft hover:border-rule-strong"
                    }`}
                    style={
                      isSelected
                        ? { borderColor: color, color }
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
              className={`mt-3 w-full py-2 rounded-md text-xs font-medium transition-all ${
                saved
                  ? "bg-accent/10 text-accent border border-accent/30"
                  : "bg-accent text-white hover:bg-accent-hover active:scale-[0.99]"
              } disabled:opacity-50`}
            >
              {saved ? "Saved ✓" : saving ? "Saving…" : "Save preferences"}
            </button>
          </div>

          {/* Profile + Sign out */}
          <div className="px-4 pb-4">
            <div className="h-px bg-rule mb-3" />
            <button
              onClick={() => router.push("/profile")}
              className="w-full py-2 rounded-md text-xs font-medium text-ink-soft hover:text-ink hover:bg-paper-sunken border border-rule hover:border-rule-strong transition-all mb-2"
            >
              View profile & streak
            </button>
            <button
              onClick={handleSignOut}
              disabled={signingOut}
              className="w-full py-2 rounded-md text-xs font-medium text-ink-soft hover:text-[#9e4a3c] hover:bg-[#9e4a3c]/8 border border-rule hover:border-[#9e4a3c]/30 transition-all disabled:opacity-50"
            >
              {signingOut ? "Signing out…" : "Sign out"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
