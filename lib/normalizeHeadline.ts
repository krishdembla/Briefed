// Canonicalises a headline so near-identical wire-service duplicates collapse
// to the same key. Catches the cases clusterByEvent's LLM pass has been
// missing — punctuation-only differences ("Analysis:Foo" vs "Analysis-Foo"),
// trailing " - Reuters" suffixes, and syndicator reposts of the same headline.
//
// Deterministic, dependency-free. Applied to both fresh incoming articles AND
// existing DB rows so a syndicated Biztoc repost matches yesterday's Reuters
// original as well as today's peers within the same fetch batch.

// Common editorial prefixes stripped when they appear at the head of a
// headline. Match with any trailing punctuation and whitespace.
const EDITORIAL_PREFIX_RE =
  /^(analysis|explainer|opinion|update|breaking|factbox|exclusive|column|comment|reuters|reuters investigates|watch|video|live|special report)[\s:\-–—]+/i;

// Common trailing attribution suffixes stripped from the tail (e.g.
// "…strikes - Reuters", "…election | BBC News"). Preserves the headline body.
const SOURCE_SUFFIX_RE =
  /[\s\-–—|·]+(reuters|reuters\.com|ap|associated press|afp|bloomberg|cnbc|cnn|bbc|bbc news|nyt|the new york times|wsj|the wall street journal|the guardian|ft|financial times|nikkei|xinhua)\s*$/i;

export function normalizeHeadline(headline: string): string {
  if (!headline) return "";

  let s = headline.trim();

  // Strip editorial prefixes iteratively — some sources stack them
  // ("Analysis: Update: Foo").
  for (let i = 0; i < 3; i++) {
    const next = s.replace(EDITORIAL_PREFIX_RE, "");
    if (next === s) break;
    s = next;
  }

  // Strip trailing " - Source" once.
  s = s.replace(SOURCE_SUFFIX_RE, "");

  // Lowercase, drop punctuation, collapse whitespace.
  return s
    .toLowerCase()
    .replace(/[’'`]/g, "") // curly + straight apostrophes → no separator
    .replace(/[^\w\s]/g, " ") // remaining punctuation → space
    .replace(/\s+/g, " ")
    .trim();
}
