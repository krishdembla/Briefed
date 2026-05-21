import fs from "fs";
import path from "path";
import { anthropic, CLAUDE_MODEL } from "./client";
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

// Summarizes an article via Claude and returns a structured card.
// On failure, returns a minimal fallback so the pin is still stored.
export async function summarizeArticle(
  headline: string,
  body: string
): Promise<AISummary> {
  const bodyExcerpt = body.slice(0, 1000);

  const prompt = SUMMARIZE_PROMPT
    .replace("{{headline}}", headline)
    .replace("{{bodyExcerpt}}", bodyExcerpt);

  try {
    const message = await anthropic.messages.create({
      model: CLAUDE_MODEL,
      max_tokens: 400,
      messages: [{ role: "user", content: prompt }],
    });

    const raw = message.content[0].type === "text" ? message.content[0].text : "";
    console.log(`[summarize] Claude raw output for "${headline.slice(0, 60)}...": ${raw}`);

    const parsed = JSON.parse(raw) as Record<string, string>;

    // Validate shape before trusting it
    if (!parsed.summary || !parsed.stat1 || !parsed.stat2 || !parsed.stat3 || !parsed.topic) {
      throw new Error(`Incomplete JSON response: ${raw}`);
    }

    return {
      summary: parsed.summary,
      stat1: parsed.stat1,
      stat2: parsed.stat2,
      stat3: parsed.stat3,
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
