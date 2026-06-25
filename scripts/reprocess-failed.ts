// Re-runs AI summarization on pins where ai_processed = false.
// Run after any pipeline that had partial AI failures.
// Usage: npx tsx --env-file=.env.local scripts/reprocess-failed.ts
import { supabase } from "../lib/db/supabase-service";
import { summarizeArticle } from "../lib/ai/summarize";

const BATCH_SIZE = 3; // conservative to avoid rate limits

async function main() {
  const { data: pins, error } = await supabase
    .from("pins")
    .select("id, headline, raw_body")
    .eq("ai_processed", false)
    .not("raw_body", "is", null);

  if (error) throw new Error(`Failed to fetch unprocessed pins: ${error.message}`);
  if (!pins || pins.length === 0) {
    console.log("No unprocessed pins found.");
    return;
  }

  console.log(`Found ${pins.length} pins to reprocess`);
  let fixed = 0;

  for (let i = 0; i < pins.length; i += BATCH_SIZE) {
    const batch = pins.slice(i, i + BATCH_SIZE);

    await Promise.all(batch.map(async (pin: { id: string; headline: string; raw_body: string | null }) => {
      const summary = await summarizeArticle(pin.headline, pin.raw_body ?? "");
      const aiProcessed = !!summary.stat1;

      const { error: updateError } = await supabase
        .from("pins")
        .update({
          summary: summary.summary,
          stat_1: summary.stat1,
          stat_2: summary.stat2,
          stat_3: summary.stat3,
          topic: summary.topic,
          ai_processed: aiProcessed,
        })
        .eq("id", pin.id);

      if (updateError) {
        console.error(`Failed to update pin ${pin.id}: ${updateError.message}`);
      } else if (aiProcessed) {
        fixed++;
        console.log(`  ✓ ${pin.headline.slice(0, 70)}`);
      }
    }));

    // Small pause between batches to be gentle on the API
    if (i + BATCH_SIZE < pins.length) {
      await new Promise((r) => setTimeout(r, 1000));
    }
  }

  console.log(`\nDone — ${fixed}/${pins.length} pins now AI processed`);
}

main().catch((err) => { console.error(err); process.exit(1); });
