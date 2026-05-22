import Parser from "rss-parser";
import type { RawArticle } from "@/types/pipeline";

const parser = new Parser({ timeout: 10_000 });

// Primary RSS feeds — global, reputable, geographically diverse.
// Reuters' public RSS was deprecated ~2019; RSSHub is an unreliable third-party proxy.
// Al Jazeera and The Guardian provide strong international coverage, especially
// outside the US-centric lens of NewsAPI.
const RSS_FEEDS: { url: string; sourceName: string }[] = [
  { url: "https://feeds.bbci.co.uk/news/world/rss.xml", sourceName: "BBC World" },
  { url: "https://www.aljazeera.com/xml/rss/all.xml", sourceName: "Al Jazeera" },
  { url: "https://www.theguardian.com/world/rss", sourceName: "The Guardian" },
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
