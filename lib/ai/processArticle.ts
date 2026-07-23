import fs from "fs";
import path from "path";
import { callLLM } from "./client";
import { fetchWithRetry } from "@/lib/fetchWithRetry";
import { COUNTRY_CENTROIDS } from "@/lib/data/countryCentroids";
import type { AISummary, ExtractedLocation, PinTopic } from "@/types/pipeline";

const PROCESS_PROMPT = fs.readFileSync(
  path.join(process.cwd(), "prompts/process-article.txt"),
  "utf-8"
);

// Cheaper fallback: if the main call returns no location AND no country,
// re-ask the LLM with a narrower prompt that only extracts the geographic
// anchor. Recovers stories like "US strikes on Iran" where the main pass
// failed but the country is obvious. Kept in a separate prompt file per
// project convention (all prompts in /prompts).
const COUNTRY_PROMPT = fs.readFileSync(
  path.join(process.cwd(), "prompts/extract-country.txt"),
  "utf-8"
);

interface CountryFallback {
  countryCode: string | null;
  regionLabel: string | null;
}

async function extractCountryFallback(
  headline: string,
  body: string
): Promise<CountryFallback | null> {
  const prompt = COUNTRY_PROMPT
    .replace("{{headline}}", headline)
    .replace("{{bodyExcerpt}}", body.slice(0, 1500));

  try {
    const raw = await callLLM(prompt, 200);
    const text = raw.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
    const parsed = JSON.parse(text) as CountryFallback;
    const cc = typeof parsed.countryCode === "string" ? parsed.countryCode.toUpperCase() : null;
    const rl = typeof parsed.regionLabel === "string" ? parsed.regionLabel : null;
    return { countryCode: cc, regionLabel: rl };
  } catch (err) {
    console.error(`[processArticle] Country-fallback LLM call failed for "${headline.slice(0, 60)}":`, err);
    return null;
  }
}

const VALID_TOPICS: PinTopic[] = [
  "politics", "economy", "climate", "conflict", "health", "tech", "sports", "other",
];

function isValidTopic(value: string): value is PinTopic {
  return VALID_TOPICS.includes(value as PinTopic);
}

export interface ProcessedArticle {
  summary: AISummary;
  location: (ExtractedLocation & { lat: number | null; lng: number | null }) | null;
}

interface MapboxFeature {
  center: [number, number];
  place_name: string;
}

interface MapboxGeocodingResponse {
  features: MapboxFeature[];
}

// One Claude call returns both the editorial card AND the geo extraction.
// Mapbox geocoding is then a single cheap HTTP call; if the LLM only gave us
// a country code, we skip Mapbox and use a static country-centroid lookup.
export async function processArticle(
  headline: string,
  body: string
): Promise<ProcessedArticle> {
  const bodyExcerpt = body.slice(0, 3000);

  const prompt = PROCESS_PROMPT
    .replace("{{headline}}", headline)
    .replace("{{bodyExcerpt}}", bodyExcerpt);

  let parsed: Record<string, string | null>;
  try {
    const raw = await callLLM(prompt, 1200);
    console.log(`[processArticle] raw output for "${headline.slice(0, 60)}...": ${raw}`);
    const text = raw.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
    parsed = JSON.parse(text);
  } catch (err) {
    console.error(`[processArticle] LLM call failed for "${headline.slice(0, 60)}":`, err);
    // Graceful fallback — pin is still stored, just without AI enrichment
    return {
      summary: { summary: headline, stat1: "", stat2: "", stat3: "", why_it_matters: "", topic: "other", tags: [] },
      location: null,
    };
  }

  const summaryText = (parsed.summary as string) || headline;
  const topic = parsed.topic && isValidTopic(parsed.topic as string)
    ? (parsed.topic as PinTopic)
    : "other";

  const rawTags = parsed.tags;
  const summary: AISummary = {
    summary: summaryText,
    stat1: (parsed.stat1 as string) || "",
    stat2: (parsed.stat2 as string) || "",
    stat3: (parsed.stat3 as string) || "",
    // The prompt emits this as "standfirst" (an editorial dek); fall back to the
    // legacy "why_it_matters" key for resilience. Stored in why_it_matters.
    why_it_matters: (parsed.standfirst as string) || (parsed.why_it_matters as string) || "",
    topic,
    tags: Array.isArray(rawTags) ? (rawTags as unknown[]).filter((t): t is string => typeof t === "string") : [],
  };

  const locationName = parsed.locationName as string | null;
  let countryCode = parsed.countryCode as string | null;
  let regionLabel = (parsed.regionLabel as string) || "";

  // Silent geo failure was the second-biggest driver of "empty Today feed" —
  // a run could store 90 pins but leave 40+ with null lat/lng, invisible to the
  // map. When the main pass returns nothing geo-wise, retry with a targeted
  // country-only prompt. Recovers the obvious cases (US strikes on Iran, etc.)
  // without adding latency to the ~70% of articles that already have a location.
  if (!locationName && !countryCode) {
    const fallback = await extractCountryFallback(headline, bodyExcerpt);
    if (fallback?.countryCode) {
      countryCode = fallback.countryCode;
      if (!regionLabel && fallback.regionLabel) regionLabel = fallback.regionLabel;
      console.log(`[processArticle] Geo fallback recovered "${countryCode}" for "${headline.slice(0, 60)}"`);
    }
  }

  // Still no geo — accept it and log so we can track how often this happens.
  if (!locationName && !countryCode) {
    console.warn(`[processArticle] No geo anchor for "${headline.slice(0, 80)}"`);
    return { summary, location: null };
  }

  // Country-only (or unresolved place) — use static centroid, skip Mapbox
  if (!locationName && countryCode) {
    const centroid = COUNTRY_CENTROIDS[countryCode.toUpperCase()];
    return {
      summary,
      location: {
        locationName: "",
        countryCode,
        regionLabel,
        lat: centroid?.lat ?? null,
        lng: centroid?.lng ?? null,
      },
    };
  }

  // Full location — geocode via Mapbox, fall back to country centroid on failure
  const mapboxToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
  if (!mapboxToken) {
    throw new Error("Missing env var: NEXT_PUBLIC_MAPBOX_TOKEN");
  }

  let lat: number | null = null;
  let lng: number | null = null;

  try {
    const encoded = encodeURIComponent(locationName!);
    const response = await fetchWithRetry<MapboxGeocodingResponse>({
      url: `https://api.mapbox.com/geocoding/v5/mapbox.places/${encoded}.json`,
      params: {
        access_token: mapboxToken,
        limit: 1,
        types: "country,region,place,locality",
      },
    });
    const feature = response.data.features[0];
    if (feature) {
      [lng, lat] = feature.center;
    }
  } catch (err) {
    console.error(`[processArticle] Mapbox failed for "${locationName}":`, err);
  }

  // Fall back to country centroid if Mapbox didn't resolve
  if ((lat === null || lng === null) && countryCode) {
    const centroid = COUNTRY_CENTROIDS[countryCode.toUpperCase()];
    if (centroid) {
      lat = centroid.lat;
      lng = centroid.lng;
    }
  }

  return {
    summary,
    location: {
      locationName: locationName!,
      countryCode: countryCode ?? "",
      regionLabel,
      lat,
      lng,
    },
  };
}
