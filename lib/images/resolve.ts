// Image quality resolution for pipeline pins.
//
// Feed images vary wildly: many are logos, tracking pixels, or tiny thumbnails
// that ruin the card aesthetic. Rather than a heavy computer-vision upscaler
// (fragile, and it can't invent detail in a 120px logo), we take the boring,
// robust path: reject obviously-bad images by URL and a cheap HEAD probe, and
// when an article has no usable image, try to extract the page's og:image.
//
// Everything here is best-effort and MUST NOT throw or hang: every network call
// has a hard timeout and any failure degrades to "keep the candidate" or null.

const PROBE_TIMEOUT_MS = 4000;
const PAGE_TIMEOUT_MS = 5000;
const MIN_IMAGE_BYTES = 6000; // logos/icons are typically < ~5KB; real photos larger
const MAX_PAGE_BYTES = 200_000; // only need the <head> for OG tags

// URL patterns that almost always indicate a logo, icon, placeholder, or
// tracking pixel rather than editorial imagery.
const BAD_URL_RE =
  /(sprite|placeholder|default[-_]?(image|thumb)|blank|1x1|pixel|spacer|logo|favicon|\bicon\b|avatar|gravatar|\.svg(\?|$)|\.ico(\?|$)|doubleclick|\/ads?\/)/i;

function isBadImageUrl(url: string): boolean {
  if (!/^https?:\/\//i.test(url)) return true; // no data: URIs or relative junk
  return BAD_URL_RE.test(url);
}

async function withTimeout(url: string, init: RequestInit, ms: number): Promise<Response | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  try {
    return await fetch(url, { ...init, signal: controller.signal, redirect: "follow" });
  } catch {
    return null; // network error / timeout — caller decides how to degrade
  } finally {
    clearTimeout(timer);
  }
}

// Verify a candidate image looks like a real, reasonably-sized image.
// Returns false only when we have positive evidence it's bad (non-image type or
// tiny size). Ambiguous/failed probes return true — we don't over-gate.
async function probeImage(url: string): Promise<boolean> {
  const res = await withTimeout(url, { method: "HEAD" }, PROBE_TIMEOUT_MS);
  if (!res) return true; // couldn't probe — give the benefit of the doubt
  if (!res.ok) return false; // 404 / gone

  const type = res.headers.get("content-type")?.toLowerCase() ?? "";
  if (type.includes("svg")) return false;
  if (type && !type.startsWith("image/") && !type.includes("octet-stream")) return false;

  const len = Number(res.headers.get("content-length") ?? "0");
  if (len > 0 && len < MIN_IMAGE_BYTES) return false;

  return true;
}

function resolveUrl(candidate: string, base: string): string | null {
  try {
    return new URL(candidate, base).toString();
  } catch {
    return null;
  }
}

// Pull og:image / twitter:image out of a page's HTML head. Handles both
// attribute orders (property before content and vice-versa).
function extractMetaImage(html: string): string | null {
  const patterns = [
    /<meta[^>]+(?:property|name)=["'](?:og:image(?::url)?|twitter:image(?::src)?)["'][^>]+content=["']([^"']+)["']/i,
    /<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["'](?:og:image(?::url)?|twitter:image(?::src)?)["']/i,
  ];
  for (const re of patterns) {
    const m = html.match(re);
    if (m?.[1]) return m[1];
  }
  return null;
}

async function extractOgImage(pageUrl: string): Promise<string | null> {
  const res = await withTimeout(pageUrl, { method: "GET", headers: { accept: "text/html" } }, PAGE_TIMEOUT_MS);
  if (!res || !res.ok) return null;
  const type = res.headers.get("content-type") ?? "";
  if (!type.includes("html")) return null;

  // Read only enough of the body to cover <head>.
  let html: string;
  try {
    const buf = await res.arrayBuffer();
    html = Buffer.from(buf.slice(0, MAX_PAGE_BYTES)).toString("utf-8");
  } catch {
    return null;
  }

  const found = extractMetaImage(html);
  if (!found) return null;
  return resolveUrl(found, pageUrl);
}

/**
 * Resolve the best usable image for an article, or null for a clean text-only
 * card. Prefers the feed-provided image; if it's missing or fails the quality
 * gate, falls back to the article page's og:image. Never throws.
 */
export async function resolveArticleImage(article: {
  ogImageUrl?: string;
  sourceUrl: string;
}): Promise<string | null> {
  const candidate = article.ogImageUrl?.trim();

  // 1. Try the feed-provided image if it isn't obviously junk.
  if (candidate && !isBadImageUrl(candidate)) {
    if (await probeImage(candidate)) return candidate;
  }

  // 2. Fall back to extracting the page's OG image, then gate it too.
  try {
    const og = await extractOgImage(article.sourceUrl);
    if (og && !isBadImageUrl(og) && (await probeImage(og))) return og;
  } catch {
    // ignore — resolution is best-effort
  }

  return null;
}
