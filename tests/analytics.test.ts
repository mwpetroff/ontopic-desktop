import { describe, it, expect } from "vitest";
import { computeCompetencyMatch, areSimilarTopics } from "../server/analytics";
import type { Competency } from "@shared/schema";

function makeCompetency(overrides: Partial<Competency> = {}): Competency {
  return {
    id: 1,
    name: "Kubernetes Management",
    type: "service",
    source: "in-house",
    partnerName: null,
    consultancyName: null,
    description: "Container orchestration and cluster management for cloud-native workloads.",
    createdAt: new Date(),
    ...overrides,
  };
}

describe("computeCompetencyMatch", () => {
  it("returns 0.95 for exact name match (case-insensitive)", () => {
    const comp = makeCompetency({ name: "Kubernetes Management" });
    expect(computeCompetencyMatch("kubernetes management", comp)).toBeCloseTo(0.95);
    expect(computeCompetencyMatch("Kubernetes Management", comp)).toBeCloseTo(0.95);
  });

  it("returns 0.82 when term contains the competency name", () => {
    expect(computeCompetencyMatch("Kubernetes Management", makeCompetency({ name: "Kubernetes" }))).toBeCloseTo(0.82);
  });

  it("returns 0.82 when competency name contains the term", () => {
    expect(computeCompetencyMatch("Kubernetes Management", makeCompetency({ name: "Kubernetes Management Platform" }))).toBeCloseTo(0.82);
  });

  it("returns a score > 0.3 for strong word overlap", () => {
    const comp = makeCompetency({ name: "Cloud Security", description: "Zero trust network access and identity management for cloud workloads" });
    expect(computeCompetencyMatch("zero trust cloud", comp)).toBeGreaterThan(0.3);
  });

  it("returns 0 when there is no meaningful overlap", () => {
    const comp = makeCompetency({ name: "SAP Integration", description: "ERP integration" });
    expect(computeCompetencyMatch("quantum computing", comp)).toBe(0);
  });

  it("ignores common stop words", () => {
    const comp = makeCompetency({ name: "Data Analytics Platform", description: "" });
    expect(computeCompetencyMatch("the and or for of", comp)).toBe(0);
  });

  it("caps the Jaccard-based score at 0.78", () => {
    const comp = makeCompetency({ name: "Cloud Data Platform", description: "cloud data analytics platform for enterprise storage management" });
    const score = computeCompetencyMatch("cloud data analytics platform enterprise", comp);
    expect(score).toBeLessThanOrEqual(0.78);
    expect(score).toBeGreaterThan(0.3);
  });

  it("handles empty description gracefully", () => {
    const comp = makeCompetency({ name: "DevOps Automation", description: undefined as unknown as string });
    expect(() => computeCompetencyMatch("DevOps Automation", comp)).not.toThrow();
    expect(computeCompetencyMatch("devops automation", comp)).toBeCloseTo(0.95);
  });

  it("returns a score between 0 and 0.95 for all cases", () => {
    const comp = makeCompetency({ name: "Machine Learning Ops", description: "MLOps pipeline management" });
    for (const term of ["mlops", "machine learning", "deep learning", "random forest", "kubernetes"]) {
      const score = computeCompetencyMatch(term, comp);
      expect(score).toBeGreaterThanOrEqual(0);
      expect(score).toBeLessThanOrEqual(0.95);
    }
  });

  it("distinguishes between close and distant matches", () => {
    const comp = makeCompetency({ name: "AWS Cloud Services", description: "Amazon Web Services cloud infrastructure management" });
    expect(computeCompetencyMatch("AWS infrastructure", comp)).toBeGreaterThan(
      computeCompetencyMatch("blockchain gaming NFT", comp)
    );
  });
});

describe("areSimilarTopics", () => {
  it("returns true for identical terms (case-insensitive)", () => {
    expect(areSimilarTopics("SLO", "slo")).toBe(true);
    expect(areSimilarTopics("Kubernetes", "kubernetes")).toBe(true);
  });

  it("returns true for plural vs singular variations", () => {
    expect(areSimilarTopics("SLOs", "SLO")).toBe(true);
    expect(areSimilarTopics("error budgets", "error budget")).toBe(true);
  });

  it("returns true when one term is an acronym of the other", () => {
    expect(areSimilarTopics("SLO", "Service Level Objective")).toBe(true);
    expect(areSimilarTopics("SRE", "Site Reliability Engineering")).toBe(true);
    expect(areSimilarTopics("IAM", "Identity and Access Management")).toBe(true);
  });

  it("returns true when one term contains the other as a substring", () => {
    expect(areSimilarTopics("SLO", "SLO (Service Level Objective)")).toBe(true);
    expect(areSimilarTopics("Grafana", "Grafana dashboards")).toBe(true);
  });

  it("returns true for high word-overlap variants", () => {
    expect(areSimilarTopics("infrastructure as code", "Infrastructure as Code (IaC)")).toBe(true);
    expect(areSimilarTopics("zero trust architecture", "Zero Trust Architecture")).toBe(true);
  });

  it("returns true for CI/CD variants", () => {
    expect(areSimilarTopics("CI/CD", "CI/CD pipeline")).toBe(true);
    expect(areSimilarTopics("matrix build", "matrix builds")).toBe(true);
  });

  it("returns false for clearly different terms", () => {
    expect(areSimilarTopics("Kubernetes", "Terraform")).toBe(false);
    expect(areSimilarTopics("SLO", "ETL")).toBe(false);
    expect(areSimilarTopics("Grafana", "Datadog")).toBe(false);
  });

  it("returns false for short single-letter or empty strings", () => {
    expect(areSimilarTopics("a", "b")).toBe(false);
    expect(areSimilarTopics("", "SLO")).toBe(false);
  });

  it("handles common IT term pairs correctly", () => {
    expect(areSimilarTopics("cloud migration", "Cloud Migration")).toBe(true);
    expect(areSimilarTopics("Azure Kubernetes Service", "Azure Kubernetes Service (AKS)")).toBe(true);
    expect(areSimilarTopics("error budget", "error budgets")).toBe(true);
  });
});
