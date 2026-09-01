import { describe, it, expect } from "vitest";
import { buildBaTabsWorkbook } from "../src/lib/export-excel";
import type { Session } from "@shared/schema";

function makeSession(overrides: Partial<Session> = {}): Session {
  return {
    id: 1,
    title: "BA Excel Export Test",
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
    createdAt: new Date("2026-01-01"),
    endedAt: null,
    ...overrides,
  } as Session;
}

describe("buildBaTabsWorkbook", () => {
  it("creates exactly three sheets: Requirements, Pain Points, SIPOC", () => {
    const workbook = buildBaTabsWorkbook(makeSession());
    expect(workbook.worksheets.map((s) => s.name)).toEqual(["Requirements", "Pain Points", "SIPOC"]);
  });

  it("writes requirement rows with text and source", () => {
    const workbook = buildBaTabsWorkbook(makeSession({
      requirements: [{ text: "Must support SSO", source: "Rachel" }] as any,
    }));
    const sheet = workbook.getWorksheet("Requirements")!;
    expect(sheet.getRow(1).getCell(1).value).toBe("Requirement");
    expect(sheet.getRow(2).getCell(1).value).toBe("Must support SSO");
    expect(sheet.getRow(2).getCell(2).value).toBe("Rachel");
  });

  it("writes pain point rows with text and impact, defaulting missing impact to empty string", () => {
    const workbook = buildBaTabsWorkbook(makeSession({
      painPoints: [{ text: "Manual re-entry causes errors" }] as any,
    }));
    const sheet = workbook.getWorksheet("Pain Points")!;
    expect(sheet.getRow(2).getCell(1).value).toBe("Manual re-entry causes errors");
    expect(sheet.getRow(2).getCell(2).value).toBe("");
  });

  it("SIPOC sheet has only a header row when sipocData is null", () => {
    const workbook = buildBaTabsWorkbook(makeSession({ sipocData: null }));
    const sheet = workbook.getWorksheet("SIPOC")!;
    expect(sheet.rowCount).toBe(1);
    expect(sheet.getRow(1).values).toEqual([undefined, "Suppliers", "Inputs", "Process", "Outputs", "Customers"]);
  });

  it("SIPOC sheet pads shorter categories with blanks up to the longest category", () => {
    const workbook = buildBaTabsWorkbook(makeSession({
      sipocData: {
        suppliers: [{ text: "Acme Corp" }, { text: "Beta LLC" }],
        inputs: [{ text: "Invoices" }],
        process: [],
        outputs: [{ text: "Approved PO" }],
        customers: [],
        lastUpdated: "2026-01-01T00:00:00.000Z",
      } as any,
    }));
    const sheet = workbook.getWorksheet("SIPOC")!;
    expect(sheet.rowCount).toBe(3); // header + 2 rows (longest category has 2 items)
    expect(sheet.getRow(2).getCell(1).value).toBe("Acme Corp");
    expect(sheet.getRow(2).getCell(2).value).toBe("Invoices");
    expect(sheet.getRow(2).getCell(4).value).toBe("Approved PO");
    expect(sheet.getRow(3).getCell(1).value).toBe("Beta LLC");
    expect(sheet.getRow(3).getCell(2).value).toBe(""); // padded — inputs only had 1 item
  });

  it("SIPOC sheet renders one row per link when links are present, then a Not Yet Linked section", () => {
    const workbook = buildBaTabsWorkbook(makeSession({
      sipocData: {
        suppliers: [{ text: "Acme Corp" }, { text: "Beacon Logistics" }],
        inputs: [{ text: "Invoices" }],
        process: [], outputs: [], customers: [],
        links: [{ supplier: "Acme Corp", input: "Invoices" }],
        lastUpdated: "2026-01-01T00:00:00.000Z",
      } as any,
    }));
    const sheet = workbook.getWorksheet("SIPOC")!;
    // Row 1: header. Row 2: the one link. Row 3: blank separator. Row 4: "Not Yet Linked" label. Row 5: Beacon Logistics.
    expect(sheet.getRow(2).getCell(1).value).toBe("Acme Corp");
    expect(sheet.getRow(2).getCell(2).value).toBe("Invoices");
    expect(sheet.getRow(4).getCell(1).value).toBe("Not Yet Linked");
    expect(sheet.getRow(5).getCell(1).value).toBe("Beacon Logistics");
  });

  it("SIPOC sheet skips the Not Yet Linked section when every item is linked", () => {
    const workbook = buildBaTabsWorkbook(makeSession({
      sipocData: {
        suppliers: [{ text: "Acme Corp" }],
        inputs: [{ text: "Invoices" }],
        process: [], outputs: [], customers: [],
        links: [{ supplier: "Acme Corp", input: "Invoices" }],
        lastUpdated: "2026-01-01T00:00:00.000Z",
      } as any,
    }));
    const sheet = workbook.getWorksheet("SIPOC")!;
    expect(sheet.rowCount).toBe(2); // header + the one link row, no Not Yet Linked section
  });
});
