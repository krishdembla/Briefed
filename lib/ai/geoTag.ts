import fs from "fs";
import path from "path";
import { anthropic, CLAUDE_MODEL } from "./client";
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

// Extracts a location name from the article via Claude, then resolves
// it to lat/lng using the Mapbox Geocoding API.
// Returns null fields if the article has no clear location.
export async function geoTagArticle(
  headline: string,
  body: string
): Promise<(ExtractedLocation & { lat: number | null; lng: number | null }) | null> {
  const bodyExcerpt = body.slice(0, 500); // keep prompt cost low

  const prompt = GEO_TAG_PROMPT
    .replace("{{headline}}", headline)
    .replace("{{bodyExcerpt}}", bodyExcerpt);

  // Step 1 — ask Claude to extract the location name
  let extracted: { locationName: string | null; countryCode: string | null; regionLabel: string | null };
  try {
    const message = await anthropic.messages.create({
      model: CLAUDE_MODEL,
      max_tokens: 150,
      messages: [{ role: "user", content: prompt }],
    });

    const raw = message.content[0].type === "text" ? message.content[0].text : "";
    console.log(`[geoTag] Claude raw output for "${headline.slice(0, 60)}...": ${raw}`);
    extracted = JSON.parse(raw);
  } catch (err) {
    console.error(`[geoTag] Claude call failed for headline "${headline.slice(0, 60)}":`, err);
    return null;
  }

  if (!extracted.locationName || !extracted.countryCode) {
    // Article has no clear location — this is valid, not an error
    return {
      locationName: "",
      countryCode: extracted.countryCode ?? "",
      regionLabel: extracted.regionLabel ?? "",
      lat: null,
      lng: null,
    };
  }

  // Step 2 — geocode the location name via Mapbox
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
    // Fall through — we still return the location name even without coordinates
  }

  return {
    locationName: extracted.locationName,
    countryCode: extracted.countryCode,
    regionLabel: extracted.regionLabel ?? "",
    lat,
    lng,
  };
}
