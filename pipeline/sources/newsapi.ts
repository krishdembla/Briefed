import { fetchWithRetry } from "@/lib/fetchWithRetry";
import type { RawArticle } from "@/types/pipeline";

const BASE_URL = "https://newsapi.org/v2";

// Sources that produce celebrity gossip, entertainment, sports, or tabloid
// content not relevant to a global news map.
const BLOCKED_SOURCES = new Set([
  // Entertainment / celebrity
  "tmz", "entertainment weekly", "people", "e! news", "us weekly",
  "hollywood reporter", "variety", "deadline", "billboard",
  "vulture", "the wrap", "screen rant", "ign", "polygon",
  // Sports
  "espn", "bleacher report", "sports illustrated", "the athletic",
  "sky sports", "goal.com", "nba.com",
  // Tabloids / clickbait
  "buzzfeed", "buzzfeed news", "the daily mail", "daily mail",
  "the mirror", "the sun", "daily star", "national enquirer",
  "ok magazine", "heat magazine", "closer magazine",
  // Low-signal aggregators
  "insider", "business insider india", "upworthy",
]);

function isBlockedSource(sourceName: string): boolean {
  return BLOCKED_SOURCES.has(sourceName.toLowerCase());
}

interface NewsApiArticle {
  url: string;
  source: { name: string };
  title: string;
  description: string | null;
  content: string | null;
  publishedAt: string;
}

interface NewsApiResponse {
  status: string;
  totalResults: number;
  articles: NewsApiArticle[];
  message?: string; // present on error responses
}

// Fetches top headlines plus broad "everything" results and merges them.
// Returns normalized RawArticle objects; skips articles with no URL or title.
export async function fetchFromNewsApi(): Promise<RawArticle[]> {
  const apiKey = process.env.NEWSAPI_KEY;
  if (!apiKey) {
    throw new Error("Missing env var: NEWSAPI_KEY");
  }

  const requests = [
    fetchWithRetry<NewsApiResponse>({
      url: `${BASE_URL}/top-headlines`,
      params: { language: "en", pageSize: 50, apiKey },
    }),
    fetchWithRetry<NewsApiResponse>({
      url: `${BASE_URL}/everything`,
      params: {
        q: "(war OR conflict OR military OR sanctions OR diplomacy OR election OR government OR parliament OR crisis OR coup) OR (economy OR inflation OR trade OR GDP OR central bank OR recession) OR (climate OR floods OR earthquake OR wildfire OR disaster) OR (health OR pandemic OR outbreak OR WHO)",
        language: "en",
        sortBy: "publishedAt",
        pageSize: 50,
        apiKey,
      },
    }),
  ];

  const responses = await Promise.allSettled(requests);

  const articles: NewsApiArticle[] = [];
  for (const result of responses) {
    if (result.status === "rejected") {
      console.error("[NewsAPI] fetch failed:", result.reason);
      continue;
    }
    if (result.value.data.status !== "ok") {
      console.error("[NewsAPI] API error:", result.value.data.message);
      continue;
    }
    articles.push(...result.value.data.articles);
  }

  return articles
    .filter((a) => a.url && a.title && !isBlockedSource(a.source?.name ?? ""))
    .map((a) => ({
      sourceUrl: a.url,
      sourceName: a.source?.name ?? "NewsAPI",
      headline: a.title,
      body: [a.description, a.content].filter(Boolean).join("\n\n"),
      publishedAt: a.publishedAt,
    }));
}
