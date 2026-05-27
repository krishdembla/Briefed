import Parser from "rss-parser";
import type { RawArticle } from "@/types/pipeline";

const parser = new Parser({ timeout: 10_000 });

// RSS feeds split by purpose:
// - General/world news: broad coverage, geographically diverse
// - Regional: non-Western perspectives to balance Anglophone bias
// - Specialist feeds: dedicated per underrepresented topic (tech, climate, health)
const RSS_FEEDS: { url: string; sourceName: string }[] = [
  // Wire services — highest volume, most geographically diverse
  { url: "https://feeds.reuters.com/reuters/worldNews", sourceName: "Reuters" },
  { url: "https://apnews.com/rss", sourceName: "AP News" },
  { url: "https://news.un.org/feed/subscribe/en/news/all/rss.xml", sourceName: "UN News" },
  // General world news — Anglophone
  { url: "https://feeds.bbci.co.uk/news/world/rss.xml", sourceName: "BBC World" },
  { url: "https://www.theguardian.com/world/rss", sourceName: "The Guardian" },
  { url: "https://feeds.npr.org/1004/rss.xml", sourceName: "NPR World" },
  // General world news — international perspectives
  { url: "https://www.aljazeera.com/xml/rss/all.xml", sourceName: "Al Jazeera" },
  { url: "https://rss.dw.com/xml/rss-en-world", sourceName: "Deutsche Welle" },
  { url: "https://www.france24.com/en/rss", sourceName: "France 24" },
  { url: "https://www.euronews.com/rss?format=mrss&level=theme&name=news", sourceName: "Euronews" },
  // Regional — fills Africa, Asia, Latin America gaps
  { url: "https://www.scmp.com/rss/91/feed", sourceName: "South China Morning Post" },
  { url: "https://foreignpolicy.com/feed/", sourceName: "Foreign Policy" },
  // Tech / AI
  { url: "https://techcrunch.com/feed/", sourceName: "TechCrunch" },
  { url: "https://feeds.arstechnica.com/arstechnica/index", sourceName: "Ars Technica" },
  { url: "https://www.wired.com/feed/rss", sourceName: "Wired" },
  // Climate / environment
  { url: "https://www.carbonbrief.org/feed", sourceName: "Carbon Brief" },
  { url: "https://www.theguardian.com/environment/climate-crisis/rss", sourceName: "Guardian Climate" },
  // Health / biotech
  { url: "https://www.statnews.com/feed/", sourceName: "STAT News" },
  // Economy / markets
  { url: "https://feeds.ft.com/rss/home/uk", sourceName: "Financial Times" },
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
