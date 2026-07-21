// One-off: re-runs processArticle() over pins created today that ended up with
// ai_processed=false and lat=null (the fac893a-on-Vercel + gpt-oss failure mode).
// Runs locally against the current codebase, so it uses the fixed callLLM
// (reasoning_effort=low, include_reasoning=false) regardless of what Vercel is
// running. Only touches pins created on/after the UTC start of today.
//
// Usage:
//   npx tsx --env-file=.env.local scripts/backfill-today.ts        # dry run
//   npx tsx --env-file=.env.local scripts/backfill-today.ts --run  # writes DB

import { supabase } from "../lib/db/supabase-service";
import { processArticle } from "../lib/ai/processArticle";
import { resolveArticleImage } from "../lib/images/resolve";

const DRY_RUN = !process.argv.includes("--run");
const BATCH_SIZE = 20;
const BATCH_DELAY_MS = 200;

interface BrokenPin {
  id: string;
  headline: string;
  raw_body: string | null;
  source_url: string;
  og_image_url: string | null;
}

async function main() {
  // Start of today UTC — matches the pipeline's daily cadence (5am UTC cron).
  const now = new Date();
  const startOfToday = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())).toISOString();
  console.log(`Backfill window: created_at >= ${startOfToday}`);
  console.log(`Mode: ${DRY_RUN ? "DRY RUN" : "WRITE"}`);

  const { data: pins, error } = await supabase
    .from("pins")
    .select("id, headline, raw_body, source_url, og_image_url")
    .gte("created_at", startOfToday)
    .eq("ai_processed", false)
    .not("raw_body", "is", null);

  if (error) throw new Error(`Fetch failed: ${error.message}`);
  if (!pins || pins.length === 0) {
    console.log("No pins to backfill.");
    return;
  }

  console.log(`Found ${pins.length} pins to reprocess\n`);

  let aiSucceeded = 0;
  let geoSucceeded = 0;
  let updateFailed = 0;
  const failedIds: string[] = [];

  for (let i = 0; i < pins.length; i += BATCH_SIZE) {
    const batch = pins.slice(i, i + BATCH_SIZE) as BrokenPin[];

    const results = await Promise.allSettled(
      batch.map(async (pin) => {
        const [{ summary, location }, ogImageUrl] = await Promise.all([
          processArticle(pin.headline, pin.raw_body ?? ""),
          resolveArticleImage({
            sourceUrl: pin.source_url,
            ogImageUrl: pin.og_image_url ?? undefined,
          }).catch(() => pin.og_image_url),
        ]);

        const aiProcessed = !!(summary?.summary && summary.summary !== pin.headline);
        const geoProcessed = !!location?.lat;

        return {
          id: pin.id,
          headline: pin.headline,
          patch: {
            summary: summary.summary,
            stat_1: summary.stat1 || null,
            stat_2: summary.stat2 || null,
            stat_3: summary.stat3 || null,
            why_it_matters: summary.why_it_matters || null,
            og_image_url: ogImageUrl,
            lat: location?.lat ?? null,
            lng: location?.lng ?? null,
            country_code: location?.countryCode || null,
            region_label: location?.regionLabel || null,
            topic: summary.topic,
            tags: summary.tags ?? [],
            ai_processed: aiProcessed,
            geo_processed: geoProcessed,
          },
          aiProcessed,
          geoProcessed,
        };
      })
    );

    for (const result of results) {
      if (result.status === "rejected") {
        console.error(`  ✗ processArticle threw: ${result.reason}`);
        updateFailed++;
        continue;
      }
      const { id, headline, patch, aiProcessed, geoProcessed } = result.value;

      if (aiProcessed) aiSucceeded++;
      if (geoProcessed) geoSucceeded++;

      const status = `ai=${aiProcessed ? "✓" : "✗"} geo=${geoProcessed ? "✓" : "✗"}`;
      const geoLabel = patch.lat != null ? `${patch.lat.toFixed(2)},${patch.lng?.toFixed(2)}` : "no-loc";
      console.log(`  ${status} [${patch.topic}] ${geoLabel} | ${headline.slice(0, 65)}`);

      if (!DRY_RUN) {
        const { error: updateError } = await supabase
          .from("pins")
          .update(patch)
          .eq("id", id);
        if (updateError) {
          console.error(`    ↳ DB update failed: ${updateError.message}`);
          updateFailed++;
          failedIds.push(id);
        }
      }
    }

    const batchNum = Math.floor(i / BATCH_SIZE) + 1;
    const totalBatches = Math.ceil(pins.length / BATCH_SIZE);
    console.log(`[batch ${batchNum}/${totalBatches}] processed ${Math.min(i + BATCH_SIZE, pins.length)}/${pins.length}\n`);

    if (i + BATCH_SIZE < pins.length) {
      await new Promise((r) => setTimeout(r, BATCH_DELAY_MS));
    }
  }

  console.log("=== Summary ===");
  console.log(`Total pins:         ${pins.length}`);
  console.log(`AI enriched:        ${aiSucceeded}`);
  console.log(`Geo tagged:         ${geoSucceeded}`);
  console.log(`Update failed:      ${updateFailed}`);
  if (failedIds.length > 0) console.log(`Failed pin IDs:     ${failedIds.join(", ")}`);
  if (DRY_RUN) console.log("\n(dry run — no DB writes. Re-run with --run to persist.)");
}

main().catch((err) => { console.error(err); process.exit(1); });
