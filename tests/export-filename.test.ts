import { describe, it, expect } from "vitest";
import { buildExportFilename } from "../src/lib/export-filename";

describe("buildExportFilename", () => {
  it("joins client, title, and date with underscores", () => {
    const name = buildExportFilename({
      title: "Procurement Requirements Workshop",
      clientName: "Northgate Group",
      createdAt: "2026-09-01T18:19:00.000Z",
    });
    expect(name).toBe("northgate-group_procurement-requirements-workshop_2026-09-01");
  });

  it("omits the client segment entirely when clientName is null", () => {
    const name = buildExportFilename({
      title: "Internal Sync",
      clientName: null,
      createdAt: "2026-09-01T18:19:00.000Z",
    });
    expect(name).toBe("internal-sync_2026-09-01");
  });

  it("slugifies punctuation and multiple spaces within each segment", () => {
    const name = buildExportFilename({
      title: "Q3 Review: Budget & Timeline!!",
      clientName: "Acme, Corp.",
      createdAt: "2026-01-05T00:00:00.000Z",
    });
    expect(name).toBe("acme-corp_q3-review-budget-timeline_2026-01-05");
  });

  it("accepts a Date object for createdAt, not just a string", () => {
    const name = buildExportFilename({
      title: "Demo",
      clientName: undefined,
      createdAt: new Date("2026-03-15T12:00:00.000Z"),
    });
    expect(name).toBe("demo_2026-03-15");
  });
});
