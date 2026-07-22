import type { PinTopic } from "./pipeline";

// Shape of a pin as returned by GET /api/pins
export interface MapPin {
  id: string;
  headline: string;
  summary: string | null;
  stat_1: string | null;
  stat_2: string | null;
  stat_3: string | null;
  why_it_matters: string | null;
  og_image_url: string | null;
  topic: PinTopic | null;
  tags: string[] | null;
  source_name: string;
  source_url: string;
  published_at: string;
  lat: number;
  lng: number;
  country_code: string | null;
  region_label: string | null;
  related_count?: number;
  // Market-impact fields (feature 2). Optional so endpoints that predate the
  // feature can still return valid MapPin objects — the chart just won't show.
  tickers?: string[];
  market_relevance?: "high" | "medium" | "low" | "none" | null;
}

export type TopicFilter = PinTopic | "all" | "foryou" | "trending";

// Muted, desaturated editorial palette — sophisticated ink tones rather than
// saturated primaries. Used as small dots and subtle tints, never loud fills.
export const TOPIC_COLORS: Record<string, string> = {
  politics: "#3e5c7e", // dusty blue
  economy: "#4f7050",  // sage green
  conflict: "#9e4a3c", // brick red
  health: "#8a5670",   // muted plum
  climate: "#3f736a",  // deep teal
  tech: "#63558a",     // muted violet
  sports: "#a9762f",   // ochre
  other: "#7a756b",    // warm grey
};

export const TOPIC_LABELS: Record<string, string> = {
  foryou: "For You",
  trending: "Trending",
  all: "All",
  politics: "Politics",
  economy: "Economy",
  conflict: "Conflict",
  health: "Health",
  climate: "Climate",
  tech: "Tech",
  sports: "Sports",
  other: "Other",
};
