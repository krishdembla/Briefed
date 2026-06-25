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

const VALID_TOPICS: PinTopic[] = [
  "politics", "economy", "climate", "conflict", "health", "tech", "other",
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
    const raw = await callLLM(prompt, 800);
    console.log(`[processArticle] raw output for "${headline.slice(0, 60)}...": ${raw}`);
    const text = raw.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
    parsed = JSON.parse(text);
  } catch (err) {
    console.error(`[processArticle] LLM call failed for "${headline.slice(0, 60)}":`, err);
    // Graceful fallback — pin is still stored, just without AI enrichment
    return {
      summary: { summary: headline, stat1: "", stat2: "", stat3: "", topic: "other" },
      location: null,
    };
  }

  const summaryText = (parsed.summary as string) || headline;
  const topic = parsed.topic && isValidTopic(parsed.topic as string)
    ? (parsed.topic as PinTopic)
    : "other";

  const summary: AISummary = {
    summary: summaryText,
    stat1: (parsed.stat1 as string) || "",
    stat2: (parsed.stat2 as string) || "",
    stat3: (parsed.stat3 as string) || "",
    topic,
  };

  const locationName = parsed.locationName as string | null;
  const countryCode = parsed.countryCode as string | null;
  const regionLabel = (parsed.regionLabel as string) || "";

  // No geo at all
  if (!locationName && !countryCode) {
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
