// Re-runs geo-tagging on pins where geo_processed = false.
// Usage: npx tsx --env-file=.env.local scripts/reprocess-geo.ts
import { supabase } from "../lib/db/supabase-service";
import { geoTagArticle } from "../lib/ai/geoTag";

const BATCH_SIZE = 3;

async function main() {
  const { data: pins, error } = await supabase
    .from("pins")
    .select("id, headline, raw_body")
    .eq("geo_processed", false)
    .not("raw_body", "is", null);

  if (error) throw new Error(`Failed to fetch pins: ${error.message}`);
  if (!pins || pins.length === 0) {
    console.log("No un-geotagged pins found.");
    return;
  }

  console.log(`Found ${pins.length} pins to geo-tag`);
  let fixed = 0;

  for (let i = 0; i < pins.length; i += BATCH_SIZE) {
    const batch = pins.slice(i, i + BATCH_SIZE);

    await Promise.all(batch.map(async (pin: { id: string; headline: string; raw_body: string | null }) => {
      const geo = await geoTagArticle(pin.headline, pin.raw_body ?? "");
      if (!geo?.lat) return; // Claude returned null location — skip

      const { error: updateError } = await supabase
        .from("pins")
        .update({
          lat: geo.lat,
          lng: geo.lng,
          country_code: geo.countryCode,
          region_label: geo.regionLabel,
          geo_processed: true,
        })
        .eq("id", pin.id);

      if (updateError) {
        console.error(`Failed to update pin ${pin.id}: ${updateError.message}`);
      } else {
        fixed++;
        console.log(`  ✓ ${pin.headline.slice(0, 70)}`);
      }
    }));

    if (i + BATCH_SIZE < pins.length) {
      await new Promise((r) => setTimeout(r, 500));
    }
  }

  console.log(`\nDone — ${fixed}/${pins.length} pins now geo-tagged`);
}

main().catch((err) => { console.error(err); process.exit(1); });
