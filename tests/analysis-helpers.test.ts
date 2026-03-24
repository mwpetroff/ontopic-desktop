import { describe, it, expect } from "vitest";
import { resolveSpeaker, aggregateSentiment, accumulateSimilarProjects, updateSpeakersList, mergeBantData, applyMethodologyStageUpdates, persistSessionUpdates } from "../server/analysis-helpers";
import { DatabaseStorage } from "../server/storage";
import type { AnalysisResult } from "../server/services/analysis";
import type { SentimentEntry, SpeakerEntry, ReferenceProject } from "@shared/schema";
import { consolidateSimilarProjects } from "@shared/schema";

describe("resolveSpeaker", () => {
  it("uses voice match when confidence >= 0.55", () => {
    const result = resolveSpeaker("SomeAISpeaker", ["Speaker 1"], { name: "John Doe", title: "CTO", confidence: 0.7 });
    expect(result.speaker).toBe("John Doe");
  });

  it("ignores voice match when confidence < 0.55", () => {
    const result = resolveSpeaker("SomeAISpeaker", [], { name: "John Doe", confidence: 0.3 });
    expect(result.speaker).toBe("SomeAISpeaker");
  });

  it("falls back to last speaker for NEW_SPEAKER with few named speakers", () => {
    const result = resolveSpeaker("NEW_SPEAKER", ["Alice"]);
    expect(result.speaker).toBe("Alice");
  });

  it("creates new numbered speaker when no known speakers exist", () => {
    const result = resolveSpeaker(null, []);
    expect(result.speaker).toBe("Speaker 1");
  });

  it("falls back to last speaker when AI returns null", () => {
    const result = resolveSpeaker(null, ["Bob", "Alice"]);
    expect(result.speaker).toBe("Alice");
  });

  it("keeps existing numbered speaker for NEW_SPEAKER when last speaker is numbered", () => {
    const result = resolveSpeaker("NEW_SPEAKER", ["Speaker 1"]);
    expect(result.speaker).toBe("Speaker 1");
  });

  it("assigns next speaker number when multiple named speakers exist", () => {
    const result = resolveSpeaker("NEW_SPEAKER", ["Alice", "Bob"]);
    expect(result.speaker).toBe("Speaker 1");
  });

  it("treats 'null' string same as null", () => {
    const result = resolveSpeaker("null", []);
    expect(result.speaker).toBe("Speaker 1");
  });

  it("preserves valid AI speaker name when no voice match", () => {
    const result = resolveSpeaker("Jane Smith", ["Speaker 1"]);
    expect(result.speaker).toBe("Jane Smith");
  });
});

describe("aggregateSentiment", () => {
  const makeAnalysis = (score: number, label: string): AnalysisResult => ({
    terms: [], sentiment: { score, label }, speaker: null, speakerTitle: null,
    actionItems: [], followUpQuestions: [], similarProjects: [],
  });

  it("creates first sentiment entry with correct chunk index", () => {
    const result = aggregateSentiment([], makeAnalysis(75, "positive"), "Alice");
    expect(result.newEntry.chunkIndex).toBe(0);
    expect(result.newEntry.score).toBe(75);
    expect(result.newEntry.label).toBe("positive");
    expect(result.newEntry.speaker).toBe("Alice");
  });

  it("appends to existing sentiment data", () => {
    const existing: SentimentEntry[] = [{ chunkIndex: 0, score: 50, label: "neutral", speaker: "Bob" }];
    const result = aggregateSentiment(existing, makeAnalysis(80, "positive"), "Alice");
    expect(result.allSentiment).toHaveLength(2);
    expect(result.newEntry.chunkIndex).toBe(1);
  });

  it("calculates overall sentiment as average", () => {
    const existing: SentimentEntry[] = [{ chunkIndex: 0, score: 60, label: "neutral" }];
    const result = aggregateSentiment(existing, makeAnalysis(80, "positive"), null);
    expect(result.overallSentiment).toBe(70);
  });

  it("defaults to neutral with score 0 when analysis has no sentiment", () => {
    const analysis: AnalysisResult = {
      terms: [], sentiment: undefined as any, speaker: null, speakerTitle: null,
      actionItems: [], followUpQuestions: [], similarProjects: [],
    };
    const result = aggregateSentiment([], analysis, null);
    expect(result.newEntry.score).toBe(0);
    expect(result.newEntry.label).toBe("neutral");
  });
});

