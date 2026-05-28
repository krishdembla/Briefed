"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/db/supabase-browser";

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

  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    supabase.auth.getUser().then(async ({ data }) => {
      const user = data.user;
      if (!user) { router.push("/auth"); return; }
      setEmail(user.email ?? null);

      const { data: rows, error } = await supabase
        .from("checkins")
        .select("date, pins_read")
        .eq("user_id", user.id)
        .order("date", { ascending: false })
        .limit(90);

      if (!error && rows) setCheckins(rows as CheckinRow[]);
      setLoading(false);
    });
  }, [router]);

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
    if (nav.share) {
      try {
        await nav.share({ title: "My Briefed streak", text });
        setShared(true);
      } catch { /* user cancelled */ }
    } else {
      await navigator.clipboard.writeText(text);
      setShared(true);
    }
    setTimeout(() => setShared(false), 2000);
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <div className="w-5 h-5 rounded-full border-2 border-zinc-700 border-t-white animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-white" style={{ paddingTop: "env(safe-area-inset-top, 0px)" }}>
      {/* Nav */}
      <div className="flex items-center gap-3 px-5 py-4 border-b border-zinc-900">
        <button
          onClick={() => router.push("/")}
          className="w-8 h-8 flex items-center justify-center rounded-full bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-white transition-colors"
          aria-label="Back to map"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <h1 className="text-sm font-semibold">Profile</h1>
      </div>

      <div className="max-w-md mx-auto px-5 py-6 space-y-6">
        {/* Identity */}
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-zinc-800 border border-zinc-700 flex items-center justify-center text-lg font-bold text-white shrink-0">
            {initial}
          </div>
          <div className="min-w-0">
            <p className="text-white font-semibold text-sm truncate">{email}</p>
            <p className="text-zinc-500 text-xs mt-0.5">Briefed member</p>
          </div>
        </div>

        {/* Stat cards */}
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl px-4 py-3 text-center">
            <p className="text-2xl font-bold text-orange-400">{stats.streak}</p>
            <p className="text-zinc-500 text-xs mt-1">Day streak</p>
          </div>
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl px-4 py-3 text-center">
            <p className="text-2xl font-bold text-white">{stats.total}</p>
            <p className="text-zinc-500 text-xs mt-1">Check-ins</p>
          </div>
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl px-4 py-3 text-center">
            <p className="text-2xl font-bold text-white">{stats.longest}</p>
            <p className="text-zinc-500 text-xs mt-1">Best streak</p>
          </div>
        </div>

        {/* Streak calendar */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4">
          <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-4">
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
                      className={`w-full aspect-square rounded-md transition-all ${
                        future
                          ? "bg-zinc-800/40"
                          : complete
                          ? "bg-orange-500"
                          : "bg-zinc-800"
                      } ${isToday ? "ring-1 ring-white/30" : ""}`}
                    />
                  );
                })}
              </div>
            ))}
          </div>
          <div className="flex items-center gap-2 mt-3">
            <div className="w-3 h-3 rounded-sm bg-zinc-800" />
            <span className="text-xs text-zinc-600">Missed</span>
            <div className="w-3 h-3 rounded-sm bg-orange-500 ml-2" />
            <span className="text-xs text-zinc-600">Complete</span>
          </div>
        </div>

        {/* Shareable streak card */}
        {stats.streak > 0 && (
          <div className="space-y-3">
            <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">
              Share your streak
            </p>

            {/* Card preview */}
            <div
              ref={shareCardRef}
              className="rounded-2xl bg-gradient-to-br from-zinc-900 to-zinc-950 border border-zinc-800 p-5 flex items-center justify-between gap-4"
            >
              <div>
                <div className="flex items-baseline gap-1.5 mb-1">
                  <span className="text-4xl font-black text-orange-400">{stats.streak}</span>
                  <span className="text-sm font-semibold text-orange-400">day{stats.streak !== 1 ? "s" : ""}</span>
                </div>
                <p className="text-white font-semibold text-sm">Reading streak</p>
                <p className="text-zinc-500 text-xs mt-0.5">on Briefed</p>
              </div>
              <div className="text-5xl select-none">🔥</div>
            </div>

            <button
              onClick={handleShare}
              className={`w-full py-3 rounded-xl text-sm font-semibold transition-all ${
                shared
                  ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                  : "bg-white text-zinc-900 hover:bg-zinc-100 active:scale-[0.98]"
              }`}
            >
              {shared ? "Shared ✓" : (navigator as Navigator & { share?: unknown }).share ? "Share streak" : "Copy to clipboard"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
