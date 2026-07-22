// One-off: classifies market impact for existing pins that don't yet have a
// market_classified_at timestamp. Runs the same pre-filter + LLM pipeline as
// the ingestion pass, so results match what future runs produce.
//
// Usage:
//   npx tsx --env-file=.env.local scripts/backfill-tickers.ts                 # dry run, all pins
//   npx tsx --env-file=.env.local scripts/backfill-tickers.ts --run           # writes DB
//   npx tsx --env-file=.env.local scripts/backfill-tickers.ts --run --limit 50   # only first 50

import { supabase } from "../lib/db/supabase-service";
import { classifyMarket } from "../lib/ai/classifyMarket";
import { hasMarketKeyword } from "../lib/data/marketKeywords";

const DRY_RUN = !process.argv.includes("--run");
const LIMIT_ARG = process.argv.indexOf("--limit");
const LIMIT = LIMIT_ARG !== -1 ? parseInt(process.argv[LIMIT_ARG + 1] ?? "0", 10) : 0;
const BATCH_SIZE = 20;
const BATCH_DELAY_MS = 200;

interface PinRow {
  id: string;
  headline: string;
  summary: string | null;
  raw_body: string | null;
  topic: string | null;
}

async function main() {
  console.log(`[backfill-tickers] Mode: ${DRY_RUN ? "DRY RUN" : "WRITE"}${LIMIT > 0 ? ` — limit ${LIMIT}` : ""}`);

  let query = supabase
    .from("pins")
    .select("id, headline, summary, raw_body, topic")
    .is("market_classified_at", null)
    .eq("ai_processed", true)
    .order("published_at", { ascending: false });

  if (LIMIT > 0) query = query.limit(LIMIT);

  const { data, error } = await query;
  if (error) {
    console.error("[backfill-tickers] fetch failed:", error.message);
    process.exit(1);
  }

  const pins = (data ?? []) as PinRow[];
  console.log(`[backfill-tickers] ${pins.length} pins to classify`);

  if (pins.length === 0) {
    console.log("[backfill-tickers] Nothing to do.");
    return;
  }

  const counters = { skipped: 0, none: 0, low: 0, medium: 0, high: 0, failed: 0 };

  for (let i = 0; i < pins.length; i += BATCH_SIZE) {
    const batch = pins.slice(i, i + BATCH_SIZE);

    const results = await Promise.allSettled(
      batch.map(async (pin) => {
        const summaryText = pin.summary ?? pin.raw_body?.slice(0, 500) ?? "";
        const shouldClassify =
          pin.topic === "economy" ||
          pin.topic === "tech" ||
          hasMarketKeyword(`${pin.headline} ${summaryText}`);

        if (!shouldClassify) {
          counters.skipped++;
          return {
            pin,
            market_relevance: "none" as const,
            tickers: [] as string[],
          };
        }

        const result = await classifyMarket(pin.headline, summaryText);
        counters[result.market_relevance]++;
        return {
          pin,
          market_relevance: result.market_relevance,
          tickers: result.tickers,
        };
      })
    );

    if (!DRY_RUN) {
      for (const r of results) {
        if (r.status !== "fulfilled") {
          counters.failed++;
          console.error("[backfill-tickers] classify failed:", r.reason);
          continue;
        }
        const { pin, market_relevance, tickers } = r.value;
        const { error: updErr } = await supabase
          .from("pins")
          .update({
            tickers,
            market_relevance,
            market_classified_at: new Date().toISOString(),
          })
          .eq("id", pin.id);
        if (updErr) {
          counters.failed++;
          console.error(`[backfill-tickers] update failed for ${pin.id}:`, updErr.message);
        }
      }
    } else {
      for (const r of results) {
        if (r.status !== "fulfilled") {
          counters.failed++;
          console.error("[backfill-tickers] classify failed:", r.reason);
          continue;
        }
        const { pin, market_relevance, tickers } = r.value;
        console.log(
          `  ${market_relevance.padEnd(6)} ${tickers.join(",").padEnd(20)} | ${pin.headline.slice(0, 70)}`
        );
      }
    }

    console.log(
      `[backfill-tickers] batch ${Math.floor(i / BATCH_SIZE) + 1} done — ${Math.min(i + BATCH_SIZE, pins.length)}/${pins.length}`
    );

    if (i + BATCH_SIZE < pins.length) {
      await new Promise((r) => setTimeout(r, BATCH_DELAY_MS));
    }
  }

  console.log("\n[backfill-tickers] Summary:");
  console.log(`  skipped (pre-filter): ${counters.skipped}`);
  console.log(`  none:                 ${counters.none}`);
  console.log(`  low:                  ${counters.low}`);
  console.log(`  medium:               ${counters.medium}`);
  console.log(`  high:                 ${counters.high}`);
  console.log(`  failed:               ${counters.failed}`);
  if (DRY_RUN) console.log("\n(Dry run — no writes. Re-run with --run to persist.)");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