describe("accumulateSimilarProjects", () => {
  const makeRefProject = (id: number, title: string): ReferenceProject => ({
    id, title, description: `Desc for ${title}`, url: null,
    tags: ["tag1"], industry: "Tech", clientName: "Client",
    createdAt: new Date(), projectDate: new Date("2024-06-01"),
  });

  it("adds new matches that don't already exist", () => {
    const result = accumulateSimilarProjects(
      [{ projectId: 1, relevance: "high" }],
      [{ projectId: 2, relevance: "medium" }],
      [makeRefProject(1, "P1"), makeRefProject(2, "P2")]
    );
    expect(result).toHaveLength(2);
    expect(result[1].projectId).toBe(2);
    expect(result[1].title).toBe("P2");
  });

  it("deduplicates matches by projectId", () => {
    const result = accumulateSimilarProjects(
      [{ projectId: 1, relevance: "high" }],
      [{ projectId: 1, relevance: "medium" }],
      [makeRefProject(1, "P1")]
    );
    expect(result).toHaveLength(1);
    expect(result[0].relevance).toBe("high");
  });

  it("handles empty existing matches", () => {
    const result = accumulateSimilarProjects([], [{ projectId: 1, relevance: "high" }], [makeRefProject(1, "P1")]);
    expect(result).toHaveLength(1);
  });

  it("handles empty new matches", () => {
    const result = accumulateSimilarProjects([{ projectId: 1, relevance: "high" }], [], []);
    expect(result).toHaveLength(1);
  });
});

describe("updateSpeakersList", () => {
  it("adds new speaker to empty list as guest by default", () => {
    const result = updateSpeakersList([], "Alice", "CEO");
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({ name: "Alice", title: "CEO", role: "guest" });
  });

  it("adds new speaker as host when isHost is true", () => {
    const result = updateSpeakersList([], "Alice", "CEO", true);
    expect(result[0]).toEqual({ name: "Alice", title: "CEO", role: "host" });
  });

  it("updates title for existing speaker without title", () => {
    const existing: SpeakerEntry[] = [{ name: "Alice", role: "guest" }];
    const result = updateSpeakersList(existing, "Alice", "CTO");
    expect(result[0].title).toBe("CTO");
  });

  it("does not overwrite existing title", () => {
    const existing: SpeakerEntry[] = [{ name: "Alice", title: "CEO", role: "guest" }];
    const result = updateSpeakersList(existing, "Alice", "CTO");
    expect(result[0].title).toBe("CEO");
  });

  it("does not add entry for null speaker", () => {
    const existing: SpeakerEntry[] = [{ name: "Alice", role: "guest" }];
    expect(updateSpeakersList(existing, null, null)).toHaveLength(1);
  });

  it("promotes existing guest to host when isHost is true", () => {
    const existing: SpeakerEntry[] = [{ name: "Alice", title: "PM", role: "guest" }];
    const result = updateSpeakersList(existing, "Alice", null, true);
    expect(result[0].role).toBe("host");
  });

  it("does not demote host when isHost is false", () => {
    const existing: SpeakerEntry[] = [{ name: "Alice", role: "host" }];
    const result = updateSpeakersList(existing, "Alice", null, false);
    expect(result[0].role).toBe("host");
  });
});

