"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/db/supabase-browser";
import { getPreferences, savePreferences, getDigestFrequency, saveDigestFrequency, type DigestFrequency } from "@/lib/db/preferences";
import { TOPIC_COLORS, TOPIC_LABELS } from "@/types/map";
import type { PinTopic } from "@/types/pipeline";
import SavedSection from "@/components/profile/SavedSection";
import ReadingHistory from "@/components/profile/ReadingHistory";

const SELECTABLE_TOPICS: PinTopic[] = ["politics", "economy", "conflict", "health", "climate", "tech"];

const CHECKIN_REQUIRED = 3;

interface CheckinRow {
  date: string; // YYYY-MM-DD
  pins_read: number;
}

function computeStats(checkins: CheckinRow[]) {
  const completedDates = new Set(
    checkins.filter((c) => c.pins_read >= CHECKIN_REQUIRED).map((c) => c.date)
  );

  // Current streak
  let streak = 0;
  const today = new Date().toISOString().slice(0, 10);
  const yesterday = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10);
  const anchor = completedDates.has(today) ? today : completedDates.has(yesterday) ? yesterday : null;
  if (anchor) {
    let cursor = new Date(anchor);
    while (true) {
      const d = cursor.toISOString().slice(0, 10);
      if (!completedDates.has(d)) break;
      streak++;
      cursor = new Date(cursor.getTime() - 86_400_000);
    }
  }

  // Longest streak
  const sorted = [...completedDates].sort();
  let longest = 0;
  let run = 0;
  let prev: Date | null = null;
  for (const d of sorted) {
    const cur = new Date(d);
    if (prev) {
      const diff = (cur.getTime() - prev.getTime()) / 86_400_000;
      run = diff === 1 ? run + 1 : 1;
    } else {
      run = 1;
    }
    if (run > longest) longest = run;
    prev = cur;
  }

  return { streak, longest, total: completedDates.size };
}

// Returns last N days as YYYY-MM-DD strings, oldest first
function lastNDays(n: number): string[] {
  const days: string[] = [];
  for (let i = n - 1; i >= 0; i--) {
    days.push(new Date(Date.now() - i * 86_400_000).toISOString().slice(0, 10));
  }
  return days;
}

// Split an array into chunks of size n
function chunk<T>(arr: T[], n: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n));
  return out;
}

