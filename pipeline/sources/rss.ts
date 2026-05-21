import Parser from "rss-parser";
import type { RawArticle } from "@/types/pipeline";

const parser = new Parser({ timeout: 10_000 });

// Fallback RSS feeds — BBC World, Reuters, AP
const RSS_FEEDS: { url: string; sourceName: string }[] = [
  { url: "https://feeds.bbci.co.uk/news/world/rss.xml", sourceName: "BBC World" },
  { url: "https://feeds.reuters.com/reuters/worldNews", sourceName: "Reuters" },
  { url: "https://rsshub.app/apnews/topics/apf-topnews", sourceName: "AP News" },
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