describe("Zod PATCH validation schemas", () => {
  const { z } = require("zod");

  const updateSessionSchema = z.object({
    title: z.string().min(1).optional(),
    clientName: z.string().nullable().optional(),
    industry: z.string().nullable().optional(),
    status: z.enum(["active", "completed"]).optional(),
  });

  describe("updateSessionSchema", () => {
    it("accepts valid partial update", () => {
      expect(updateSessionSchema.safeParse({ title: "New Title" }).success).toBe(true);
    });
    it("rejects empty title", () => {
      expect(updateSessionSchema.safeParse({ title: "" }).success).toBe(false);
    });
    it("rejects invalid status", () => {
      expect(updateSessionSchema.safeParse({ status: "paused" }).success).toBe(false);
    });
    it("accepts empty object", () => {
      expect(updateSessionSchema.safeParse({}).success).toBe(true);
    });
  });

  describe("consolidateSimilarProjects", () => {
    it("returns empty array for empty input", () => {
      expect(consolidateSimilarProjects([])).toEqual([]);
    });

    it("returns single item unchanged", () => {
      const input = [{ projectId: 1, relevance: "relevant", title: "Project A" }];
      expect(consolidateSimilarProjects(input)).toEqual(input);
    });

    it("consolidates entries with the same title", () => {
      const input = [
        { projectId: 1, relevance: "First reason.", title: "Contoso Cloud", industry: "Manufacturing", clientName: "Contoso" },
        { projectId: 5, relevance: "Second reason.", title: "Contoso Cloud" },
      ];
      const result = consolidateSimilarProjects(input);
      expect(result).toHaveLength(1);
      expect(result[0].relevance).toContain("First reason.");
      expect(result[0].relevance).toContain("Second reason.");
      expect(result[0].industry).toBe("Manufacturing");
    });

    it("is case-insensitive when matching titles", () => {
      const input = [
        { projectId: 1, relevance: "Reason A.", title: "contoso cloud" },
        { projectId: 2, relevance: "Reason B.", title: "Contoso Cloud" },
      ];
      expect(consolidateSimilarProjects(input)).toHaveLength(1);
    });

    it("keeps distinct projects separate", () => {
      const input = [
        { projectId: 1, relevance: "A", title: "Project Alpha" },
        { projectId: 2, relevance: "B", title: "Project Beta" },
      ];
      expect(consolidateSimilarProjects(input)).toHaveLength(2);
    });

    it("deduplicates identical relevance strings", () => {
      const input = [
        { projectId: 1, relevance: "Same reason.", title: "Dup Project" },
        { projectId: 2, relevance: "Same reason.", title: "Dup Project" },
      ];
      const result = consolidateSimilarProjects(input);
      expect(result).toHaveLength(1);
      expect(result[0].relevance).toBe("Same reason.");
    });
  });
});

describe("mergeBantData", () => {
  const ts = "2024-01-01T00:00:00.000Z";

  it("returns null when update is null and existing is null", () => {
    expect(mergeBantData(null, null, ts)).toBeNull();
  });

  it("sets a BANT field when no existing data", () => {
    const result = mergeBantData(null, { budget: { value: "$600K", evidence: "We have 600K budgeted" } }, ts);
    expect(result?.budget?.value).toBe("$600K");
    expect(result?.budget?.history).toHaveLength(0);
  });

  it("ignores fields with null/empty string value", () => {
    expect(mergeBantData(null, { budget: { value: "null", evidence: "" } }, ts)?.budget).toBeNull();
  });

  it("moves old value to history when value changes", () => {
    const oldTs = "2024-01-01T00:00:00.000Z";
    const newTs = "2024-01-02T00:00:00.000Z";
    const existing = {
      budget: { value: "$600K", evidence: "budgeted", firstHeard: oldTs, lastUpdated: oldTs, history: [] },
      authority: null, needs: null, timeline: null,
    };
    const result = mergeBantData(existing, { budget: { value: "$750K", evidence: "revised" } }, newTs);
    expect(result?.budget?.value).toBe("$750K");
    expect(result?.budget?.history).toHaveLength(1);
  });

  it("updates multiple BANT fields in one call", () => {
    const result = mergeBantData(null, {
      budget: { value: "$1M", evidence: "big budget" },
      authority: { value: "CEO", evidence: "Jennifer said so" },
      needs: { value: "Pipeline visibility", evidence: "mentioned twice" },
      timeline: { value: "Q3 2024", evidence: "August target" },
    }, ts);
    expect(result?.budget?.value).toBe("$1M");
    expect(result?.authority?.value).toBe("CEO");
    expect(result?.needs?.value).toBe("Pipeline visibility");
    expect(result?.timeline?.value).toBe("Q3 2024");
  });
});

// ─── persistSessionUpdates ────────────────────────────────────────────────────
// This function writes to the real test DB (see tests/setup.ts).
// Key regression: better-sqlite3 is synchronous — db.transaction(async cb) throws
// "Transaction function cannot return a promise". These tests catch that immediately.

