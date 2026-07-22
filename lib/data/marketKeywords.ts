// Cheap pre-filter for the ticker classifier.
//
// We only spend an LLM call classifying a pin's market impact if the headline
// or summary contains at least one of these keywords (or the topic is already
// economy/tech, where the bar is lower). Everything else short-circuits to
// market_relevance = "none" with zero cost.
//
// False positives here are cheap — the LLM will just return relevance = "none".
// False negatives are more costly (we miss a market-relevant story), so bias
// toward being inclusive.

import { TICKER_WHITELIST } from "./tickers";

const KEYWORDS = [
  // Central banks & monetary policy
  "fed ", "federal reserve", "fomc", "powell",
  "ecb", "european central bank", "lagarde",
  "boj", "bank of japan", "bank of england", "boe",
  "central bank", "monetary policy",
  "interest rate", "rate hike", "rate cut", "rate rise",
  "basis point", "bps",
  "inflation", "cpi", "ppi", "pce", "core inflation",
  "yield", "yield curve", "treasury",

  // Fiscal, trade, geopolitics with market angle
  "tariff", "trade war", "sanction", "export control",
  "budget", "debt ceiling", "deficit", "stimulus",
  "opec", "opec+",

  // Corporate events
  "earnings", "revenue", "guidance", "outlook",
  "ipo", "listing", "spac",
  "merger", "acquisition", "acquires", "takeover", "buyout",
  "layoff", "layoffs", "job cuts", "restructur",
  "dividend", "buyback", "share repurchase",
  "invests", "investment round", "funding round", "series a", "series b", "series c", "series d",
  "valuation", "raises",

  // Sectors / themes
  "chip", "chipmaker", "semiconductor", "foundry",
  "ai chip", "ai model", "generative ai",
  "electric vehicle", " ev ", "battery", "lithium",
  "cloud computing", "data center",
  "streaming", "advertising",
  "housing market", "mortgage rate",

  // Commodities
  "oil price", "crude", "brent", "wti",
  "gas price", "natural gas",
  "gold price", "silver price",
  "wheat", "corn", "soybean",
  "copper", "uranium",

  // Crypto
  "bitcoin", "btc ", " btc", "ethereum", "crypto", "stablecoin",

  // Market words
  "shares", "stock price", "share price", "s&p", "nasdaq", "dow jones", "russell",
  "hedge fund", "wall street", "market cap",
  "recession", "gdp", "unemployment", "jobless claims", "nonfarm",
  "dollar index", "currency", "forex",
];

// Company names from the whitelist double as keywords — mentioning "Nvidia"
// or "OpenAI" in a headline is a strong signal even without other market words.
// We include names ≥ 4 chars to avoid false hits on short tickers.
const COMPANY_NAMES = TICKER_WHITELIST
  .map((t) => t.name.toLowerCase())
  .filter((n) => n.length >= 4);

// A few private-company / entity names worth catching even though they aren't
// listed. Their events (OpenAI raises, ByteDance ban) genuinely move markets.
const NOTABLE_ENTITIES = [
  "openai", "anthropic", "spacex", "bytedance", "tiktok", "stripe",
  "databricks", "perplexity", "mistral", "xai",
];

const ALL_KEYWORDS: string[] = [
  ...KEYWORDS,
  ...COMPANY_NAMES,
  ...NOTABLE_ENTITIES,
];

// Case-insensitive substring check. Cheap enough that we can call it on every
// pin during ingestion — no regex compilation cost per call.
export function hasMarketKeyword(text: string): boolean {
  const lower = text.toLowerCase();
  return ALL_KEYWORDS.some((kw) => lower.includes(kw));
}
