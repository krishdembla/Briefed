import { supabase } from "../lib/db/supabase-service";

// Diagnoses the reported ASML duplicate — same story, two pins, different topics.
// Also samples other same-headline duplicates so we know if this is a one-off or
// a recurring failure mode of clusterByEvent.

async function main() {
  // (1) The specific reported case
  console.log("=== ASML pins in the DB ===");
  const { data: asmlPins, error: asmlErr } = await supabase
    .from("pins")
    .select("id, headline, source_url, source_name, topic, tags, published_at, created_at, pipeline_run_id")
    .or("headline.ilike.%ASML%,headline.ilike.%AI chip boom%,headline.ilike.%trillion-dollar%")
    .order("created_at", { ascending: false })
    .limit(20);

  if (asmlErr) {
    console.error("asml query error:", asmlErr.message);
  } else if (!asmlPins?.length) {
    console.log("No ASML pins found.");
  } else {
    for (const p of asmlPins) {
      console.log(
        `\n  id=${(p.id as string).slice(0, 8)} topic=${String(p.topic).padEnd(8)} run=${(p.pipeline_run_id as string ?? "").slice(0, 8)}`
      );
      console.log(`    headline : ${p.headline}`);
      console.log(`    source   : ${p.source_name} — ${p.source_url}`);
      console.log(`    tags     : ${JSON.stringify(p.tags)}`);
      console.log(`    pub/crea : ${(p.published_at as string).slice(0, 16)}  /  ${(p.created_at as string).slice(0, 16)}`);
    }
  }

  // (2) Broader look: how many other same-headline duplicates exist across the DB?
  // Fetch recent pins and bucket by exact-normalized headline.
  console.log("\n\n=== SAME-HEADLINE DUPLICATES (last 7 days) ===");
  const since = new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString();
  const { data: recent, error: recentErr } = await supabase
    .from("pins")
    .select("id, headline, topic, source_name, source_url, pipeline_run_id, created_at")
    .gte("created_at", since);

  if (recentErr) {
    console.error("recent query error:", recentErr.message);
    return;
  }

  const norm = (h: string) =>
    h
      .toLowerCase()
      .replace(/^(analysis|explainer|opinion|update|breaking|factbox)\s*:\s*/i, "")
      .replace(/\s+-\s+(reuters|ap|afp|bloomberg|cnn|bbc|nyt).*$/i, "")
      .replace(/[^\w\s]/g, "")
      .replace(/\s+/g, " ")
      .trim();

  const byHeadline: Record<string, typeof recent> = {};
  for (const p of recent ?? []) {
    const key = norm(p.headline as string);
    (byHeadline[key] ||= [] as unknown as typeof recent)!.push(p);
  }

  const dupes = Object.entries(byHeadline)
    .filter(([, rows]) => (rows?.length ?? 0) > 1)
    .sort((a, b) => (b[1]?.length ?? 0) - (a[1]?.length ?? 0));

  console.log(`Total headline clusters with >1 pin: ${dupes.length}`);
  console.log(`Total pins involved: ${dupes.reduce((s, [, rows]) => s + (rows?.length ?? 0), 0)}`);

  for (const [key, rows] of dupes.slice(0, 15)) {
    console.log(`\n  "${key.slice(0, 80)}" — ${rows?.length} pins`);
    for (const p of rows ?? []) {
      console.log(
        `    · topic=${String(p.topic).padEnd(8)} run=${(p.pipeline_run_id as string ?? "").slice(0, 8)}  ${p.source_name} — ${(p.source_url as string).slice(0, 70)}`
      );
    }
  }

  // (3) Topic split within duplicate clusters
  const crossTopicClusters = dupes.filter(([, rows]) => {
    const topics = new Set((rows ?? []).map((r) => r.topic as string));
    return topics.size > 1;
  });
  console.log(`\n\n=== CROSS-TOPIC DUPLICATE CLUSTERS ===`);
  console.log(`${crossTopicClusters.length} of ${dupes.length} duplicate clusters have pins in DIFFERENT topics.`);
  for (const [key, rows] of crossTopicClusters.slice(0, 10)) {
    const topics = [...new Set((rows ?? []).map((r) => r.topic as string))];
    console.log(`  ${topics.join(" + ").padEnd(24)} "${key.slice(0, 80)}"`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
