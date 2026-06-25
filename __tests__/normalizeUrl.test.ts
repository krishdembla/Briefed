import { describe, it, expect } from "vitest";
import { normalizeUrl } from "../lib/normalizeUrl";

describe("normalizeUrl", () => {
  it("lowercases the URL", () => {
    expect(normalizeUrl("https://Example.com/Article")).toBe("https://example.com/Article".toLowerCase());
  });

  it("strips utm_source", () => {
    const url = "https://bbc.com/news/world?utm_source=twitter&utm_medium=social";
    expect(normalizeUrl(url)).toBe("https://bbc.com/news/world");
  });

  it("strips all known tracking params", () => {
    const url = "https://reuters.com/story?utm_campaign=foo&fbclid=bar&gclid=baz&ref=homepage";
    expect(normalizeUrl(url)).toBe("https://reuters.com/story");
  });

  it("preserves non-tracking query params", () => {
    const url = "https://site.com/article?id=123&page=2";
    expect(normalizeUrl(url)).toBe("https://site.com/article?id=123&page=2");
  });

  it("returns lowercased original string when URL is malformed", () => {
    expect(normalizeUrl("not a url")).toBe("not a url");
    expect(normalizeUrl("ALSO NOT A URL")).toBe("also not a url");
  });
});
