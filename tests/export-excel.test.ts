import { describe, it, expect } from "vitest";
import { buildSessionWorkbook } from "../src/lib/export-excel";
import type { Session, Topic } from "@shared/schema";

type SessionWithTopics = Session & { topics: Topic[] };

function makeSession(overrides: Partial<SessionWithTopics> = {}): SessionWithTopics {
  return {
    id: 1,
    title: "Excel Export Test",
    clientName: "Northgate Group",
    industry: "Retail",
    status: "completed",
    totalTopics: 0,
    transcript: "",
    overallSentiment: null,
    sentimentData: null,
    actionItems: null,
    followUpQuestions: null,
    speakers: null,
    similarProjectMatches: null,
    bantData: null,
    methodologyProgress: null,
    competitorMentions: null,
    timelineSignals: null,
    riskFlags: null,
    requirements: null,
    painPoints: null,
    sipocData: null,
    summary: null,
    createdAt: new Date("2026-01-01T10:00:00.000Z"),
    endedAt: new Date("2026-01-01T10:30:00.000Z"),
    topics: [],
    ...overrides,
  } as SessionWithTopics;
}

describe("buildSessionWorkbook", () => {
  it("always includes Overview, Transcript, Key Terms, Action Items, Follow-Ups, and Similar Projects", () => {
    const workbook = buildSessionWorkbook(makeSession());
    const names = workbook.worksheets.map((s) => s.name);
    expect(names).toEqual(
      expect.arrayContaining(["Overview", "Transcript", "Key Terms", "Action Items", "Follow-Ups", "Similar Projects"])
    );
  });

  it("omits role-specific sheets entirely when there's no data for them", () => {
    const workbook = buildSessionWorkbook(makeSession());
    const names = workbook.worksheets.map((s) => s.name);
    expect(names).not.toEqual(expect.arrayContaining(["Requirements", "Pain Points", "SIPOC", "BANT", "Methodology", "Competitor Mentions", "Timeline Signals", "Risk Flags"]));
  });

  it("Overview sheet shows the session title, client, and industry", () => {
    const workbook = buildSessionWorkbook(makeSession());
    const sheet = workbook.getWorksheet("Overview")!;
    expect(sheet.getRow(1).getCell(1).value).toBe("Excel Export Test");
    const values = sheet.getRows(1, sheet.rowCount)!.map((r) => r.getCell(2).value);
    expect(values).toContain("Northgate Group");
    expect(values).toContain("Retail");
  });

  it("assigns a distinct tab color to each sheet", () => {
    const workbook = buildSessionWorkbook(makeSession());
    const overview = workbook.getWorksheet("Overview")!;
    const transcript = workbook.getWorksheet("Transcript")!;
    expect(overview.properties.tabColor).toBeTruthy();
    expect(transcript.properties.tabColor).toBeTruthy();
    expect((overview.properties.tabColor as any).argb).not.toBe((transcript.properties.tabColor as any).argb);
  });

  it("an always-present sheet shows a 'no data' note when empty rather than a blank table", () => {
    const workbook = buildSessionWorkbook(makeSession());
    const sheet = workbook.getWorksheet("Action Items")!;
    expect(sheet.getRow(2).getCell(1).value).toBe("No data captured in this section.");
  });

  it("Transcript sheet splits '[Speaker] text' blocks into Time/Speaker/Text rows", () => {
    const workbook = buildSessionWorkbook(makeSession({
      transcript: "[Rachel Torres] Good morning everyone.\n\n[Pat Singh] Hi Rachel, I have a question.",
    }));
    const sheet = workbook.getWorksheet("Transcript")!;
    expect(sheet.getRow(2).getCell(2).value).toBe("Rachel Torres");
    expect(sheet.getRow(2).getCell(3).value).toBe("Good morning everyone.");
    expect(sheet.getRow(3).getCell(2).value).toBe("Pat Singh");
  });

  it("Key Terms sheet lists topics with term/definition/category/type", () => {
    const workbook = buildSessionWorkbook(makeSession({
      topics: [{ id: 1, sessionId: 1, term: "Kubernetes", definition: "Container orchestration", category: "infrastructure", type: "tool", capabilitySource: "in-house", partnerName: null, mentionCount: 1, firstMentionedAt: new Date() } as Topic],
    }));
    const sheet = workbook.getWorksheet("Key Terms")!;
    expect(sheet.getRow(2).getCell(1).value).toBe("Kubernetes");
    expect(sheet.getRow(2).getCell(3).value).toBe("infrastructure");
  });

  it("Requirements sheet appears only when requirements exist, with text and source", () => {
    const workbook = buildSessionWorkbook(makeSession({
      requirements: [{ text: "Must support SSO", source: "Rachel" }] as any,
    }));
    const sheet = workbook.getWorksheet("Requirements")!;
    expect(sheet.getRow(2).getCell(1).value).toBe("Must support SSO");
    expect(sheet.getRow(2).getCell(2).value).toBe("Rachel");
  });

  it("BANT sheet appears only when at least one BANT field is set", () => {
    const workbook = buildSessionWorkbook(makeSession({
      bantData: { budget: { value: "$600K", evidence: "board approved", firstHeard: "", lastUpdated: "", history: [] }, authority: null, needs: null, timeline: null } as any,
    }));
    const sheet = workbook.getWorksheet("BANT")!;
    expect(sheet.getRow(2).getCell(1).value).toBe("Budget");
    expect(sheet.getRow(2).getCell(2).value).toBe("$600K");
    expect(sheet.getRow(2).getCell(3).value).toBe("board approved");
  });

  it("SIPOC sheet renders one row per link then a Not Yet Linked section", () => {
    const workbook = buildSessionWorkbook(makeSession({
      sipocData: {
        suppliers: [{ text: "Acme Corp" }, { text: "Beacon Logistics" }],
        inputs: [{ text: "Invoices" }],
        process: [], outputs: [], customers: [],
        links: [{ supplier: "Acme Corp", input: "Invoices" }],
        lastUpdated: "2026-01-01T00:00:00.000Z",
      } as any,
    }));
    const sheet = workbook.getWorksheet("SIPOC")!;
    expect(sheet.getRow(2).getCell(1).value).toBe("Acme Corp");
    expect(sheet.getRow(2).getCell(2).value).toBe("Invoices");
    expect(sheet.getRow(4).getCell(1).value).toBe("Not Yet Linked");
    expect(sheet.getRow(5).getCell(1).value).toBe("Beacon Logistics");
  });

  it("SIPOC sheet falls back to independent-column layout when there are no links", () => {
    const workbook = buildSessionWorkbook(makeSession({
      sipocData: {
        suppliers: [{ text: "Acme Corp" }, { text: "Beta LLC" }],
        inputs: [{ text: "Invoices" }],
        process: [], outputs: [{ text: "Approved PO" }], customers: [],
        lastUpdated: "2026-01-01T00:00:00.000Z",
      } as any,
    }));
    const sheet = workbook.getWorksheet("SIPOC")!;
    expect(sheet.getRow(2).getCell(1).value).toBe("Acme Corp");
    expect(sheet.getRow(2).getCell(2).value).toBe("Invoices");
    expect(sheet.getRow(2).getCell(4).value).toBe("Approved PO");
    expect(sheet.getRow(3).getCell(1).value).toBe("Beta LLC");
    expect(sheet.getRow(3).getCell(2).value).toBe("");
  });
});
