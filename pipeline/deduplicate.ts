import { supabase } from "@/lib/db/supabase";
import type { RawArticle } from "@/types/pipeline";

// Strips tracking query params that cause the same article to appear as different URLs.
// e.g. ?utm_source=twitter&utm_medium=social gets dropped.
function normalizeUrl(url: string): string {
  try {
    const parsed = new URL(url);
    const TRACKING_PARAMS = [
      "utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content",
      "ref", "referrer", "fbclid", "gclid", "mc_cid", "mc_eid",
    ];
    for (const param of TRACKING_PARAMS) {
      parsed.searchParams.delete(param);
    }
    return parsed.toString().toLowerCase();
  } catch {
    // If URL parsing fails, just lowercase the original
    return url.toLowerCase();
  }
}

// Filters out articles already stored in the pins table.
// Uses a batch query rather than N individual queries.
export async function deduplicate(articles: RawArticle[]): Promise<RawArticle[]> {
  if (articles.length === 0) return [];

  // Normalize all incoming URLs
  const normalized = articles.map((a) => ({
    article: a,
    normalizedUrl: normalizeUrl(a.sourceUrl),
  }));

  const incomingUrls = normalized.map((n) => n.normalizedUrl);

  // Check which of these URLs already exist in the DB
  const { data: existing, error } = await supabase
    .from("pins")
    .select("source_url")
    .in("source_url", incomingUrls);

  if (error) {
    // If the check fails, log and return all articles rather than dropping them —
    // the upsert with ON CONFLICT will handle true duplicates at write time.
    console.error("[deduplicate] Supabase query failed — skipping dedup check:", error.message);
    return articles;
  }

  const existingUrls = new Set((existing ?? []).map((row) => row.source_url.toLowerCase()));

  const fresh = normalized.filter((n) => !existingUrls.has(n.normalizedUrl));

  console.log(
    `[deduplicate] ${articles.length} fetched → ${fresh.length} new (${articles.length - fresh.length} already in DB)`
  );

  // Return the original articles (with original URLs) for the fresh ones only
  return fresh.map((n) => ({
    ...n.article,
    sourceUrl: n.normalizedUrl, // store the cleaned URL so future dedup matches
  }));
}
