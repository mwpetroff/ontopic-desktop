import { describe, it, expect } from "vitest";
import { featuresForRole } from "../server/constants";

describe("featuresForRole", () => {
  it("always includes base flags for every role", () => {
    const roles = ["host", "engineer", "producer", "correspondent", "account-executive", "unknown"];
    for (const role of roles) {
      const flags = featuresForRole(role);
      expect(flags.actionItems).toBe(true);
      expect(flags.followUpQuestions).toBe(true);
      expect(flags.similarProjects).toBe(true);
    }
  });

  it("host (SA) enables competitorMentions only", () => {
    const flags = featuresForRole("host");
    expect(flags.competitorMentions).toBe(true);
    expect(flags.bantTracking).toBeFalsy();
    expect(flags.methodologyTracking).toBeFalsy();
    expect(flags.timelineSignals).toBeFalsy();
    expect(flags.riskFlags).toBeFalsy();
    expect(flags.requirements).toBeFalsy();
    expect(flags.painPoints).toBeFalsy();
  });

  it("engineer (SE) has no role-specific extras", () => {
    const flags = featuresForRole("engineer");
    expect(flags.competitorMentions).toBeFalsy();
    expect(flags.bantTracking).toBeFalsy();
    expect(flags.methodologyTracking).toBeFalsy();
    expect(flags.timelineSignals).toBeFalsy();
    expect(flags.riskFlags).toBeFalsy();
    expect(flags.requirements).toBeFalsy();
    expect(flags.painPoints).toBeFalsy();
  });

  it("producer (PM) enables timelineSignals and riskFlags", () => {
    const flags = featuresForRole("producer");
    expect(flags.timelineSignals).toBe(true);
    expect(flags.riskFlags).toBe(true);
    expect(flags.competitorMentions).toBeFalsy();
    expect(flags.bantTracking).toBeFalsy();
    expect(flags.requirements).toBeFalsy();
    expect(flags.painPoints).toBeFalsy();
  });

  it("correspondent (BA) enables requirements and painPoints", () => {
    const flags = featuresForRole("correspondent");
    expect(flags.requirements).toBe(true);
    expect(flags.painPoints).toBe(true);
    expect(flags.competitorMentions).toBeFalsy();
    expect(flags.bantTracking).toBeFalsy();
    expect(flags.timelineSignals).toBeFalsy();
    expect(flags.riskFlags).toBeFalsy();
  });

  it("account-executive enables bantTracking", () => {
    const flags = featuresForRole("account-executive");
    expect(flags.bantTracking).toBe(true);
  });

  it("account-executive enables methodologyTracking when salesMethodology is set", () => {
    const flags = featuresForRole("account-executive", "sandler");
    expect(flags.methodologyTracking).toBe(true);
  });

  it("account-executive disables methodologyTracking when salesMethodology is null", () => {
    const flags = featuresForRole("account-executive", null);
    expect(flags.methodologyTracking).toBe(false);
  });

  it("account-executive disables methodologyTracking when salesMethodology is undefined", () => {
    const flags = featuresForRole("account-executive", undefined);
    expect(flags.methodologyTracking).toBe(false);
  });

  it("account-executive disables methodologyTracking when salesMethodology is empty string", () => {
    const flags = featuresForRole("account-executive", "");
    expect(flags.methodologyTracking).toBe(false);
  });

  it("account-executive does not enable role-specific extras from other roles", () => {
    const flags = featuresForRole("account-executive", "meddic");
    expect(flags.competitorMentions).toBeFalsy();
    expect(flags.timelineSignals).toBeFalsy();
    expect(flags.riskFlags).toBeFalsy();
    expect(flags.requirements).toBeFalsy();
    expect(flags.painPoints).toBeFalsy();
  });

  it("unknown role returns only base flags", () => {
    const flags = featuresForRole("unknown-role");
    expect(flags.competitorMentions).toBeFalsy();
    expect(flags.bantTracking).toBeFalsy();
    expect(flags.methodologyTracking).toBeFalsy();
    expect(flags.timelineSignals).toBeFalsy();
    expect(flags.riskFlags).toBeFalsy();
    expect(flags.requirements).toBeFalsy();
    expect(flags.painPoints).toBeFalsy();
  });
});
