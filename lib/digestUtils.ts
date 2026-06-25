export type DigestPin = { headline: string; topic: string | null; region_label: string | null };

const TOPIC_LABELS: Record<string, string> = {
  politics: "Politics", economy: "Economy", conflict: "Conflict",
  health: "Health", climate: "Climate", tech: "Tech", other: "News",
};

// Scores and ranks pins by topic preference; returns top 4.
export function selectDigestPins(pins: DigestPin[], userTopics: string[]): DigestPin[] {
  if (userTopics.length === 0) return pins.slice(0, 4);
  const topicSet = new Set(userTopics);
  return [...pins]
    .map((pin, i) => ({
      pin,
      score: (topicSet.has(pin.topic ?? "") ? 3 : 1) + Math.max(0, 1 - i * 0.02),
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 4)
    .map((x) => x.pin);
}

// Builds a subject line that reflects the user's matched topics.
export function buildSubject(pins: DigestPin[], userTopics: string[]): string {
  if (userTopics.length === 0) return "Your world this morning";
  const topicSet = new Set(userTopics);
  const matchedTopics = [...new Set(
    pins.map((p) => p.topic ?? "other").filter((t) => topicSet.has(t))
  )];
  if (matchedTopics.length === 0) return "Your world this morning";
  if (matchedTopics.length === 1) {
    return `Your ${TOPIC_LABELS[matchedTopics[0]] ?? matchedTopics[0]} briefing this morning`;
  }
  const [a, b] = matchedTopics;
  return `Your ${TOPIC_LABELS[a] ?? a} & ${TOPIC_LABELS[b] ?? b} briefing`;
}
