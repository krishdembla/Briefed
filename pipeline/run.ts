import * as Sentry from "@sentry/nextjs";
import { supabase } from "@/lib/db/supabase-service";
import { fetchFromNewsApi } from "./sources/newsapi";
import { fetchFromFinnhub } from "./sources/finnhub";
import { fetchFromRss } from "./sources/rss";
import { deduplicate } from "./deduplicate";
import { clusterByEvent } from "@/lib/ai/clusterByEvent";
import { processArticle as processArticleLLM } from "@/lib/ai/processArticle";
import { sendAlertEmail } from "@/lib/email/alerts";
import { detectThreads } from "@/lib/ai/detectThreads";
import type { Pin, RawArticle } from "@/types/pipeline";

const RATE_LIMIT_MINUTES = 30;

export interface PipelineResult {
  runId: string;
  pinsFetched: number;
  pinsStored: number;
  pinsAiDone: number;
  errors: string[];
}

// Main pipeline entry point. Fetches → deduplicates → geo-tags → summarizes → stores.
// Designed to be called from the API route or the local script.
export async function runPipeline(): Promise<PipelineResult> {
  // Rate limit: reject if a run completed successfully within the last RATE_LIMIT_MINUTES
  const rateLimitSince = new Date(Date.now() - RATE_LIMIT_MINUTES * 60 * 1000).toISOString();
  const { data: recentRun } = await supabase
    .from("pipeline_runs")
    .select("id, started_at")
    .eq("status", "success")
    .gte("started_at", rateLimitSince)
    .limit(1)
    .single();

  if (recentRun) {
    const msg = `Pipeline rate-limited — last successful run was at ${recentRun.started_at}`;
    console.warn(`[pipeline] ${msg}`);
    throw new Error(msg);
  }

  // Create a pipeline_runs record so we can audit this run
  const { data: run, error: runCreateError } = await supabase
    .from("pipeline_runs")
    .insert({ status: "running" })
    .select("id")
    .single();

  if (runCreateError || !run) {
    throw new Error(`Failed to create pipeline_run record: ${runCreateError?.message}`);
  }

  const runId: string = run.id;
  const errors: string[] = [];

  console.log(`[pipeline] Run ${runId} started`);

  // ── Step 1: Fetch ──────────────────────────────────────────────
  const fetchResults = await Promise.allSettled([
    fetchFromNewsApi(),
    fetchFromFinnhub(),
    fetchFromRss(),
  ]);

  const allArticles: RawArticle[] = [];
  const sourceNames = ["NewsAPI", "Finnhub", "RSS"];

  for (let i = 0; i < fetchResults.length; i++) {
    const result = fetchResults[i];
    if (result.status === "fulfilled") {
      console.log(`[pipeline] ${sourceNames[i]}: fetched ${result.value.length} articles`);
      allArticles.push(...result.value);
    } else {
      const msg = `${sourceNames[i]} fetch failed: ${result.reason}`;
      console.error(`[pipeline] ${msg}`);
      errors.push(msg);
    }
  }

  const pinsFetched = allArticles.length;
  console.log(`[pipeline] Total fetched: ${pinsFetched}`);

  // ── Step 2: Deduplicate ────────────────────────────────────────
  const freshArticles = await deduplicate(allArticles);
  console.log(`[pipeline] After dedup: ${freshArticles.length} new articles to process`);

  if (freshArticles.length === 0) {
    await finishRun(runId, "success", { pinsFetched, pinsStored: 0, pinsAiDone: 0 });
    return { runId, pinsFetched, pinsStored: 0, pinsAiDone: 0, errors };
  }

  // ── Step 3: Cluster same-event duplicates + importance filter ──
  // One Claude call for the whole batch — groups articles covering the same
  // event and drops anything below importance threshold (e.g. celebrity news).
  const clustered = await clusterByEvent(freshArticles);
  // Hard cap — paid tier can handle more, but 100 keeps cost predictable (~$0.05/run).
  const MAX_ARTICLES = 100;
  const importantArticles = clustered.slice(0, MAX_ARTICLES);
  console.log(`[pipeline] After clustering + importance filter: ${clustered.length} articles (capped to ${importantArticles.length})`);

  if (importantArticles.length === 0) {
    await finishRun(runId, "success", { pinsFetched, pinsStored: 0, pinsAiDone: 0 });
    return { runId, pinsFetched, pinsStored: 0, pinsAiDone: 0, errors };
  }

  // ── Steps 4 + 5: One combined LLM call per article (summary + geo) ─
  // Paid-tier Groq allows much higher throughput — batch 20 at once with minimal delay.
  const BATCH_SIZE = 20;
  const BATCH_DELAY_MS = 200;
  const pins: Pin[] = [];
  let pinsAiDone = 0;

  for (let i = 0; i < importantArticles.length; i += BATCH_SIZE) {
    const batch = importantArticles.slice(i, i + BATCH_SIZE);

    const processed = await Promise.allSettled(
      batch.map((article) => processArticle(article, runId))
    );

    for (let j = 0; j < processed.length; j++) {
      const result = processed[j];
      if (result.status === "fulfilled") {
        pins.push(result.value);
        if (result.value.ai_processed) pinsAiDone++;
      } else {
        const msg = `Failed to process article "${batch[j].headline.slice(0, 60)}": ${result.reason}`;
        console.error(`[pipeline] ${msg}`);
        Sentry.captureException(result.reason, { extra: { headline: batch[j].headline } });
        errors.push(msg);
      }
    }

    console.log(`[pipeline] Processed batch ${Math.floor(i / BATCH_SIZE) + 1} — ${pins.length}/${importantArticles.length} done`);

    // Throttle between batches to stay under Claude API rate limits
    if (i + BATCH_SIZE < importantArticles.length) {
      await new Promise((r) => setTimeout(r, BATCH_DELAY_MS));
    }
  }

  // ── Step 6: Store ──────────────────────────────────────────────
  let pinsStored = 0;

  if (pins.length > 0) {
    // Upsert in chunks of 50 to stay within Supabase payload limits
    const CHUNK_SIZE = 50;
    for (let i = 0; i < pins.length; i += CHUNK_SIZE) {
      const chunk = pins.slice(i, i + CHUNK_SIZE);
      const { error: upsertError } = await supabase
        .from("pins")
        .upsert(chunk, { onConflict: "source_url", ignoreDuplicates: true });

      if (upsertError) {
        const msg = `Upsert chunk ${Math.floor(i / CHUNK_SIZE) + 1} failed: ${upsertError.message}`;
        console.error(`[pipeline] ${msg}`);
        errors.push(msg);
      } else {
        pinsStored += chunk.length;
      }
    }
  }

  console.log(`[pipeline] Run ${runId} complete — stored: ${pinsStored}, AI done: ${pinsAiDone}, errors: ${errors.length}`);

  await finishRun(runId, errors.length > 0 ? "error" : "success", {
    pinsFetched,
    pinsStored,
    pinsAiDone,
    errorMsg: errors.length > 0 ? errors.join("; ") : undefined,
  });

  // ── Step 7: Detect story threads ──────────────────────────────────────────
  // Non-fatal — a failure here must never mark the pipeline run as errored.
  if (pinsStored > 0) {
    console.log(`[pipeline] Detecting story threads...`);
    const threadsFound = await detectThreads(runId).catch((err) => {
      console.error("[pipeline] Thread detection failed (non-fatal):", err);
      return 0;
    });
    console.log(`[pipeline] Thread detection done: ${threadsFound} relation(s) created`);
  }

  return { runId, pinsFetched, pinsStored, pinsAiDone, errors };
}

