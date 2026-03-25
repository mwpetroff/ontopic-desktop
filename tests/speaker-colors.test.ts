/**
 * speaker-colors unit tests (src/lib/speaker-colors.ts).
 */
import { describe, it, expect, beforeEach } from "vitest";
import { getSpeakerColor, getSpeakerColorByIndex, SPEAKER_COLORS } from "../src/lib/speaker-colors";

// ── getSpeakerColorByIndex ────────────────────────────────────────────────────

describe("getSpeakerColorByIndex", () => {
  it("returns the first color (blue) for index 0", () => {
    expect(getSpeakerColorByIndex(0)).toEqual(SPEAKER_COLORS[0]);
    expect(getSpeakerColorByIndex(0).text).toContain("blue");
  });

  it("returns the second color (emerald) for index 1", () => {
    expect(getSpeakerColorByIndex(1)).toEqual(SPEAKER_COLORS[1]);
    expect(getSpeakerColorByIndex(1).text).toContain("emerald");
  });

  it("wraps around when index equals the palette length", () => {
    expect(getSpeakerColorByIndex(SPEAKER_COLORS.length)).toEqual(SPEAKER_COLORS[0]);
  });

  it("wraps around for an index well beyond the palette length", () => {
    expect(getSpeakerColorByIndex(SPEAKER_COLORS.length + 3)).toEqual(SPEAKER_COLORS[3]);
  });

  it("returned object has both text and border properties", () => {
    const color = getSpeakerColorByIndex(0);
    expect(color).toHaveProperty("text");
    expect(color).toHaveProperty("border");
    expect(typeof color.text).toBe("string");
    expect(typeof color.border).toBe("string");
  });
});

// ── getSpeakerColor ───────────────────────────────────────────────────────────

describe("getSpeakerColor", () => {
  let speakerMap: Map<string, number>;

  beforeEach(() => {
    speakerMap = new Map();
  });

  it("assigns index 0 to the first new speaker", () => {
    const color = getSpeakerColor("Alice", speakerMap);
    expect(color).toEqual(SPEAKER_COLORS[0]);
  });

  it("assigns index 1 to the second new speaker", () => {
    getSpeakerColor("Alice", speakerMap);
    const color = getSpeakerColor("Bob", speakerMap);
    expect(color).toEqual(SPEAKER_COLORS[1]);
  });

  it("returns the same color for the same speaker name", () => {
    const first  = getSpeakerColor("Alice", speakerMap);
    const second = getSpeakerColor("Alice", speakerMap);
    expect(first).toEqual(second);
  });

  it("does not mutate map size on repeated calls for the same speaker", () => {
    getSpeakerColor("Alice", speakerMap);
    const sizeAfterFirst = speakerMap.size;
    getSpeakerColor("Alice", speakerMap);
    expect(speakerMap.size).toBe(sizeAfterFirst);
  });

  it("wraps back to color 0 for the (palette-length+1)-th unique speaker", () => {
    const names = Array.from({ length: SPEAKER_COLORS.length + 1 }, (_, i) => `Speaker${i}`);
    names.forEach(name => getSpeakerColor(name, speakerMap));
    // Last speaker wraps to index 0
    const wrappedColor = getSpeakerColor(names[SPEAKER_COLORS.length], speakerMap);
    expect(wrappedColor).toEqual(SPEAKER_COLORS[0]);
  });
});
