import { supabase } from "../lib/db/supabase";

async function main() {
  // Latest pipeline run
  const { data: runs } = await supabase
    .from("pipeline_runs")
    .select("*")
    .order("started_at", { ascending: false })
    .limit(3);

  console.log("\n=== PIPELINE RUNS ===");
  for (const run of runs ?? []) {
    const duration = run.finished_at
      ? `${Math.round((new Date(run.finished_at).getTime() - new Date(run.started_at).getTime()) / 1000)}s`
      : "still running";
    console.log(`[${run.status.toUpperCase()}] ${run.id.slice(0, 8)} | ${duration} | fetched: ${run.pins_fetched} | stored: ${run.pins_stored} | AI done: ${run.pins_ai_done}`);
    if (run.error_msg) console.log(`  errors: ${run.error_msg}`);
  }

  // Overall pin counts
  const { count: total } = await supabase.from("pins").select("*", { count: "exact", head: true });
  const { count: aiDone } = await supabase.from("pins").select("*", { count: "exact", head: true }).eq("ai_processed", true);
  const { count: geoDone } = await supabase.from("pins").select("*", { count: "exact", head: true }).eq("geo_processed", true);

  console.log(`\n=== PINS TABLE ===`);
  console.log(`Total pins:    ${total}`);
  console.log(`AI processed:  ${aiDone}`);
  console.log(`Geo processed: ${geoDone}`);

  // Topic breakdown
  const { data: pins } = await supabase.from("pins").select("topic");
  const topicCounts: Record<string, number> = {};
  for (const pin of pins ?? []) {
    const t = pin.topic ?? "null";
    topicCounts[t] = (topicCounts[t] ?? 0) + 1;
  }
  console.log("\n=== BY TOPIC ===");
  for (const [topic, count] of Object.entries(topicCounts).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${topic.padEnd(12)} ${count}`);
  }

  // Sample 3 pins
  const { data: sample } = await supabase
    .from("pins")
    .select("headline, source_name, topic, lat, lng, stat_1, summary")
    .eq("ai_processed", true)
    .limit(3);

  console.log("\n=== SAMPLE PINS ===");
  for (const pin of sample ?? []) {
    console.log(`\n  [${pin.source_name}] [${pin.topic}] ${pin.headline.slice(0, 80)}`);
    console.log(`  stat: ${pin.stat_1}`);
    console.log(`  summary: ${pin.summary?.slice(0, 120)}...`);
    console.log(`  geo: ${pin.lat ? `${pin.lat.toFixed(2)}, ${pin.lng?.toFixed(2)}` : "no location"}`);
  }
}

main().catch((err) => { console.error(err); process.exit(1); });
