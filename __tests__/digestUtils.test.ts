import { describe, it, expect } from "vitest";
import { selectDigestPins, buildSubject, type DigestPin } from "../lib/digestUtils";

const makePins = (topics: string[]): DigestPin[] =>
  topics.map((topic, i) => ({ headline: `Headline ${i}`, topic, region_label: null }));

describe("selectDigestPins", () => {
  it("returns up to 4 pins when no user topics set", () => {
    const pins = makePins(["politics", "tech", "climate", "health", "economy"]);
    expect(selectDigestPins(pins, [])).toHaveLength(4);
  });

  it("prioritises pins matching user topics", () => {
    const pins = makePins(["tech", "tech", "politics", "climate", "economy"]);
    const result = selectDigestPins(pins, ["climate", "economy"]);
    const topics = result.map((p) => p.topic);
    // Both climate and economy should appear before two tech pins
    expect(topics).toContain("climate");
    expect(topics).toContain("economy");
  });

  it("returns at most 4 pins even when input is large", () => {
    const pins = makePins(Array(20).fill("politics"));
    expect(selectDigestPins(pins, ["politics"])).toHaveLength(4);
  });

  it("handles null topic gracefully", () => {
    const pins: DigestPin[] = [
      { headline: "A", topic: null, region_label: null },
      { headline: "B", topic: "tech", region_label: null },
    ];
    expect(() => selectDigestPins(pins, ["tech"])).not.toThrow();
  });
});

describe("buildSubject", () => {
  it("returns generic subject when no user topics", () => {
    const pins = makePins(["politics"]);
    expect(buildSubject(pins, [])).toBe("Your world this morning");
  });

  it("returns generic subject when no topic match", () => {
    const pins = makePins(["tech"]);
    expect(buildSubject(pins, ["climate"])).toBe("Your world this morning");
  });

  it("names the topic when exactly one matches", () => {
    const pins = makePins(["climate", "tech"]);
    expect(buildSubject(pins, ["climate"])).toBe("Your Climate briefing this morning");
  });

  it("names two topics when two match", () => {
    const pins = makePins(["climate", "tech"]);
    const subject = buildSubject(pins, ["climate", "tech"]);
    expect(subject).toContain("Climate");
    expect(subject).toContain("Tech");
  });
});
