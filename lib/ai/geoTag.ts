import fs from "fs";
import path from "path";
import { callLLM } from "./client";
import { fetchWithRetry } from "@/lib/fetchWithRetry";
import type { ExtractedLocation } from "@/types/pipeline";

const GEO_TAG_PROMPT = fs.readFileSync(
  path.join(process.cwd(), "prompts/geo-tag.txt"),
  "utf-8"
);

interface MapboxFeature {
  center: [number, number]; // [lng, lat]
  place_name: string;
}

interface MapboxGeocodingResponse {
  features: MapboxFeature[];
}

// Extracts a location name from the article via LLM, then resolves
// it to lat/lng using the Mapbox Geocoding API.
// Returns null fields if the article has no clear location.
export async function geoTagArticle(
  headline: string,
  body: string
): Promise<(ExtractedLocation & { lat: number | null; lng: number | null }) | null> {
  const bodyExcerpt = body.slice(0, 500);

  const prompt = GEO_TAG_PROMPT
    .replace("{{headline}}", headline)
    .replace("{{bodyExcerpt}}", bodyExcerpt);

  let extracted: { locationName: string | null; countryCode: string | null; regionLabel: string | null };
  try {
    const raw = await callLLM(prompt, 150);
    console.log(`[geoTag] raw output for "${headline.slice(0, 60)}...": ${raw}`);
    const text = raw.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
    extracted = JSON.parse(text);
  } catch (err) {
    console.error(`[geoTag] LLM call failed for headline "${headline.slice(0, 60)}":`, err);
    return null;
  }

  if (!extracted.locationName || !extracted.countryCode) {
    return {
      locationName: "",
      countryCode: extracted.countryCode ?? "",
      regionLabel: extracted.regionLabel ?? "",
      lat: null,
      lng: null,
    };
  }

  const mapboxToken = process.env.MAPBOX_PUBLIC_TOKEN;
  if (!mapboxToken) {
    throw new Error("Missing env var: MAPBOX_PUBLIC_TOKEN");
  }

  let lat: number | null = null;
  let lng: number | null = null;

  try {
    const encodedLocation = encodeURIComponent(extracted.locationName);
    const response = await fetchWithRetry<MapboxGeocodingResponse>({
      url: `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodedLocation}.json`,
      params: {
        access_token: mapboxToken,
        limit: 1,
        types: "country,region,place,locality",
      },
    });

    const feature = response.data.features[0];
    if (feature) {
      [lng, lat] = feature.center;
    } else {
      console.warn(`[geoTag] Mapbox returned no results for "${extracted.locationName}"`);
    }
  } catch (err) {
    console.error(`[geoTag] Mapbox geocoding failed for "${extracted.locationName}":`, err);
  }

  return {
    locationName: extracted.locationName,
    countryCode: extracted.countryCode,
    regionLabel: extracted.regionLabel ?? "",
    lat,
    lng,
  };
}
