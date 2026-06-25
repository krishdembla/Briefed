import fs from "fs";
import path from "path";
import { callLLM } from "./client";
import type { AISummary, PinTopic } from "@/types/pipeline";

const SUMMARIZE_PROMPT = fs.readFileSync(
  path.join(process.cwd(), "prompts/summarize.txt"),
  "utf-8"
);

const VALID_TOPICS: PinTopic[] = [
  "politics", "economy", "climate", "conflict", "health", "tech", "other",
];

function isValidTopic(value: string): value is PinTopic {
  return VALID_TOPICS.includes(value as PinTopic);
}

// Summarizes an article via the LLM and returns a structured card.
// On failure, returns a minimal fallback so the pin is still stored.
export async function summarizeArticle(
  headline: string,
  body: string
): Promise<AISummary> {
  const bodyExcerpt = body.slice(0, 3000);

  const prompt = SUMMARIZE_PROMPT
    .replace("{{headline}}", headline)
    .replace("{{bodyExcerpt}}", bodyExcerpt);

  try {
    const raw = await callLLM(prompt, 800);
    console.log(`[summarize] raw output for "${headline.slice(0, 60)}...": ${raw}`);
    const text = raw.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
    const parsed = JSON.parse(text) as Record<string, string>;

    // Only summary and topic are required — stats are optional (UI handles 0–3 gracefully)
    if (!parsed.summary || !parsed.topic) {
      throw new Error(`Incomplete JSON response: ${raw}`);
    }

    return {
      summary: parsed.summary,
      stat1: parsed.stat1 || "",
      stat2: parsed.stat2 || "",
      stat3: parsed.stat3 || "",
      topic: isValidTopic(parsed.topic) ? parsed.topic : "other",
    };
  } catch (err) {
    console.error(`[summarize] Failed for headline "${headline.slice(0, 60)}":`, err);

    // Graceful fallback — the pin is still stored, just without AI enrichment
    return {
      summary: headline,
      stat1: "",
      stat2: "",
      stat3: "",
      topic: "other",
    };
  }
}
