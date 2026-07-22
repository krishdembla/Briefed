import fs from "fs";
import path from "path";
import { callLLM } from "./client";

const TAKEAWAY_PROMPT = fs.readFileSync(
  path.join(process.cwd(), "prompts/market-takeaway.txt"),
  "utf-8"
);

export interface MarketTakeawayTarget {
  headline: string;
  summary: string | null;
  tickers: string[];
}

export interface MarketTakeawayResult {
  sector_label: string;
  takeaway_md: string;
}

// Generates a short editorial market takeaway explaining why the given tickers
// matter to this story. Assumes the pin has already been classified market-
// relevant with at least one whitelist ticker — caller is responsible for that.
export async function generateMarketTakeaway(
  target: MarketTakeawayTarget
): Promise<MarketTakeawayResult> {
  const tickersText = target.tickers.length
    ? target.tickers.map((t) => `- ${t}`).join("\n")
    : "(none)";

  const prompt = TAKEAWAY_PROMPT
    .replace("{{targetHeadline}}", target.headline)
    .replace("{{targetSummary}}", target.summary ?? "(no summary available)")
    .replace("{{tickers}}", tickersText);

  const raw = await callLLM(prompt, 700);
  const text = raw.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");

  const parsed = JSON.parse(text) as {
    sector_label?: unknown;
    takeaway_md?: unknown;
  };

  if (
    typeof parsed.sector_label !== "string" ||
    !parsed.sector_label.trim() ||
    typeof parsed.takeaway_md !== "string" ||
    !parsed.takeaway_md.trim()
  ) {
    throw new Error(
      `Invalid takeaway LLM output: ${JSON.stringify(parsed).slice(0, 200)}`
    );
  }

  return {
    sector_label: parsed.sector_label.trim(),
    takeaway_md: parsed.takeaway_md.trim(),
  };
}
