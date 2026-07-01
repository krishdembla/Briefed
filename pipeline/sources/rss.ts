import Parser from "rss-parser";
import type { RawArticle } from "@/types/pipeline";

type MediaThumbnail = { $?: { url?: string } };
type MediaContent = { $?: { url?: string; medium?: string; type?: string } };

interface RssItemExtensions {
  mediaThumbnail?: MediaThumbnail | MediaThumbnail[];
  mediaContent?: MediaContent | MediaContent[];
}

const parser: Parser<unknown, RssItemExtensions> = new Parser({
  timeout: 10_000,
  customFields: {
    item: [
      ["media:thumbnail", "mediaThumbnail"],
      ["media:content", "mediaContent"],
    ],
  },
});

const IMAGE_EXTENSION_RE = /\.(jpe?g|png|webp|gif)(\?|$)/i;

// Most feeds publish images via the Media RSS namespace (media:thumbnail or
// media:content) rather than the plain RSS <enclosure> tag. We check both,
// preferring the dedicated thumbnail field, and fall back to enclosure for
// the few feeds that still use it.
function extractImageUrl(
  item: Parser.Item & RssItemExtensions
): string | undefined {
  const thumb = Array.isArray(item.mediaThumbnail) ? item.mediaThumbnail[0] : item.mediaThumbnail;
  if (thumb?.$?.url) return thumb.$.url;

  const contentList = Array.isArray(item.mediaContent) ? item.mediaContent : item.mediaContent ? [item.mediaContent] : [];
  for (const content of contentList) {
    const url = content?.$?.url;
    if (!url) continue;
    const medium = content.$?.medium;
    const type = content.$?.type;
    if (medium === "image" || type?.startsWith("image/") || IMAGE_EXTENSION_RE.test(url)) {
      return url;
    }
  }

  const enclosure = item.enclosure as { url?: string; type?: string } | undefined;
  if (enclosure?.type?.startsWith("image/") && enclosure.url) {
    return enclosure.url;
  }

  return undefined;
}

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
  // Asia-Pacific
  { url: "https://www.scmp.com/rss/91/feed", sourceName: "South China Morning Post" },
  { url: "https://feeds.feedburner.com/ndtvnews-world-news", sourceName: "NDTV World" },
  { url: "https://www.dawn.com/feeds/home", sourceName: "Dawn (Pakistan)" },
  { url: "https://www.straitstimes.com/news/world/rss.xml", sourceName: "Straits Times" },
  // Africa
  { url: "https://allafrica.com/tools/headlines/rdf/latest/headlines.rdf", sourceName: "AllAfrica" },
  { url: "https://www.voanews.com/api/zyrqmesq_t", sourceName: "VOA Africa" },
  { url: "https://www.dailymaverick.co.za/feed/", sourceName: "Daily Maverick" },
  // Latin America
  { url: "https://www.mercopress.com/rss/news.rss", sourceName: "MercoPress" },
  { url: "https://rss.dw.com/xml/rss-en-lac", sourceName: "DW Latin America" },
  // Middle East
  { url: "https://www.middleeasteye.net/rss", sourceName: "Middle East Eye" },
  // Foreign policy / geopolitics
  { url: "https://foreignpolicy.com/feed/", sourceName: "Foreign Policy" },
  { url: "https://www.chathamhouse.org/rss.xml", sourceName: "Chatham House" },
  // Tech / AI
  { url: "https://techcrunch.com/feed/", sourceName: "TechCrunch" },
  { url: "https://feeds.arstechnica.com/arstechnica/index", sourceName: "Ars Technica" },
  { url: "https://www.wired.com/feed/rss", sourceName: "Wired" },
  { url: "https://www.technologyreview.com/feed/", sourceName: "MIT Tech Review" },
  { url: "https://www.theverge.com/rss/index.xml", sourceName: "The Verge" },
  { url: "https://venturebeat.com/feed/", sourceName: "VentureBeat" },
  { url: "https://spectrum.ieee.org/feeds/feed.rss", sourceName: "IEEE Spectrum" },
  // Asia tech / business (reduces US-tech geographic bias)
  { url: "https://asia.nikkei.com/rss/feed/nar", sourceName: "Nikkei Asia" },
  { url: "https://techinasia.com/feed", sourceName: "Tech in Asia" },
  // Climate / environment
  { url: "https://www.carbonbrief.org/feed", sourceName: "Carbon Brief" },
  { url: "https://www.theguardian.com/environment/climate-crisis/rss", sourceName: "Guardian Climate" },
  { url: "https://insideclimatenews.org/feed/", sourceName: "Inside Climate News" },
  // Health / medicine / science
  { url: "https://www.statnews.com/feed/", sourceName: "STAT News" },
  { url: "https://www.who.int/rss-feeds/news-english.xml", sourceName: "WHO" },
  { url: "https://www.sciencedaily.com/rss/health_medicine.xml", sourceName: "ScienceDaily Health" },
  { url: "https://www.nature.com/nature.rss", sourceName: "Nature" },
  { url: "https://www.science.org/rss/news_current.xml", sourceName: "Science" },
  // Economy / markets
  { url: "https://feeds.ft.com/rss/home/uk", sourceName: "Financial Times" },
  { url: "https://www.imf.org/en/News/rss?language=eng", sourceName: "IMF" },
  // Sports — major leagues + tier-1 international tournaments only.
  // Routine match results and transfer rumours are filtered by clusterByEvent importance scoring.
  { url: "https://feeds.bbci.co.uk/sport/rss.xml", sourceName: "BBC Sport" },
  { url: "https://www.skysports.com/rss/12040", sourceName: "Sky Sports Football" },
  { url: "https://www.espncricinfo.com/rss/content/story/feeds/0.xml", sourceName: "ESPNcricinfo" },
  { url: "https://theathletic.com/rss/", sourceName: "The Athletic" },
  { url: "https://www.espn.com/espn/rss/news", sourceName: "ESPN" },
  // Africa — additional sources
  { url: "https://www.premiumtimesng.com/feed", sourceName: "Premium Times Nigeria" },
  { url: "https://www.theeastafrican.co.ke/tea/rss", sourceName: "The East African" },
  // Latin America — additional
  { url: "https://agenciabrasil.ebc.com.br/en/rss/ultimasnoticias/feed.rss", sourceName: "Agência Brasil" },
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

      const ogImageUrl = extractImageUrl(item);

      articles.push({
        sourceUrl: item.link,
        sourceName: feed.sourceName,
        headline: item.title,
        body: item.contentSnippet ?? item.content ?? item.summary ?? "",
        publishedAt: item.isoDate ?? item.pubDate ?? new Date().toISOString(),
        ogImageUrl,
      });
    }
  }

  return articles;
}
