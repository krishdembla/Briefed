import fs from "fs";
import path from "path";
import { callLLM } from "./client";
import type { RawArticle } from "@/types/pipeline";

const PROMPT_PATH = path.join(process.cwd(), "prompts/cluster-events.txt");

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

  const prompt = fs.readFileSync(PROMPT_PATH, "utf-8").replace("{{articles}}", articleList);

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
  return allKept;
}
