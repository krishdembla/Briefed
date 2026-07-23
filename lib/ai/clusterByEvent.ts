import fs from "fs";
import path from "path";
import { callLLM } from "./client";
import type { RawArticle } from "@/types/pipeline";

// Read once at module load — avoids a disk read per chunk call.
const CLUSTER_PROMPT = fs.readFileSync(
  path.join(process.cwd(), "prompts/cluster-events.txt"),
  "utf-8"
);

// Articles scoring below this are dropped.
// Set to 4 so niche-but-significant stories (tech breakthroughs, health alerts from
// underrepresented regions) are not silently dropped by the code even when the prompt
// explicitly keeps them at 4+.
const IMPORTANCE_THRESHOLD = 4;

// Max articles per Claude call — keeps the response well under token limits.
const CLUSTER_CHUNK_SIZE = 50;

// Paid-tier Groq has much higher rate limits, so we can run more chunks in parallel
// and use a shorter inter-batch delay.
const CHUNK_CONCURRENCY = 5;
const CHUNK_BATCH_DELAY_MS = 3_000;

// Cross-chunk dedup safety cap. If the second LLM pass drops more than this
// fraction of survivors it's almost certainly the LLM re-litigating importance
// on that day's roll, not finding real duplicates. Trust the per-chunk output
// instead and keep the pins.
const CROSS_CHUNK_MAX_DROP_RATIO = 0.4;
// Below this many survivors there is not enough overlap between chunks to
// justify another LLM call — skip the second pass entirely.
const CROSS_CHUNK_SKIP_BELOW = 15;

interface ClusterResult {
  keepIndex: number;
  importance: number;
  reason: string;
}

// Clusters and importance-filters one chunk of articles via a single Claude call.
// keepIndex values are relative to the chunk (0 to chunk.length-1).
async function clusterChunk(chunk: RawArticle[]): Promise<RawArticle[]> {
  const articleList = chunk
    .map((a, i) => `[${i}] "${a.headline}" | ${a.sourceName} | ${a.body.slice(0, 150).replace(/\n/g, " ")}`)
    .join("\n");

  const prompt = CLUSTER_PROMPT.replace("{{articles}}", articleList);

  try {
    const raw = await callLLM(prompt, 2048);
    // Strip markdown fences if present
    const text = raw.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
    const results = JSON.parse(text) as ClusterResult[];

    if (!Array.isArray(results)) throw new Error("Expected JSON array");

    const kept = results.filter((r) => {
      if (r.keepIndex < 0 || r.keepIndex >= chunk.length) return false;
      if (r.importance < IMPORTANCE_THRESHOLD) {
        console.log(`[clusterByEvent] Dropped (${r.importance}): "${chunk[r.keepIndex].headline.slice(0, 60)}"`);
        return false;
      }
      return true;
    });

    return kept.map((r) => chunk[r.keepIndex]);
  } catch (err) {
    console.error("[clusterByEvent] Chunk failed, keeping all articles in chunk:", err);
    // Fallback: keep everything in this chunk rather than losing it entirely
    return chunk;
  }
}

// Groups articles covering the same event and filters by importance.
// Processes articles in chunks, a few at a time, so the response never
// exceeds token limits and we stay under the LLM provider's rate limits.
export async function clusterByEvent(articles: RawArticle[]): Promise<RawArticle[]> {
  if (articles.length <= 1) return articles;

  const chunks: RawArticle[][] = [];
  for (let i = 0; i < articles.length; i += CLUSTER_CHUNK_SIZE) {
    chunks.push(articles.slice(i, i + CLUSTER_CHUNK_SIZE));
  }

  const allKept: RawArticle[] = [];

  for (let i = 0; i < chunks.length; i += CHUNK_CONCURRENCY) {
    const batch = chunks.slice(i, i + CHUNK_CONCURRENCY);
    const results = await Promise.all(batch.map((c) => clusterChunk(c)));

    results.forEach((kept, j) => {
      const chunkIdx = i + j;
      allKept.push(...kept);
      console.log(`[clusterByEvent] Chunk ${chunkIdx + 1}/${chunks.length}: ${chunks[chunkIdx].length} → ${kept.length} kept`);
    });

    if (i + CHUNK_CONCURRENCY < chunks.length) {
      await new Promise((r) => setTimeout(r, CHUNK_BATCH_DELAY_MS));
    }
  }

  console.log(`[clusterByEvent] Total: ${articles.length} → ${allKept.length} after clustering + importance filter`);

  // Cross-chunk duplicate pass: articles covering the same event may have survived
  // in separate chunks. Run one final cluster call on the merged kept set to catch them.
  // The kept set is always small enough to fit in a single chunk.
  //
  // Two safety valves guard against the pass silently gutting the day's output
  // (previously the main driver of 13-vs-95 daily variance):
  //   1. Skip entirely when the survivor pool is small — few chunks means little
  //      cross-chunk overlap to catch.
  //   2. If the pass drops more than CROSS_CHUNK_MAX_DROP_RATIO, the LLM is
  //      almost certainly re-scoring importance rather than finding dupes.
  //      Distrust it and keep the per-chunk output.
  if (allKept.length <= CROSS_CHUNK_SKIP_BELOW) {
    console.log(`[clusterByEvent] Skipping cross-chunk dedup (only ${allKept.length} survivors)`);
    return allKept;
  }

  const deduped = await clusterChunk(allKept);
  const dropRatio = 1 - deduped.length / allKept.length;
  console.log(
    `[clusterByEvent] Cross-chunk dedup: ${allKept.length} → ${deduped.length} (dropped ${(dropRatio * 100).toFixed(0)}%)`
  );

  if (dropRatio > CROSS_CHUNK_MAX_DROP_RATIO) {
    console.warn(
      `[clusterByEvent] Cross-chunk pass dropped ${(dropRatio * 100).toFixed(0)}% — above ${
        CROSS_CHUNK_MAX_DROP_RATIO * 100
      }% safety cap. Keeping per-chunk output to avoid stochastic under-count.`
    );
    return allKept;
  }

  return deduped;
}
