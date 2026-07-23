import { supabase } from "../lib/db/supabase-service";

// Diagnoses why the "Today" feed count varies so much day-to-day.
// Compares three things per recent day:
//   (a) pipeline_runs stats           — how many pins were fetched/stored/AI-processed
//   (b) pins created that day         — how many rows landed in the DB (created_at)
//   (c) pins visible to "Today" filter — those with published_at ≥ now-36h AND lat/lng NOT NULL
// The delta between (b) and (c) is the smoking gun: it means articles are being
// stored with stale published_at timestamps, or being dropped by the map's geo filter.

const DAYS = 10;

async function main() {
  const now = Date.now();
  const since = new Date(now - DAYS * 24 * 3600 * 1000).toISOString();

  // (a) Recent pipeline runs
  const { data: runs } = await supabase
    .from("pipeline_runs")
    .select("id, status, started_at, finished_at, pins_fetched, pins_stored, pins_ai_done, error_msg")
    .gte("started_at", since)
    .order("started_at", { ascending: false });

  console.log(`\n=== PIPELINE RUNS (last ${DAYS} days) ===`);
  console.log("started              status   fetched  stored  ai_done  duration");
  for (const run of runs ?? []) {
    const started = new Date(run.started_at);
    const dur = run.finished_at
      ? `${Math.round((new Date(run.finished_at).getTime() - started.getTime()) / 1000)}s`
      : "running";
    console.log(
      `${started.toISOString().slice(0, 16).replace("T", " ")}  ${run.status.padEnd(8)}${String(run.pins_fetched ?? "-").padStart(6)}  ${String(run.pins_stored ?? "-").padStart(6)}  ${String(run.pins_ai_done ?? "-").padStart(7)}  ${dur}`
    );
    if (run.error_msg) console.log(`   ↳ ${run.error_msg.slice(0, 180)}`);
  }

  // (b) & (c) Pins grouped by day. We fetch and bucket in JS because
  // Supabase's PostgREST doesn't do server-side date grouping.
  const { data: pins } = await supabase
    .from("pins")
    .select("id, created_at, published_at, lat, lng, ai_processed, topic")
    .gte("created_at", since);

  const buckets: Record<
    string,
    {
      created: number;
      published_same_day: number;
      published_older: number;
      geo_ok: number;
      geo_missing: number;
      ai_ok: number;
    }
  > = {};

  for (const p of pins ?? []) {
    const createdDay = (p.created_at as string).slice(0, 10);
    const publishedDay = (p.published_at as string | null)?.slice(0, 10) ?? null;
    const b = (buckets[createdDay] ||= {
      created: 0,
      published_same_day: 0,
      published_older: 0,
      geo_ok: 0,
      geo_missing: 0,
      ai_ok: 0,
    });
    b.created++;
    if (publishedDay === createdDay) b.published_same_day++;
    else b.published_older++;
    if (p.lat != null && p.lng != null) b.geo_ok++;
    else b.geo_missing++;
    if (p.ai_processed) b.ai_ok++;
  }

  console.log(`\n=== PINS PER CREATED-AT DAY ===`);
  console.log("day         created  same-day-pub  older-pub  geo_ok  geo_missing  ai_ok");
  for (const day of Object.keys(buckets).sort().reverse()) {
    const b = buckets[day];
    console.log(
      `${day}   ${String(b.created).padStart(6)}   ${String(b.published_same_day).padStart(10)}   ${String(b.published_older).padStart(8)}   ${String(b.geo_ok).padStart(5)}   ${String(b.geo_missing).padStart(10)}   ${String(b.ai_ok).padStart(4)}`
    );
  }

  // (c) What the map "Today" filter (36h + geo) actually sees right now
  const cutoff36h = new Date(now - 36 * 3600 * 1000).toISOString();
  const { count: todayVisible } = await supabase
    .from("pins")
    .select("*", { count: "exact", head: true })
    .not("lat", "is", null)
    .not("lng", "is", null)
    .not("headline", "is", null)
    .gte("published_at", cutoff36h);

  // Compare: how many pins have created_at in the last 36h? (i.e. what the pipeline
  // added recently, regardless of the source's published_at timestamp)
  const { count: createdRecently } = await supabase
    .from("pins")
    .select("*", { count: "exact", head: true })
    .gte("created_at", cutoff36h);

  const { count: createdRecentlyGeo } = await supabase
    .from("pins")
    .select("*", { count: "exact", head: true })
    .gte("created_at", cutoff36h)
    .not("lat", "is", null)
    .not("lng", "is", null);

  console.log(`\n=== "TODAY" WINDOW RIGHT NOW ===`);
  console.log(`Visible to map (published_at ≥ ${cutoff36h.slice(0, 16)} & geo):     ${todayVisible}`);
  console.log(`Actually created in last 36h:                                        ${createdRecently}`);
  console.log(`  ...of those, with geo:                                             ${createdRecentlyGeo}`);
  console.log(
    `\nGap between (created in last 36h) and (visible to map) = ${
      (createdRecently ?? 0) - (todayVisible ?? 0)
    } pins`
  );
  console.log(
    `That gap is caused by either: (a) source published_at is older than 36h, or (b) pin has no lat/lng.`
  );

  // Sample the pins that were created recently but AREN'T visible in "Today"
  const { data: hiddenSample } = await supabase
    .from("pins")
    .select("headline, source_name, published_at, created_at, lat, lng")
    .gte("created_at", cutoff36h)
    .lt("published_at", cutoff36h)
    .limit(10);

  if (hiddenSample && hiddenSample.length > 0) {
    console.log(`\n=== SAMPLE: recently ingested but published_at < 36h ago ===`);
    for (const p of hiddenSample) {
      const ageHours = Math.round(
        (now - new Date(p.published_at as string).getTime()) / 3600 / 1000
      );
      console.log(
        `  [${(p.source_name as string).padEnd(20)}] pub ${ageHours}h ago, geo=${
          p.lat != null ? "✓" : "✗"
        }  ${(p.headline as string).slice(0, 80)}`
      );
    }
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
