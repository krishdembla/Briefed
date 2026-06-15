import fs from "fs";
import path from "path";
import { callLLM } from "./client";
import type { RawArticle } from "@/types/pipeline";

const PROMPT_PATH = path.join(process.cwd(), "prompts/cluster-events.txt");

// Articles scoring below this are dropped.
const IMPORTANCE_THRESHOLD = 5;

// Max articles per Claude call — keeps the response well under token limits.
const CLUSTER_CHUNK_SIZE = 50;

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
// Processes articles in chunks so the response never exceeds token limits.
export async function clusterByEvent(articles: RawArticle[]): Promise<RawArticle[]> {
  if (articles.length <= 1) return articles;

  // Split into chunks and process them in parallel — each chunk is one LLM call,
  // and they're independent, so there's no reason to wait sequentially.
  const chunks: RawArticle[][] = [];
  for (let i = 0; i < articles.length; i += CLUSTER_CHUNK_SIZE) {
    chunks.push(articles.slice(i, i + CLUSTER_CHUNK_SIZE));
  }

  const results = await Promise.all(chunks.map((c) => clusterChunk(c)));

  const allKept: RawArticle[] = [];
  results.forEach((kept, idx) => {
    allKept.push(...kept);
    console.log(`[clusterByEvent] Chunk ${idx + 1}: ${chunks[idx].length} → ${kept.length} kept`);
  });

  console.log(`[clusterByEvent] Total: ${articles.length} → ${allKept.length} after clustering + importance filter`);
  return allKept;
}
