import { supabase } from "../lib/db/supabase";

async function main() {
  const { data } = await supabase
    .from("pins")
    .select("headline, published_at, lat, lng")
    .eq("topic", "climate")
    .order("published_at", { ascending: false });

  const cutoff = new Date(Date.now() - 48 * 3600 * 1000);

  console.log("\n=== CLIMATE PINS ===");
  for (const p of data ?? []) {
    const age = new Date(p.published_at);
    const inWindow = age > cutoff;
    console.log(`${inWindow ? "✓ in window" : "✗ too old  "} | ${p.published_at} | geo:${p.lat ? "✓" : "✗"} | ${p.headline.slice(0, 70)}`);
  }

  console.log(`\nCutoff: ${cutoff.toISOString()}`);
}

main().catch((err) => { console.error(err); process.exit(1); });
