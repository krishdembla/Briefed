import { supabase } from "@/lib/db/supabase-service";
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

  // Supabase's .in() has a query size limit — batch into chunks of 100
  const CHUNK_SIZE = 100;
  const existingUrls = new Set<string>();

  for (let i = 0; i < incomingUrls.length; i += CHUNK_SIZE) {
    const chunk = incomingUrls.slice(i, i + CHUNK_SIZE);
    const { data, error } = await supabase
      .from("pins")
      .select("source_url")
      .in("source_url", chunk);

    if (error) {
      console.error("[deduplicate] Supabase query failed — skipping dedup check:", error.message);
      return articles; // fallback: let upsert handle conflicts
    }

    for (const row of data ?? []) {
      existingUrls.add(row.source_url.toLowerCase());
    }
  }

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
