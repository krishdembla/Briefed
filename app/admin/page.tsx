import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/db/supabase-server";
import { supabase as adminSupabase } from "@/lib/db/supabase-service";

// ── Types ────────────────────────────────────────────────────────────────────

type TopicBar = { topic: string; count: number; pct: number };
type RegionBar = { label: string; count: number; pct: number };

type PipelineRun = {
  id: string;
  started_at: string;
  finished_at: string | null;
  status: "running" | "success" | "error";
  error_msg: string | null;
  pins_fetched: number;
  pins_stored: number;
  pins_ai_done: number;
};

// ── Helpers ──────────────────────────────────────────────────────────────────

function duration(start: string, end: string | null): string {
  if (!end) return "running…";
  const ms = new Date(end).getTime() - new Date(start).getTime();
  const s = Math.round(ms / 1000);
  return s < 60 ? `${s}s` : `${Math.floor(s / 60)}m ${s % 60}s`;
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleString("en-GB", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

const TOPIC_COLORS_ADMIN: Record<string, string> = {
  politics: "#3b82f6", economy: "#22c55e", conflict: "#ef4444",
  health: "#ec4899", climate: "#14b8a6", tech: "#a855f7", other: "#94a3b8",
};
const TOPIC_LABELS_ADMIN: Record<string, string> = {
  politics: "Politics", economy: "Economy", conflict: "Conflict",
  health: "Health", climate: "Climate", tech: "Tech", other: "Other",
};

const STATUS_STYLES: Record<string, string> = {
  success: "bg-emerald-500/15 text-emerald-400",
  error:   "bg-red-500/15 text-red-400",
  running: "bg-yellow-500/15 text-yellow-400",
};

// ── Page ─────────────────────────────────────────────────────────────────────

export default async function AdminPage() {
  // Verify the current user is the admin
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  const adminEmail = process.env.ADMIN_EMAIL;
  if (!user || !adminEmail || user.email !== adminEmail) {
    redirect("/");
  }

  const today = new Date().toISOString().slice(0, 10);
  const since24h = new Date(Date.now() - 24 * 3600 * 1000).toISOString();

  // Parallel data fetch
  const [runsResult, checkinsResult, usersResult, prefsResult, recentPinsResult, threadCountResult] = await Promise.all([
    adminSupabase
      .from("pipeline_runs")
      .select("*")
      .order("started_at", { ascending: false })
      .limit(15),

    adminSupabase
      .from("checkins")
      .select("*", { count: "exact", head: true })
      .eq("date", today),

    adminSupabase.auth.admin.listUsers(),

    adminSupabase
      .from("user_preferences")
      .select("user_id", { count: "exact", head: true }),

    adminSupabase
      .from("pins")
      .select("topic, region_label")
      .gte("published_at", since24h),

    adminSupabase
      .from("pin_relations")
      .select("*", { count: "exact", head: true }),
  ]);

  const runs: PipelineRun[] = runsResult.data ?? [];
  const checkinsToday = checkinsResult.count ?? 0;
  const totalUsers = usersResult.data?.users?.length ?? 0;
  const onboardedUsers = prefsResult.count ?? 0;
  const threadCount = threadCountResult.count ?? 0;

  // Compute topic + region distributions from last 24h pins
  const recentPins = recentPinsResult.data ?? [];
  const topicRaw: Record<string, number> = {};
  const regionRaw: Record<string, number> = {};
  for (const pin of recentPins) {
    const t = (pin.topic as string) ?? "other";
    topicRaw[t] = (topicRaw[t] ?? 0) + 1;
    if (pin.region_label) {
      regionRaw[pin.region_label as string] = (regionRaw[pin.region_label as string] ?? 0) + 1;
    }
  }
  const topicMax = Math.max(1, ...Object.values(topicRaw));
  const topicBars: TopicBar[] = Object.entries(topicRaw)
    .sort((a, b) => b[1] - a[1])
    .map(([topic, count]) => ({ topic, count, pct: Math.round((count / topicMax) * 100) }));
  const regionMax = Math.max(1, ...Object.values(regionRaw));
  const regionBars: RegionBar[] = Object.entries(regionRaw)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([label, count]) => ({ label, count, pct: Math.round((count / regionMax) * 100) }));

  const lastRun = runs[0] ?? null;
  const successRate = runs.length
    ? Math.round((runs.filter((r) => r.status === "success").length / runs.length) * 100)
    : 0;

  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      <div className="max-w-4xl mx-auto px-6 py-10">

        {/* Header */}
        <div className="mb-10">
          <h1 className="text-2xl font-bold tracking-tight">Admin</h1>
          <p className="text-zinc-500 text-sm mt-1">Briefed internal dashboard</p>
        </div>

        {/* Stat cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
          <StatCard label="Total users" value={totalUsers} />
          <StatCard label="Onboarded" value={onboardedUsers} note={`${totalUsers ? Math.round((onboardedUsers / totalUsers) * 100) : 0}%`} />
          <StatCard label="Check-ins today" value={checkinsToday} />
          <StatCard label="Pipeline success" value={`${successRate}%`} note={`last ${runs.length} runs`} />
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-10">
          <StatCard label="Pins (24h)" value={recentPins.length} />
          <StatCard label="Story threads" value={threadCount} />
          <StatCard label="Topics covered" value={topicBars.length} note="last 24h" />
          <StatCard label="Regions" value={regionBars.length} note="last 24h" />
        </div>

        {/* Last run summary */}
        {lastRun && (
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 mb-6">
            <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-3">Last pipeline run</p>
            <div className="flex flex-wrap gap-6">
              <Metric label="Status">
                <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${STATUS_STYLES[lastRun.status]}`}>
                  {lastRun.status}
                </span>
              </Metric>
              <Metric label="Started">{formatTime(lastRun.started_at)}</Metric>
              <Metric label="Duration">{duration(lastRun.started_at, lastRun.finished_at)}</Metric>
              <Metric label="Fetched">{lastRun.pins_fetched}</Metric>
              <Metric label="Stored">{lastRun.pins_stored}</Metric>
              <Metric label="AI done">{lastRun.pins_ai_done}</Metric>
            </div>
            {lastRun.error_msg && (
              <p className="mt-3 text-xs text-red-400 bg-red-500/10 rounded-xl px-3 py-2 font-mono break-all">
                {lastRun.error_msg}
              </p>
            )}
          </div>
        )}

        {/* Distribution charts */}
        {(topicBars.length > 0 || regionBars.length > 0) && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
            {topicBars.length > 0 && (
              <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5">
                <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-4">Topic mix (24h)</p>
                <div className="flex flex-col gap-2.5">
                  {topicBars.map(({ topic, count, pct }) => (
                    <div key={topic} className="flex items-center gap-3">
                      <span className="text-xs text-zinc-400 w-16 shrink-0">
                        {TOPIC_LABELS_ADMIN[topic] ?? topic}
                      </span>
                      <div className="flex-1 bg-zinc-800 rounded-full h-2 overflow-hidden">
                        <div
                          className="h-full rounded-full"
                          style={{
                            width: `${pct}%`,
                            backgroundColor: TOPIC_COLORS_ADMIN[topic] ?? "#94a3b8",
                          }}
                        />
                      </div>
                      <span className="text-xs text-zinc-500 w-6 text-right shrink-0">{count}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {regionBars.length > 0 && (
              <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5">
                <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-4">Top regions (24h)</p>
                <div className="flex flex-col gap-2.5">
                  {regionBars.map(({ label, count, pct }) => (
                    <div key={label} className="flex items-center gap-3">
                      <span className="text-xs text-zinc-400 w-20 shrink-0 truncate" title={label}>
                        {label}
                      </span>
                      <div className="flex-1 bg-zinc-800 rounded-full h-2 overflow-hidden">
                        <div
                          className="h-full rounded-full bg-indigo-500"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <span className="text-xs text-zinc-500 w-6 text-right shrink-0">{count}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Pipeline run history */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden">
          <div className="px-5 py-4 border-b border-zinc-800">
            <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Pipeline history</p>
          </div>
          <div className="divide-y divide-zinc-800">
            {runs.length === 0 && (
              <p className="px-5 py-4 text-sm text-zinc-600">No runs yet.</p>
            )}
            {runs.map((run) => (
              <div key={run.id} className="px-5 py-3 flex items-center gap-4 text-sm">
                <span className={`shrink-0 text-xs font-semibold px-2 py-0.5 rounded-full ${STATUS_STYLES[run.status]}`}>
                  {run.status}
                </span>
                <span className="text-zinc-300 min-w-0">{formatTime(run.started_at)}</span>
                <span className="text-zinc-600 text-xs">{duration(run.started_at, run.finished_at)}</span>
                <span className="text-zinc-600 text-xs ml-auto">
                  {run.pins_stored} stored · {run.pins_ai_done} AI
                </span>
              </div>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function StatCard({ label, value, note }: { label: string; value: string | number; note?: string }) {
  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-2xl px-4 py-4">
      <p className="text-xs text-zinc-500 mb-1">{label}</p>
      <p className="text-2xl font-bold text-white">{value}</p>
      {note && <p className="text-xs text-zinc-600 mt-0.5">{note}</p>}
    </div>
  );
}

function Metric({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs text-zinc-500 mb-1">{label}</p>
      <div className="text-sm font-medium text-white">{children}</div>
    </div>
  );
}
