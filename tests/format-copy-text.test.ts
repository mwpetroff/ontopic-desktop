import { describe, it, expect } from "vitest";
import {
  formatActionItems, formatFollowUps, formatRequirements, formatPainPoints,
  formatSipoc, formatBant, formatMethodology, formatCompetitorMentions,
  formatTimelineSignals, formatRiskFlags, formatTopics, formatSimilarProjects,
} from "../src/lib/format-copy-text";

describe("format-copy-text", () => {
  it("formatActionItems includes assignee and priority when present", () => {
    const text = formatActionItems([{ text: "Send proposal", assignee: "Alex", priority: "high" }]);
    expect(text).toBe("- Send proposal (Alex) [high]");
  });

  it("formatActionItems omits assignee/priority when absent", () => {
    expect(formatActionItems([{ text: "Follow up" }])).toBe("- Follow up");
  });

  it("formatFollowUps includes context on a second indented line", () => {
    const text = formatFollowUps([{ question: "What's the budget?", context: "Needed for BANT" }]);
    expect(text).toBe("- What's the budget?\n  Needed for BANT");
  });

  it("formatRequirements includes source in parens", () => {
    expect(formatRequirements([{ text: "Must support SSO", source: "Rachel" }])).toBe("- Must support SSO (Rachel)");
  });

  it("formatPainPoints includes impact on a second indented line", () => {
    const text = formatPainPoints([{ text: "Manual entry", impact: "Delays payments" }]);
    expect(text).toBe("- Manual entry\n  Impact: Delays payments");
  });

  it("formatSipoc returns empty string for null data", () => {
    expect(formatSipoc(null)).toBe("");
  });

  it("formatSipoc lists all five categories, marking empty ones", () => {
    const text = formatSipoc({
      suppliers: [{ text: "Acme Corp" }], inputs: [], process: [], outputs: [], customers: [],
      lastUpdated: "2026-01-01T00:00:00.000Z",
    });
    expect(text).toContain("Suppliers:\n- Acme Corp");
    expect(text).toContain("Inputs:\n(none)");
  });

  it("formatBant returns empty string for null data", () => {
    expect(formatBant(null)).toBe("");
  });

  it("formatBant shows placeholder for unidentified fields", () => {
    const text = formatBant({
      budget: { value: "$600K", evidence: "", firstHeard: "", lastUpdated: "", history: [] },
      authority: null, needs: null, timeline: null,
    });
    expect(text).toBe("Budget: $600K\nAuthority: (not yet identified)\nNeeds: (not yet identified)\nTimeline: (not yet identified)");
  });

  it("formatMethodology marks completed stages with [x] and incomplete with [ ]", () => {
    const text = formatMethodology({
      methodology: "meddic",
      stages: [{ id: "metrics", name: "Metrics", completed: true }, { id: "champion", name: "Champion", completed: false }],
      lastUpdated: "",
    });
    expect(text).toBe("[x] Metrics\n[ ] Champion");
  });

  it("formatMethodology returns empty string for null", () => {
    expect(formatMethodology(null)).toBe("");
  });

  it("formatCompetitorMentions joins name and context", () => {
    expect(formatCompetitorMentions([{ name: "Datadog", context: "used for monitoring" }])).toBe("- Datadog: used for monitoring");
  });

  it("formatTimelineSignals includes urgency when present", () => {
    expect(formatTimelineSignals([{ date: "Q3 2025", context: "go-live", urgency: "high" }])).toBe("- Q3 2025: go-live [high]");
  });

  it("formatRiskFlags includes type when present", () => {
    expect(formatRiskFlags([{ text: "Vendor dependency", type: "blocker" }])).toBe("- Vendor dependency [blocker]");
  });

  it("formatTopics joins term and definition", () => {
    expect(formatTopics([{ term: "Kubernetes", definition: "Container orchestration" }])).toBe("- Kubernetes: Container orchestration");
  });

  it("formatSimilarProjects falls back to a numbered label when title is missing", () => {
    expect(formatSimilarProjects([{ projectId: 42, relevance: "similar tech stack" }])).toBe("- Project #42: similar tech stack");
  });
});
