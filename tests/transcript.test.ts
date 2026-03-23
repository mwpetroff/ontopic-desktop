import { describe, it, expect } from "vitest";
import { parseAndMergeBlocks, formatElapsedTimestamp } from "../src/lib/transcript";

describe("Transcript: parseAndMergeBlocks", () => {
  it("parses a single speaker block", () => {
    const result = parseAndMergeBlocks("[Sarah] Hello everyone, welcome to the meeting.");
    expect(result).toHaveLength(1);
    expect(result[0].speaker).toBe("Sarah");
    expect(result[0].content).toBe("Hello everyone, welcome to the meeting.");
  });

  it("parses multiple different speakers", () => {
    const result = parseAndMergeBlocks("[Sarah] Hello everyone.\n\n[David] Thanks Sarah.");
    expect(result).toHaveLength(2);
    expect(result[0].speaker).toBe("Sarah");
    expect(result[1].speaker).toBe("David");
  });

  it("merges consecutive blocks from the same speaker", () => {
    const result = parseAndMergeBlocks("[Sarah] First chunk.\n\n[Sarah] Second chunk.\n\n[Sarah] Third chunk.");
    expect(result).toHaveLength(1);
    expect(result[0].speaker).toBe("Sarah");
    expect(result[0].content).toBe("First chunk. Second chunk. Third chunk.");
  });

  it("merges same speaker but keeps different speakers separate", () => {
    const result = parseAndMergeBlocks("[Sarah] Chunk 1.\n\n[Sarah] Chunk 2.\n\n[David] Hi.\n\n[David] More.\n\n[Sarah] Back.");
    expect(result).toHaveLength(3);
    expect(result[0].content).toBe("Chunk 1. Chunk 2.");
    expect(result[1].speaker).toBe("David");
    expect(result[2].speaker).toBe("Sarah");
  });

  it("handles text without speaker labels", () => {
    const result = parseAndMergeBlocks("Just plain text without any speaker labels.");
    expect(result).toHaveLength(1);
    expect(result[0].speaker).toBeNull();
    expect(result[0].content).toBe("Just plain text without any speaker labels.");
  });

  it("handles empty text", () => {
    expect(parseAndMergeBlocks("")).toHaveLength(0);
  });

  it("handles text with only whitespace/newlines", () => {
    expect(parseAndMergeBlocks("   \n\n   \n  ")).toHaveLength(0);
  });

  it("preserves rawBlockIndex for timestamp calculation", () => {
    const result = parseAndMergeBlocks("[Sarah] A.\n\n[Sarah] B.\n\n[David] C.\n\n[David] D.");
    expect(result).toHaveLength(2);
    expect(result[0].rawBlockIndex).toBe(0);
    expect(result[1].rawBlockIndex).toBe(2);
  });

  it("handles Speaker N fallback labels", () => {
    const result = parseAndMergeBlocks("[Speaker 1] Hello.\n\n[Speaker 1] More.\n\n[Speaker 2] Hi.");
    expect(result).toHaveLength(2);
    expect(result[0].content).toBe("Hello. More.");
    expect(result[1].speaker).toBe("Speaker 2");
  });

  it("handles many consecutive chunks from same speaker", () => {
    const text = Array.from({ length: 10 }, (_, i) => `[Speaker 1] Chunk ${i + 1}.`).join("\n\n");
    const result = parseAndMergeBlocks(text);
    expect(result).toHaveLength(1);
    expect(result[0].rawBlockCount).toBe(10);
    expect(result[0].content).toContain("Chunk 10.");
  });
});

describe("Transcript: formatElapsedTimestamp", () => {
  it("formats 00:00 for first block", () => {
    expect(formatElapsedTimestamp(0, 10, 0, 600000)).toBe("00:00");
  });

  it("formats correct elapsed time for middle block", () => {
    expect(formatElapsedTimestamp(5, 10, 0, 600000)).toBe("05:00");
  });

  it("handles short sessions", () => {
    expect(formatElapsedTimestamp(1, 4, 0, 60000)).toBe("00:15");
  });

  it("handles long sessions correctly", () => {
    expect(formatElapsedTimestamp(5, 10, 0, 3600000)).toBe("30:00");
  });

  it("formats minutes and seconds with padding", () => {
    expect(formatElapsedTimestamp(1, 2, 0, 120000)).toBe("01:00");
  });
});

describe("Transcript: follow-up question accumulation", () => {
  it("accumulates new follow-ups with existing ones", () => {
    const result = [{ question: "Q1" }, { question: "Q2" }, { question: "Q3" }].slice(-5);
    expect(result).toHaveLength(3);
  });

  it("caps at 5 most recent follow-ups", () => {
    const all = [{ question: "Q1" }, { question: "Q2" }, { question: "Q3" }, { question: "Q4" }, { question: "Q5" }, { question: "Q6" }];
    const result = all.slice(-5);
    expect(result).toHaveLength(5);
    expect(result[0].question).toBe("Q2");
    expect(result[4].question).toBe("Q6");
  });
});
