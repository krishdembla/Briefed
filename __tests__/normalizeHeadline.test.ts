import { describe, it, expect } from "vitest";
import { normalizeHeadline } from "../lib/normalizeHeadline";

describe("normalizeHeadline", () => {
  it("collapses the reported ASML punctuation-only duplicate", () => {
    // The exact pair from prod that clusterByEvent missed.
    const a = normalizeHeadline("Analysis-Could AI chip boom make ASML Europe's first trillion-dollar firm?");
    const b = normalizeHeadline("Analysis:Could AI chip boom make ASML Europe's first trillion-dollar firm?");
    expect(a).toBe(b);
    expect(a).toContain("could ai chip boom");
  });

  it("strips leading editorial prefixes", () => {
    expect(normalizeHeadline("Analysis: Foo bar")).toBe(normalizeHeadline("Foo bar"));
    expect(normalizeHeadline("Explainer: Foo bar")).toBe(normalizeHeadline("Foo bar"));
    expect(normalizeHeadline("BREAKING - Foo bar")).toBe(normalizeHeadline("Foo bar"));
    expect(normalizeHeadline("Update: Foo bar")).toBe(normalizeHeadline("Foo bar"));
  });

  it("strips trailing source attribution", () => {
    expect(normalizeHeadline("Ukraine strikes deep - Reuters")).toBe(
      normalizeHeadline("Ukraine strikes deep")
    );
    expect(normalizeHeadline("Foo | BBC News")).toBe(normalizeHeadline("Foo"));
    expect(normalizeHeadline("Fed holds rates — Bloomberg")).toBe(normalizeHeadline("Fed holds rates"));
  });

  it("is case-insensitive and punctuation-tolerant", () => {
    expect(normalizeHeadline("Fed Holds Rates!")).toBe(normalizeHeadline("fed holds rates"));
    expect(normalizeHeadline("It's here.")).toBe(normalizeHeadline("its here"));
  });

  it("returns empty string for empty input", () => {
    expect(normalizeHeadline("")).toBe("");
  });

  it("keeps unrelated headlines distinct", () => {
    expect(normalizeHeadline("ASML posts record earnings")).not.toBe(
      normalizeHeadline("ASML fires CEO")
    );
  });
});
