import { fetchWithRetry } from "@/lib/fetchWithRetry";
import type { RawArticle } from "@/types/pipeline";

const BASE_URL = "https://finnhub.io/api/v1";

interface FinnhubNewsItem {
  id: number;
  url: string;
  source: string;
  headline: string;
  summary: string;
  datetime: number; // Unix timestamp
  category: string;
}

// Fetches general market/finance news from Finnhub.
// Finnhub free tier covers general news — no per-company calls needed for week 1.
export async function fetchFromFinnhub(): Promise<RawArticle[]> {
  const apiKey = process.env.FINNHUB_API_KEY;
  if (!apiKey) {
    throw new Error("Missing env var: FINNHUB_API_KEY");
  }

  const response = await fetchWithRetry<FinnhubNewsItem[]>({
    url: `${BASE_URL}/news`,
    params: { category: "general", token: apiKey },
  });

  const items = response.data;
  if (!Array.isArray(items)) {
    console.error("[Finnhub] unexpected response shape:", items);
    return [];
  }

  return items
    .filter((item) => item.url && item.headline)
    .map((item) => ({
      sourceUrl: item.url,
      sourceName: item.source ?? "Finnhub",
      headline: item.headline,
      body: item.summary ?? "",
      publishedAt: new Date(item.datetime * 1000).toISOString(),
    }));
}
