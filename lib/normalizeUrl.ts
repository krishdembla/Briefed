const TRACKING_PARAMS = [
  "utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content",
  "ref", "referrer", "fbclid", "gclid", "mc_cid", "mc_eid",
];

// Strips tracking query params so the same article doesn't appear as duplicate URLs.
export function normalizeUrl(url: string): string {
  try {
    const parsed = new URL(url);
    for (const param of TRACKING_PARAMS) {
      parsed.searchParams.delete(param);
    }
    return parsed.toString().toLowerCase();
  } catch {
    return url.toLowerCase();
  }
}
