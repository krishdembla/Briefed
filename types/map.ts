import type { PinTopic } from "./pipeline";

// Shape of a pin as returned by GET /api/pins
export interface MapPin {
  id: string;
  headline: string;
  summary: string | null;
  stat_1: string | null;
  stat_2: string | null;
  stat_3: string | null;
  topic: PinTopic | null;
  source_name: string;
  source_url: string;
  published_at: string;
  lat: number;
  lng: number;
  country_code: string | null;
  region_label: string | null;
}

export type TopicFilter = PinTopic | "all";

export const TOPIC_COLORS: Record<string, string> = {
  politics: "#3b82f6",
  economy: "#22c55e",
  conflict: "#ef4444",
  health: "#ec4899",
  climate: "#14b8a6",
  tech: "#a855f7",
  other: "#94a3b8",
};

export const TOPIC_LABELS: Record<string, string> = {
  all: "All",
  politics: "Politics",
  economy: "Economy",
  conflict: "Conflict",
  health: "Health",
  climate: "Climate",
  tech: "Tech",
  other: "Other",
};
