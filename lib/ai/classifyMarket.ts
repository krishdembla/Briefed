import fs from "fs";
import path from "path";
import { callLLM } from "./client";
import { formatWhitelistForPrompt, TICKER_SET } from "@/lib/data/tickers";

// Read once at module load — same pattern as other AI wrappers in this dir.
const CLASSIFY_PROMPT = fs.readFileSync(
  path.join(process.cwd(), "prompts/classify-market.txt"),
  "utf-8"
);

export type MarketRelevance = "high" | "medium" | "low" | "none";

export interface MarketClassification {
  market_relevance: MarketRelevance;
  tickers: string[]; // whitelist-validated symbols only
  rationale: string;
}

const VALID_LEVELS: readonly MarketRelevance[] = ["high", "medium", "low", "none"];

// Given a pin's headline and summary, returns the market relevance level and
// up to 3 whitelist-validated tickers. Never throws for a "no impact" pin —
// that just returns { market_relevance: "none", tickers: [], ... }. Throws
// only if the LLM output can't be parsed at all.
export async function classifyMarket(
  headline: string,
  summary: string | null
): Promise<MarketClassification> {
  const prompt = CLASSIFY_PROMPT
    .replace("{{targetHeadline}}", headline)
    .replace("{{targetSummary}}", summary ?? "(no summary available)")
    .replace("{{whitelist}}", formatWhitelistForPrompt());

  const raw = await callLLM(prompt, 512);
  const text = raw.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");

  const parsed = JSON.parse(text) as {
    market_relevance?: string;
    tickers?: unknown;
    rationale?: string;
  };

  if (!VALID_LEVELS.includes(parsed.market_relevance as MarketRelevance)) {
    throw new Error(
      `Invalid market_relevance in LLM output: ${JSON.stringify(parsed).slice(0, 200)}`
    );
  }
  const relevance = parsed.market_relevance as MarketRelevance;

  // LLM may return either ["AAPL", "NVDA"] or [{symbol, reason}, ...] shapes;
  // accept both, then hard-validate against the whitelist so we never persist
  // a symbol the chart provider won't recognise.
  const rawList = Array.isArray(parsed.tickers) ? parsed.tickers : [];
  const symbols = rawList
    .map((t: unknown) => {
      if (typeof t === "string") return t;
      if (t && typeof t === "object" && "symbol" in t) {
        const s = (t as { symbol: unknown }).symbol;
        return typeof s === "string" ? s : null;
      }
      return null;
    })
    .filter((s: string | null): s is string => s !== null && TICKER_SET.has(s));

  // Dedupe while preserving LLM order, cap at 3.
  const seen = new Set<string>();
  const dedupedTickers: string[] = [];
  for (const s of symbols) {
    if (!seen.has(s)) {
      seen.add(s);
      dedupedTickers.push(s);
      if (dedupedTickers.length >= 3) break;
    }
  }

  // Contract: low/none can never have tickers. Enforce here even if the LLM slips.
  const finalTickers =
    relevance === "low" || relevance === "none" ? [] : dedupedTickers;

  return {
    market_relevance: relevance,
    tickers: finalTickers,
    rationale: typeof parsed.rationale === "string" ? parsed.rationale : "",
  };
}
