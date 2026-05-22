import Parser from "rss-parser";
import type { RawArticle } from "@/types/pipeline";

const parser = new Parser({ timeout: 10_000 });

// RSS feeds split by purpose:
// - General/world news: broad coverage, geographically diverse
// - Specialist feeds: dedicated per underrepresented topic (tech, climate, health)
const RSS_FEEDS: { url: string; sourceName: string }[] = [
  // General world news
  { url: "https://feeds.bbci.co.uk/news/world/rss.xml", sourceName: "BBC World" },
  { url: "https://www.aljazeera.com/xml/rss/all.xml", sourceName: "Al Jazeera" },
  { url: "https://www.theguardian.com/world/rss", sourceName: "The Guardian" },
  // Tech / AI
  { url: "https://techcrunch.com/feed/", sourceName: "TechCrunch" },
  { url: "https://feeds.arstechnica.com/arstechnica/index", sourceName: "Ars Technica" },
  // Climate / environment
  { url: "https://www.carbonbrief.org/feed", sourceName: "Carbon Brief" },
  { url: "https://www.theguardian.com/environment/climate-crisis/rss", sourceName: "Guardian Climate" },
  // Health / biotech
  { url: "https://www.statnews.com/feed/", sourceName: "STAT News" },
];

// Parses all RSS feeds concurrently. A single failed feed is logged and skipped
// so one broken feed doesn't take down the others.
export async function fetchFromRss(): Promise<RawArticle[]> {
  const results = await Promise.allSettled(
    RSS_FEEDS.map((feed) => parser.parseURL(feed.url).then((parsed) => ({ parsed, feed })))
  );

  const articles: RawArticle[] = [];

  for (const result of results) {
    if (result.status === "rejected") {
      console.error("[RSS] feed fetch failed:", result.reason);
      continue;
    }

    const { parsed, feed } = result.value;

    for (const item of parsed.items) {
      if (!item.link || !item.title) continue;

      articles.push({
        sourceUrl: item.link,
        sourceName: feed.sourceName,
        headline: item.title,
        body: item.contentSnippet ?? item.content ?? item.summary ?? "",
        publishedAt: item.isoDate ?? item.pubDate ?? new Date().toISOString(),
      });
    }
  }

  return articles;
}