// Processes one article via a single combined LLM call (summary + geo).
// Never throws — failures degrade gracefully into a minimal pin.
async function processArticle(article: RawArticle, runId: string): Promise<Pin> {
  const { summary, location } = await processArticleLLM(article.headline, article.body);

  const aiProcessed = !!(summary && summary.summary && summary.summary !== article.headline);

  return {
    source_url: article.sourceUrl,
    source_name: article.sourceName,
    published_at: article.publishedAt,
    headline: article.headline,
    raw_body: article.body,
    summary: summary.summary,
    stat_1: summary.stat1 || null,
    stat_2: summary.stat2 || null,
    stat_3: summary.stat3 || null,
    why_it_matters: summary.why_it_matters || null,
    og_image_url: article.ogImageUrl ?? null,
    lat: location?.lat ?? null,
    lng: location?.lng ?? null,
    country_code: location?.countryCode || null,
    region_label: location?.regionLabel || null,
    topic: summary.topic,
    tags: summary.tags ?? [],
    pipeline_run_id: runId,
    ai_processed: aiProcessed,
    geo_processed: !!location?.lat,
  };
}

async function finishRun(
  runId: string,
  status: "success" | "error",
  counts: { pinsFetched: number; pinsStored: number; pinsAiDone: number; errorMsg?: string }
) {
  await supabase
    .from("pipeline_runs")
    .update({
      status,
      finished_at: new Date().toISOString(),
      error_msg: counts.errorMsg ?? null,
      pins_fetched: counts.pinsFetched,
      pins_stored: counts.pinsStored,
      pins_ai_done: counts.pinsAiDone,
    })
    .eq("id", runId);

  if (status === "error") {
    Sentry.captureMessage(`Pipeline run ${runId} failed`, {
      level: "error",
      extra: { runId, ...counts },
    });
    await sendAlertEmail(
      "Pipeline run failed",
      `Run ID: ${runId}\n\nErrors:\n${counts.errorMsg ?? "unknown"}\n\nStats: fetched=${counts.pinsFetched} stored=${counts.pinsStored} ai_done=${counts.pinsAiDone}`
    );
  }
}