export default function ProfilePage() {
  const router = useRouter();
  const [email, setEmail] = useState<string | null>(null);
  const [checkins, setCheckins] = useState<CheckinRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [shared, setShared] = useState(false);
  const shareCardRef = useRef<HTMLDivElement>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [selectedTopics, setSelectedTopics] = useState<Set<PinTopic>>(new Set());
  const [savingTopics, setSavingTopics] = useState(false);
  const [topicsSaved, setTopicsSaved] = useState(false);
  const [digestFrequency, setDigestFrequency] = useState<DigestFrequency>("daily");
  const [savingFrequency, setSavingFrequency] = useState(false);
  const [frequencySaved, setFrequencySaved] = useState(false);

  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    supabase.auth.getUser().then(async ({ data }) => {
      const user = data.user;
      if (!user) { router.push("/auth"); return; }
      setEmail(user.email ?? null);
      setUserId(user.id);

      const [checkinsResult, prefs, freq] = await Promise.all([
        supabase
          .from("checkins")
          .select("date, pins_read")
          .eq("user_id", user.id)
          .order("date", { ascending: false })
          .limit(90),
        getPreferences(user.id).catch(() => [] as PinTopic[]),
        getDigestFrequency(user.id).catch(() => "daily" as DigestFrequency),
      ]);

      if (!checkinsResult.error && checkinsResult.data) {
        setCheckins(checkinsResult.data as CheckinRow[]);
      }
      if (prefs.length > 0) {
        setSelectedTopics(new Set(prefs));
      }
      setDigestFrequency(freq);
      setLoading(false);
    });
  }, [router]);

  function toggleTopic(topic: PinTopic) {
    setSelectedTopics((prev) => {
      const next = new Set(prev);
      next.has(topic) ? next.delete(topic) : next.add(topic);
      return next;
    });
  }

  async function handleSaveFrequency(freq: DigestFrequency) {
    if (!userId) return;
    setDigestFrequency(freq);
    setSavingFrequency(true);
    try {
      await saveDigestFrequency(userId, freq);
      setFrequencySaved(true);
      setTimeout(() => setFrequencySaved(false), 2000);
    } catch (err) {
      console.error("[Profile] Failed to save digest frequency:", err);
    } finally {
      setSavingFrequency(false);
    }
  }

  async function handleSaveTopics() {
    if (!userId) return;
    setSavingTopics(true);
    const topics = selectedTopics.size > 0 ? [...selectedTopics] : SELECTABLE_TOPICS;
    try {
      await savePreferences(userId, topics);
      setTopicsSaved(true);
      setTimeout(() => setTopicsSaved(false), 2000);
    } catch (err) {
      console.error("[Profile] Failed to save topics:", err);
    } finally {
      setSavingTopics(false);
    }
  }

  const stats = computeStats(checkins);
  const days = lastNDays(35); // 5 weeks × 7 days
  const completedSet = new Set(
    checkins.filter((c) => c.pins_read >= CHECKIN_REQUIRED).map((c) => c.date)
  );
  const todayStr = new Date().toISOString().slice(0, 10);
  const weeks = chunk(days, 7);

  const initial = (email?.[0] ?? "?").toUpperCase();

  async function handleShare() {
    const text = `I'm on a ${stats.streak}-day reading streak on Briefed 🔥\nStay informed, stay consistent.`;
    const nav = navigator as Navigator & { share?: (data: ShareData) => Promise<void> };

    // Web Share API — works reliably on mobile and HTTPS desktop
    if (nav.share && window.isSecureContext) {
      try {
        await nav.share({ title: "My Briefed streak", text });
        setShared(true);
        setTimeout(() => setShared(false), 2000);
        return;
      } catch {
        // User cancelled or API unavailable — fall through to clipboard
      }
    }

    // Clipboard fallback
    try {
      await navigator.clipboard.writeText(text);
      setShared(true);
      setTimeout(() => setShared(false), 2000);
    } catch {
      // Clipboard blocked (e.g. no user gesture) — fall through to textarea trick
      const el = document.createElement("textarea");
      el.value = text;
      el.style.position = "fixed";
      el.style.opacity = "0";
      document.body.appendChild(el);
      el.focus();
      el.select();
      document.execCommand("copy");
      document.body.removeChild(el);
      setShared(true);
      setTimeout(() => setShared(false), 2000);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-paper flex items-center justify-center">
        <div className="w-5 h-5 rounded-full border-2 border-rule border-t-accent animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-paper text-ink font-sans" style={{ paddingTop: "env(safe-area-inset-top, 0px)" }}>
      {/* Nav */}
      <div className="flex items-center gap-3 px-5 py-4 border-b border-rule">
        <button
          onClick={() => router.push("/map")}
          className="w-8 h-8 flex items-center justify-center rounded-full bg-paper-raised border border-rule text-ink-soft hover:text-ink hover:border-rule-strong transition-colors"
          aria-label="Back to map"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <h1 className="font-serif text-xl">Profile</h1>
      </div>

      <div className="max-w-5xl mx-auto px-5 sm:px-6">
        {/* Identity + stats masthead — spans the full width */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-6 py-7 border-b border-rule">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-full bg-accent flex items-center justify-center text-xl font-semibold font-serif text-white shrink-0">
              {initial}
            </div>
            <div className="min-w-0">
              <p className="text-ink font-serif text-xl truncate">{email}</p>
              <p className="text-ink-faint text-xs mt-0.5">Briefed member</p>
            </div>
          </div>

          {/* Big serif stat figures, hairline-separated */}
          <div className="flex items-stretch">
            <div className="text-center px-5 sm:px-6">
              <p className="font-serif text-4xl sm:text-5xl tnum leading-none" style={{ color: "#a9762f" }}>{stats.streak}</p>
              <p className="text-ink-faint text-[10px] uppercase tracking-[0.15em] mt-2">Day streak</p>
            </div>
            <div className="w-px bg-rule" />
            <div className="text-center px-5 sm:px-6">
              <p className="font-serif text-4xl sm:text-5xl text-ink tnum leading-none">{stats.longest}</p>
              <p className="text-ink-faint text-[10px] uppercase tracking-[0.15em] mt-2">Best streak</p>
            </div>
            <div className="w-px bg-rule" />
            <div className="text-center px-5 sm:px-6">
              <p className="font-serif text-4xl sm:text-5xl text-ink tnum leading-none">{stats.total}</p>
              <p className="text-ink-faint text-[10px] uppercase tracking-[0.15em] mt-2">Check-ins</p>
            </div>
          </div>
        </div>

        {/* Dashboard grid — two columns on desktop, stacked on mobile */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 py-7 items-start">
        {/* Left column */}
        <div className="space-y-6">

        {/* Streak calendar */}
        <div className="bg-paper-raised border border-rule rounded-lg p-4">
          <p className="text-[11px] font-semibold text-ink-faint uppercase tracking-[0.15em] mb-4">
            Last 5 weeks
          </p>
          <div className="flex gap-1.5">
            {weeks.map((week, wi) => (
              <div key={wi} className="flex flex-col gap-1.5 flex-1">
                {week.map((day) => {
                  const isToday = day === todayStr;
                  const complete = completedSet.has(day);
                  const future = day > todayStr;
                  return (
                    <div
                      key={day}
                      title={day}
                      className={`w-full aspect-square rounded transition-all ${
                        future
                          ? "bg-paper-sunken/50"
                          : complete
                          ? ""
                          : "bg-paper-sunken"
                      } ${isToday ? "ring-1 ring-accent/40" : ""}`}
                      style={complete && !future ? { backgroundColor: "#a9762f" } : undefined}
                    />
                  );
                })}
              </div>
            ))}
          </div>
          <div className="flex items-center gap-2 mt-3">
            <div className="w-3 h-3 rounded-sm bg-paper-sunken" />
            <span className="text-xs text-ink-faint">Missed</span>
            <div className="w-3 h-3 rounded-sm ml-2" style={{ backgroundColor: "#a9762f" }} />
            <span className="text-xs text-ink-faint">Complete</span>
          </div>
        </div>

        {/* Topic preferences */}
        <div className="bg-paper-raised border border-rule rounded-lg p-4">
          <p className="text-[11px] font-semibold text-ink-faint uppercase tracking-[0.15em] mb-1">
            Your topics
          </p>
          <p className="text-xs text-ink-faint mb-4">
            These shape your morning digest and the default feed view.
          </p>
          <div className="grid grid-cols-2 gap-2 mb-4">
            {SELECTABLE_TOPICS.map((topic) => {
              const isSelected = selectedTopics.has(topic);
              const color = TOPIC_COLORS[topic];
              return (
                <button
                  key={topic}
                  onClick={() => toggleTopic(topic)}
                  className={`flex items-center gap-2.5 px-3 py-2.5 rounded-md border text-left transition-all ${
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
                    className="text-xs font-medium"
                    style={{ color: isSelected ? color : "var(--ink-soft)" }}
                  >
                    {TOPIC_LABELS[topic]}
                  </span>
                </button>
              );
            })}
          </div>
          <button
            onClick={handleSaveTopics}
            disabled={savingTopics}
            className={`w-full py-2.5 rounded-md text-xs font-medium transition-all ${
              topicsSaved
                ? "bg-accent/10 text-accent border border-accent/30"
                : "bg-accent text-white hover:bg-accent-hover active:scale-[0.99] disabled:opacity-40"
            }`}
          >
            {topicsSaved ? "Saved ✓" : savingTopics ? "Saving…" : "Save preferences"}
          </button>

          <div className="mt-5 pt-4 border-t border-rule">
            <p className="text-[11px] font-semibold text-ink-faint uppercase tracking-[0.15em] mb-1">
              Email digest
            </p>
            <p className="text-xs text-ink-faint mb-3">How often do you want your morning briefing?</p>
            <div className="grid grid-cols-2 gap-2">
              {(["daily", "weekdays", "weekly", "off"] as DigestFrequency[]).map((freq) => {
                const labels: Record<DigestFrequency, string> = {
                  daily: "Every day",
                  weekdays: "Weekdays only",
                  weekly: "Once a week",
                  off: "Paused",
                };
                const isActive = digestFrequency === freq;
                return (
                  <button
                    key={freq}
                    onClick={() => handleSaveFrequency(freq)}
                    disabled={savingFrequency}
                    className={`py-2 px-3 rounded-md border text-xs font-medium transition-all ${
                      isActive
                        ? "bg-accent/10 border-accent/40 text-accent"
                        : "bg-paper border-rule text-ink-soft hover:border-rule-strong"
                    }`}
                  >
                    {labels[freq]}
                    {isActive && frequencySaved ? " ✓" : ""}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
        </div>{/* left column */}

        {/* Right column */}
        <div className="space-y-6">
        {/* Saved collections */}
        {userId && <SavedSection userId={userId} />}

        {/* Reading history */}
        {userId && <ReadingHistory userId={userId} />}

        {/* Shareable streak card */}
        {stats.streak > 0 && (
          <div className="space-y-3">
            <p className="text-[11px] font-semibold text-ink-faint uppercase tracking-[0.15em]">
              Share your streak
            </p>

            {/* Card preview — editorial ink card */}
            <div
              ref={shareCardRef}
              className="rounded-lg border border-rule p-6 flex items-center justify-between gap-4"
              style={{ backgroundColor: "#1c1a17" }}
            >
              <div>
                <div className="flex items-baseline gap-2 mb-1.5">
                  <span className="font-serif text-5xl tnum" style={{ color: "#d19a52" }}>{stats.streak}</span>
                  <span className="text-sm font-medium" style={{ color: "#d19a52" }}>day{stats.streak !== 1 ? "s" : ""}</span>
                </div>
                <p className="text-white font-serif text-lg">Reading streak</p>
                <p className="text-white/50 text-xs mt-0.5">on Briefed</p>
              </div>
              <span className="font-serif text-3xl text-white/90">Briefed</span>
            </div>

            <button
              onClick={handleShare}
              className={`w-full py-3 rounded-md text-sm font-medium transition-all ${
                shared
                  ? "bg-accent/10 text-accent border border-accent/30"
                  : "bg-accent text-white hover:bg-accent-hover active:scale-[0.99]"
              }`}
            >
              {shared
                ? "Copied ✓"
                : (typeof navigator !== "undefined" && (navigator as Navigator & { share?: unknown }).share && window.isSecureContext)
                  ? "Share streak"
                  : "Copy to clipboard"}
            </button>
          </div>
        )}
        </div>{/* right column */}
        </div>{/* dashboard grid */}
      </div>
    </div>
  );
}
