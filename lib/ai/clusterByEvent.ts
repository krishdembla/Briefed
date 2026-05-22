import fs from "fs";
import path from "path";
import { anthropic, CLAUDE_MODEL } from "./client";
import type { RawArticle } from "@/types/pipeline";

const CLUSTER_PROMPT = fs.readFileSync(
  path.join(process.cwd(), "prompts/cluster-events.txt"),
  "utf-8"
);

// Articles scoring below this are considered not newsworthy enough for the map.
// Set to 5 to match the prompt's diversity rule — rare topics (tech, climate)
// are scored 5+ by Claude and should be kept, not filtered out.
const IMPORTANCE_THRESHOLD = 5;

interface ClusterResult {
  keepIndex: number;
  importance: number;
  reason: string;
}

// Groups articles covering the same event and filters by importance in one Claude call.
// Returns one representative article per unique event, importance >= threshold.
// Falls back to the full input list if Claude fails so the pipeline never silently empties.
export async function clusterByEvent(articles: RawArticle[]): Promise<RawArticle[]> {
  if (articles.length <= 1) return articles;

  const articleList = articles
    .map((a, i) => `[${i}] "${a.headline}" | ${a.sourceName} | ${a.body.slice(0, 150).replace(/\n/g, " ")}`)
    .join("\n");

  const prompt = CLUSTER_PROMPT.replace("{{articles}}", articleList);

  try {
    const message = await anthropic.messages.create({
      model: CLAUDE_MODEL,
      max_tokens: 4000,
      messages: [{ role: "user", content: prompt }],
    });

    const raw = message.content[0].type === "text" ? message.content[0].text : "";
    console.log(`[clusterByEvent] Raw response (first 400 chars): ${raw.slice(0, 400)}`);

    const results = JSON.parse(raw) as ClusterResult[];

    if (!Array.isArray(results)) {
      throw new Error("Expected a JSON array from Claude");
    }

    const kept = results.filter((r) => {
      if (r.keepIndex < 0 || r.keepIndex >= articles.length) {
        console.warn(`[clusterByEvent] keepIndex ${r.keepIndex} out of bounds, skipping`);
        return false;
      }
      if (r.importance < IMPORTANCE_THRESHOLD) {
        console.log(
          `[clusterByEvent] Dropped (importance ${r.importance}): "${articles[r.keepIndex].headline.slice(0, 70)}" — ${r.reason}`
        );
        return false;
      }
      return true;
    });

    console.log(
      `[clusterByEvent] ${articles.length} articles → ${kept.length} kept after clustering + importance filter`
    );

    return kept.map((r) => articles[r.keepIndex]);
  } catch (err) {
    console.error("[clusterByEvent] Failed, falling back to original article list:", err);
    return articles;
  }
}
