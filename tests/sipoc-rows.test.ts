import { describe, it, expect } from "vitest";
import { computeSipocRows } from "../src/lib/sipoc-rows";
import type { SIPOCData } from "@shared/schema";

describe("computeSipocRows", () => {
  it("pads independent columns to the longest category when there are no links", () => {
    const sipoc: SIPOCData = {
      suppliers: [{ text: "Acme Corp" }, { text: "Beta LLC" }],
      inputs: [{ text: "Invoices" }],
      process: [], outputs: [{ text: "Approved PO" }], customers: [],
      lastUpdated: "2026-01-01T00:00:00.000Z",
    };
    const { columns, linkedRows, unlinkedRows } = computeSipocRows(sipoc);
    expect(columns).toEqual(["Suppliers", "Inputs", "Process", "Outputs", "Customers"]);
    expect(linkedRows).toEqual([
      ["Acme Corp", "Invoices", "", "Approved PO", ""],
      ["Beta LLC", "", "", "", ""],
    ]);
    expect(unlinkedRows).toEqual([]);
  });

  it("returns one row per link, plus any unreferenced items as unlinkedRows", () => {
    const sipoc: SIPOCData = {
      suppliers: [{ text: "Acme Corp" }, { text: "Beacon Logistics" }],
      inputs: [{ text: "Invoices" }],
      process: [], outputs: [], customers: [],
      links: [{ supplier: "Acme Corp", input: "Invoices" }],
      lastUpdated: "2026-01-01T00:00:00.000Z",
    };
    const { linkedRows, unlinkedRows } = computeSipocRows(sipoc);
    expect(linkedRows).toEqual([["Acme Corp", "Invoices", "", "", ""]]);
    expect(unlinkedRows).toEqual([["Beacon Logistics", "", "", "", ""]]);
  });

  it("returns empty unlinkedRows when every item is covered by a link", () => {
    const sipoc: SIPOCData = {
      suppliers: [{ text: "Acme Corp" }],
      inputs: [{ text: "Invoices" }],
      process: [], outputs: [], customers: [],
      links: [{ supplier: "Acme Corp", input: "Invoices" }],
      lastUpdated: "2026-01-01T00:00:00.000Z",
    };
    const { unlinkedRows } = computeSipocRows(sipoc);
    expect(unlinkedRows).toEqual([]);
  });

  it("a single-field link still produces a full 5-column row with blanks elsewhere", () => {
    const sipoc: SIPOCData = {
      suppliers: [], inputs: [], process: [], outputs: [{ text: "Compliance report" }], customers: [{ text: "Audit team" }],
      links: [{ output: "Compliance report", customer: "Audit team" }],
      lastUpdated: "2026-01-01T00:00:00.000Z",
    };
    const { linkedRows } = computeSipocRows(sipoc);
    expect(linkedRows).toEqual([["", "", "", "Compliance report", "Audit team"]]);
  });
});
