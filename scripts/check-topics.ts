import { supabase } from "../lib/db/supabase";

async function main() {
  const topics = ["tech", "climate", "health", "politics", "economy", "conflict"];

  console.log("\n=== GEO COVERAGE BY TOPIC ===");
  for (const topic of topics) {
    const { count: total } = await supabase
      .from("pins").select("*", { count: "exact", head: true }).eq("topic", topic);
    const { count: geoCount } = await supabase
      .from("pins").select("*", { count: "exact", head: true })
      .eq("topic", topic).not("lat", "is", null);

    const pct = total ? Math.round(((geoCount ?? 0) / total) * 100) : 0;
    console.log(`  ${topic.padEnd(10)} ${geoCount}/${total} have coordinates (${pct}%)`);
  }

  console.log("\n=== RECENT TECH PINS ===");
  const { data } = await supabase
    .from("pins").select("headline, lat, lng")
    .eq("topic", "tech")
    .order("created_at", { ascending: false })
    .limit(8);

  for (const p of data ?? []) {
    console.log(`  ${p.lat ? "✓" : "✗"} ${p.headline.slice(0, 80)}`);
  }
}

main().catch((err) => { console.error(err); process.exit(1); });