describe("persistSessionUpdates", () => {
  const storage = new DatabaseStorage();

  async function makeSession() {
    return storage.createSession({ title: "Persist Test", clientName: "Acme", industry: "tech" });
  }

  it("writes transcript to a fresh session", async () => {
    const session = await makeSession();
    await persistSessionUpdates(
      session.id,
      { totalTopics: 0, sentimentData: [], overallSentiment: 0, speakers: [] },
      "Alice: Hello world.",
      "Alice: Hello world."
    );
    const updated = await storage.getSession(session.id);
    expect(updated?.transcript).toBe("Alice: Hello world.");
  });

  it("appends a second chunk without duplicating text", async () => {
    const session = await makeSession();
    await persistSessionUpdates(
      session.id,
      { totalTopics: 0, sentimentData: [], overallSentiment: 0, speakers: [] },
      "Alice: Chunk one.",
      "Alice: Chunk one."
    );
    await persistSessionUpdates(
      session.id,
      { totalTopics: 0, sentimentData: [], overallSentiment: 0, speakers: [] },
      "Bob: Chunk two.",
      "Bob: Chunk two."
    );
    const updated = await storage.getSession(session.id);
    expect(updated?.transcript).toContain("Alice: Chunk one.");
    expect(updated?.transcript).toContain("Bob: Chunk two.");
    // Chunk one should not appear twice
    expect(updated?.transcript?.split("Alice: Chunk one.").length).toBe(2);
  });

  it("persists sentiment data", async () => {
    const session = await makeSession();
    const sentimentData = [{ chunkIndex: 0, score: 75, label: "positive", speaker: "Alice" }];
    await persistSessionUpdates(
      session.id,
      { totalTopics: 1, sentimentData, overallSentiment: 75, speakers: [{ name: "Alice", role: "host" as const }] },
      "Alice: Great meeting.",
      "Alice: Great meeting."
    );
    const updated = await storage.getSession(session.id);
    expect(updated?.overallSentiment).toBe(75);
    expect(updated?.sentimentData).toHaveLength(1);
    expect(updated?.speakers).toHaveLength(1);
    expect(updated?.speakers[0].name).toBe("Alice");
  });

  it("throws for a non-existent session ID", async () => {
    await expect(
      persistSessionUpdates(
        999999,
        { totalTopics: 0, sentimentData: [], overallSentiment: 0, speakers: [] },
        "Ghost text",
        "Ghost text"
      )
    ).rejects.toThrow("Session 999999 not found");
  });
});

describe("applyMethodologyStageUpdates", () => {
  const ts = "2024-01-01T00:00:00.000Z";
  const spinStages = [
    { id: "situation", name: "Situation", description: "Establish context" },
    { id: "problem", name: "Problem", description: "Uncover problems" },
    { id: "implication", name: "Implication", description: "Explore impact" },
    { id: "need-payoff", name: "Need-Payoff", description: "Show value" },
  ];

  it("initializes all stages as not completed on first call", () => {
    const result = applyMethodologyStageUpdates(null, [], "spin", spinStages, ts);
    expect(result.methodology).toBe("spin");
    expect(result.stages).toHaveLength(4);
    expect(result.stages.every(s => !s.completed)).toBe(true);
  });

  it("marks stages as completed when stage IDs are provided", () => {
    const result = applyMethodologyStageUpdates(null, ["situation", "problem"], "spin", spinStages, ts);
    expect(result.stages.find(s => s.id === "situation")?.completed).toBe(true);
    expect(result.stages.find(s => s.id === "implication")?.completed).toBe(false);
  });

  it("resets stages when methodology changes", () => {
    const existing: any = { methodology: "meddic", stages: [{ id: "metrics", name: "Metrics", completed: true }], lastUpdated: ts };
    const result = applyMethodologyStageUpdates(existing, ["situation"], "spin", spinStages, ts);
    expect(result.methodology).toBe("spin");
    expect(result.stages).toHaveLength(4);
  });

  it("ignores unknown stage IDs gracefully", () => {
    const result = applyMethodologyStageUpdates(null, ["unknown-stage"], "spin", spinStages, ts);
    expect(result.stages.every(s => !s.completed)).toBe(true);
  });
});
