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

// Fetches top headlines plus topic-targeted "everything" queries.
// Separate queries per topic group ensure underrepresented topics (tech, climate,
// health) get dedicated coverage rather than competing against war headlines.
export async function fetchFromNewsApi(): Promise<RawArticle[]> {
  const apiKey = process.env.NEWSAPI_KEY;
  if (!apiKey) {
    throw new Error("Missing env var: NEWSAPI_KEY");
  }

  const everythingBase = {
    url: `${BASE_URL}/everything`,
    method: "GET" as const,
  };

  const requests = [
    // Top headlines — broad news mix
    // Top headlines — broad global mix
    fetchWithRetry<NewsApiResponse>({
      url: `${BASE_URL}/top-headlines`,
      params: { language: "en", pageSize: 100, apiKey },
    }),
    // Politics / conflict / diplomacy
    fetchWithRetry<NewsApiResponse>({
      ...everythingBase,
      params: {
        q: "war OR conflict OR military OR sanctions OR diplomacy OR election OR government OR parliament OR crisis OR coup OR protest OR ceasefire OR siege",
        language: "en", sortBy: "publishedAt", pageSize: 50, apiKey,
      },
    }),
    // Economy / markets / trade
    fetchWithRetry<NewsApiResponse>({
      ...everythingBase,
      params: {
        q: "economy OR inflation OR trade OR GDP OR \"central bank\" OR recession OR \"interest rate\" OR \"stock market\" OR tariff OR \"supply chain\" OR IMF OR \"World Bank\"",
        language: "en", sortBy: "publishedAt", pageSize: 50, apiKey,
      },
    }),
    // Tech / AI / cyber
    fetchWithRetry<NewsApiResponse>({
      ...everythingBase,
      params: {
        q: "\"artificial intelligence\" OR cybersecurity OR Apple OR Google OR Microsoft OR OpenAI OR semiconductor OR \"big tech\" OR robotics OR \"tech regulation\" OR deepfake OR quantum",
        language: "en", sortBy: "publishedAt", pageSize: 50, apiKey,
      },
    }),
    // Climate / environment / natural disasters
    fetchWithRetry<NewsApiResponse>({
      ...everythingBase,
      params: {
        q: "\"climate change\" OR \"carbon emissions\" OR \"renewable energy\" OR wildfire OR flood OR earthquake OR hurricane OR drought OR IPCC OR \"sea level\" OR deforestation OR tsunami",
        language: "en", sortBy: "publishedAt", pageSize: 50, apiKey,
      },
    }),
    // Health / medicine / outbreaks
    fetchWithRetry<NewsApiResponse>({
      ...everythingBase,
      params: {
        q: "WHO OR pandemic OR vaccine OR outbreak OR FDA OR \"cancer research\" OR \"mental health\" OR Ebola OR \"drug approval\" OR \"bird flu\" OR mpox OR antimicrobial",
        language: "en", sortBy: "publishedAt", pageSize: 50, apiKey,
      },
    }),
    // Africa + Middle East — underrepresented by top-headlines
    fetchWithRetry<NewsApiResponse>({
      ...everythingBase,
      params: {
        q: "Nigeria OR Kenya OR Ethiopia OR Sudan OR DRC OR Somalia OR \"South Africa\" OR Egypt OR \"Saudi Arabia\" OR Iran OR Iraq OR Yemen OR Lebanon OR Gaza OR Libya OR Tunisia OR Morocco OR Ghana",
        language: "en", sortBy: "publishedAt", pageSize: 50, apiKey,
      },
    }),
    // Latin America + South / Southeast Asia
    fetchWithRetry<NewsApiResponse>({
      ...everythingBase,
      params: {
        q: "Brazil OR Argentina OR Mexico OR Colombia OR Venezuela OR Chile OR Peru OR India OR Pakistan OR Bangladesh OR Indonesia OR Philippines OR Vietnam OR Myanmar OR Thailand OR Malaysia",
        language: "en", sortBy: "publishedAt", pageSize: 50, apiKey,
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
