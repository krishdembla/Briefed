// Normalized article from any news source, before AI processing
export interface RawArticle {
  sourceUrl: string;
  sourceName: string;
  headline: string;
  body: string; // full text or best available excerpt
  publishedAt: string; // ISO 8601
}

// AI-extracted location before geocoding
export interface ExtractedLocation {
  locationName: string; // e.g. "Kyiv, Ukraine"
  countryCode: string; // ISO 3166-1 alpha-2, e.g. "UA"
  regionLabel: string; // e.g. "Eastern Europe"
}

// What Claude's summarize call returns
export interface AISummary {
  summary: string;
  stat1: string;
  stat2: string;
  stat3: string;
  topic: PinTopic;
}

export type PinTopic =
  | "politics"
  | "economy"
  | "climate"
  | "conflict"
  | "health"
  | "tech"
  | "other";

// A fully processed pin ready for Supabase insertion
export interface Pin {
  source_url: string;
  source_name: string;
  published_at: string;
  headline: string;
  raw_body: string;
  summary: string | null;
  stat_1: string | null;
  stat_2: string | null;
  stat_3: string | null;
  lat: number | null;
  lng: number | null;
  country_code: string | null;
  region_label: string | null;
  topic: PinTopic | null;
  pipeline_run_id: string;
  ai_processed: boolean;
  geo_processed: boolean;
}
