import { supabase } from "@/lib/db/supabase-service";
import { normalizeUrl } from "@/lib/normalizeUrl";
import { normalizeHeadline } from "@/lib/normalizeHeadline";
import type { RawArticle } from "@/types/pipeline";

// Prefer canonical wires over syndicators when collapsing duplicates: the
// syndicator strips styling, drops paywalls, and often mangles the URL, so
// keeping the original is nearly always the right call. Lower rank = kept
// first when we deduplicate a same-headline cluster.
const SOURCE_RANK: Record<string, number> = {
  reuters: 0,
  "reuters.com": 0,
  ap: 0,
  "associated press": 0,
  afp: 0,
  bloomberg: 0,
  bbc: 1,
  "bbc news": 1,
  cnn: 1,
  cnbc: 1,
  nyt: 1,
  "the new york times": 1,
  wsj: 1,
  "the wall street journal": 1,
  "the guardian": 1,
  ft: 1,
  "financial times": 1,
  // Known syndicators — kept only when nothing better is in the same cluster.
  "biztoc.com": 9,
  biztoc: 9,
  "slashdot.org": 9,
  slashdot: 9,
};

function sourceRank(name: string): number {
  const key = (name ?? "").toLowerCase().trim();
  return SOURCE_RANK[key] ?? 5;
}

// Filters out articles already stored in the pins table AND collapses
// near-duplicate headlines within the incoming batch to a single canonical
// article (preferring the source with the lowest SOURCE_RANK).
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
      // Normalize the DB URL the same way we normalize incoming URLs so that
      // old pins stored with tracking params still match their cleaned versions.
      existingUrls.add(normalizeUrl(row.source_url));
    }
  }

  const freshByUrl = normalized.filter((n) => !existingUrls.has(n.normalizedUrl));

  const urlDropped = normalized.length - freshByUrl.length;

  // Second pass: normalized-headline dedup against *both* the fresh batch and
  // recent DB rows. This catches wire-service reposts that URL dedup can't:
  //   - "Analysis:Foo" vs "Analysis-Foo"
  //   - Reuters original vs Biztoc/Slashdot syndication
  //   - Same headline reposted a few hours apart
  const RECENT_WINDOW_HOURS = 48;
  const recentSince = new Date(Date.now() - RECENT_WINDOW_HOURS * 3600 * 1000).toISOString();
  const existingHeadlines = new Set<string>();
  {
    const { data, error } = await supabase
      .from("pins")
      .select("headline")
      .gte("created_at", recentSince);
    if (error) {
      console.warn("[deduplicate] Recent-headline query failed — falling back to URL-only dedup:", error.message);
    } else {
      for (const row of data ?? []) {
        const norm = normalizeHeadline((row.headline as string) ?? "");
        if (norm) existingHeadlines.add(norm);
      }
    }
  }

  // Cluster the URL-fresh batch by normalized headline, keep the best per key.
  interface WithNorm {
    article: RawArticle;
    normalizedUrl: string;
    normalizedHeadline: string;
    rank: number;
  }

  const withNorm: WithNorm[] = freshByUrl.map((n) => ({
    article: n.article,
    normalizedUrl: n.normalizedUrl,
    normalizedHeadline: normalizeHeadline(n.article.headline),
    rank: sourceRank(n.article.sourceName),
  }));

  const bestByKey = new Map<string, WithNorm>();
  let batchDupDropped = 0;
  let dbHeadlineDropped = 0;

  for (const item of withNorm) {
    const key = item.normalizedHeadline;
    if (!key) {
      // Empty headline (should never happen) — keep it, let the LLM cluster
      // pass handle it downstream.
      bestByKey.set(`__empty__${item.normalizedUrl}`, item);
      continue;
    }

    // Already in DB with the same normalized headline — drop.
    if (existingHeadlines.has(key)) {
      dbHeadlineDropped++;
      continue;
    }

    const prev = bestByKey.get(key);
    if (!prev) {
      bestByKey.set(key, item);
    } else if (item.rank < prev.rank) {
      // New candidate is a more canonical source — swap.
      bestByKey.set(key, item);
      batchDupDropped++;
    } else {
      batchDupDropped++;
    }
  }

  const fresh = [...bestByKey.values()];

  console.log(
    `[deduplicate] ${articles.length} fetched → ${fresh.length} kept ` +
      `(url dupes: ${urlDropped}, batch-headline dupes: ${batchDupDropped}, db-headline dupes: ${dbHeadlineDropped})`
  );

  // Return the original articles (with normalized URLs) for the fresh set.
  return fresh.map((n) => ({
    ...n.article,
    sourceUrl: n.normalizedUrl,
  }));
}
