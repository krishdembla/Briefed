import { describe, it, expect, vi, afterEach } from "vitest";
import { computeStreak } from "../lib/streak";

// Fix "today" so tests aren't date-sensitive
const FAKE_NOW = new Date("2024-06-10T12:00:00Z").getTime();

afterEach(() => vi.useRealTimers());

function withFakeNow(fn: () => void) {
  vi.useFakeTimers();
  vi.setSystemTime(FAKE_NOW);
  fn();
}

describe("computeStreak", () => {
  it("returns 0 for empty date list", () => {
    withFakeNow(() => {
      expect(computeStreak([])).toBe(0);
    });
  });

  it("returns 0 when yesterday is not in the list", () => {
    withFakeNow(() => {
      // Only has today, not yesterday (2024-06-09)
      expect(computeStreak(["2024-06-10"])).toBe(0);
    });
  });

  it("returns 1 for a single check-in yesterday", () => {
    withFakeNow(() => {
      expect(computeStreak(["2024-06-09"])).toBe(1);
    });
  });

  it("counts consecutive days ending at yesterday", () => {
    withFakeNow(() => {
      expect(computeStreak(["2024-06-07", "2024-06-08", "2024-06-09"])).toBe(3);
    });
  });

  it("stops at the first gap", () => {
    withFakeNow(() => {
      // Gap at 2024-06-06 (not included)
      expect(computeStreak(["2024-06-05", "2024-06-07", "2024-06-08", "2024-06-09"])).toBe(3);
    });
  });

  it("does not count today even if present", () => {
    withFakeNow(() => {
      expect(computeStreak(["2024-06-08", "2024-06-09", "2024-06-10"])).toBe(2);
    });
  });
});
