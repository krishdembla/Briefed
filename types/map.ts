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
}

export type TopicFilter = PinTopic | "all" | "foryou" | "trending";

export const TOPIC_COLORS: Record<string, string> = {
  politics: "#3b82f6",
  economy: "#22c55e",
  conflict: "#ef4444",
  health: "#ec4899",
  climate: "#14b8a6",
  tech: "#a855f7",
  sports: "#f59e0b",
  other: "#94a3b8",
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
