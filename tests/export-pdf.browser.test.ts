import { describe, it, expect, afterAll } from "vitest";
import * as fs from "fs";
import { exportSessionPdf } from "../src/lib/export-pdf";
import { buildExportFilename } from "../src/lib/export-filename";
import type { Session, Topic } from "@shared/schema";

type SessionWithTopics = Session & { topics: Topic[] };

// A maximally-populated session — every optional section has data, so this exercises
// every branch added for BL-011 parity (Requirements, Pain Points, SIPOC with links,
// BANT, Methodology, Competitor Mentions, Timeline Signals, Risk Flags) in one pass.
function makeFullSession(): SessionWithTopics {
  return {
    id: 1,
    title: "Full Coverage Export Test",
    clientName: "Northgate Group",
    industry: "Retail",
    status: "completed",
    totalTopics: 1,
    transcript: "[Rachel Torres] Good morning everyone.\n\n[Pat Singh] Hi Rachel, here's the update.",
    overallSentiment: 10,
    sentimentData: [],
    actionItems: [{ text: "Send proposal", assignee: "Alex", priority: "high" }],
    followUpQuestions: [{ question: "What's the budget?", context: "Needed for BANT" }],
    speakers: [{ name: "Rachel Torres", role: "host" }],
    similarProjectMatches: [{ projectId: 1, relevance: "similar tech stack", title: "Prior Project" }],
    bantData: {
      budget: { value: "$600K", evidence: "board approved", firstHeard: "", lastUpdated: "", history: [] },
      authority: null, needs: null, timeline: null,
    },
    methodologyProgress: {
      methodology: "meddic",
      stages: [{ id: "metrics", name: "Metrics", completed: true }, { id: "champion", name: "Champion", completed: false }],
      lastUpdated: "",
    },
    competitorMentions: [{ name: "Datadog", context: "used for monitoring" }],
    timelineSignals: [{ date: "Q3 2026", context: "go-live target", urgency: "high" }],
    riskFlags: [{ text: "Vendor dependency", type: "blocker" }],
    requirements: [{ text: "Must support SSO", source: "Rachel" }],
    painPoints: [{ text: "Manual re-entry causes errors", impact: "Delays payments" }],
    sipocData: {
      suppliers: [{ text: "Acme Corp" }, { text: "Beacon Logistics" }],
      inputs: [{ text: "Invoices" }],
      process: [], outputs: [], customers: [],
      links: [{ supplier: "Acme Corp", input: "Invoices" }],
      lastUpdated: "2026-01-01T00:00:00.000Z",
    },
    summary: "A productive discovery call covering budget, requirements, and next steps.",
    createdAt: new Date("2026-01-01T10:00:00.000Z"),
    endedAt: new Date("2026-01-01T10:30:00.000Z"),
    topics: [
      { id: 1, sessionId: 1, term: "Kubernetes", definition: "Container orchestration", category: "infrastructure", type: "tool", capabilitySource: "in-house", partnerName: null, mentionCount: 1, firstMentionedAt: new Date() },
    ],
  } as unknown as SessionWithTopics;
}

// jsPDF's doc.save() falls back to a real fs write when no browser download mechanism
// is available (as under jsdom/Node) — so these tests genuinely write a file. Since both
// sessions below share the same title/client/date, they produce the one known filename;
// clean it up afterward rather than mocking jsPDF's internals (which assign `save` per
// instance inside the constructor, not on a mockable prototype).
const generatedFile = `${buildExportFilename(makeFullSession())}.pdf`;
afterAll(() => {
  if (fs.existsSync(generatedFile)) fs.unlinkSync(generatedFile);
});

describe("exportSessionPdf", () => {
  it("generates a PDF without throwing when every section has data", () => {
    expect(() => exportSessionPdf(makeFullSession())).not.toThrow();
  });

  it("generates a PDF without throwing for a bare session with no optional data", () => {
    const bare = {
      ...makeFullSession(),
      actionItems: null, followUpQuestions: null, speakers: null, similarProjectMatches: null,
      bantData: null, methodologyProgress: null, competitorMentions: null, timelineSignals: null,
      riskFlags: null, requirements: null, painPoints: null, sipocData: null, summary: null,
      transcript: "", topics: [],
    } as unknown as SessionWithTopics;
    expect(() => exportSessionPdf(bare)).not.toThrow();
  });
});
