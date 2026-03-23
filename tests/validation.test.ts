import { describe, it, expect } from "vitest";
import { z } from "zod";

const updateSettingsSchema = z.object({
  hostRole: z.enum(["host", "producer", "engineer", "correspondent"]).optional(),
  analysisModel: z.enum(["gpt-4o-mini", "gpt-4o", "gpt-4.1-mini", "gpt-4.1-nano"]).optional(),
  transcriptionModel: z.enum(["gpt-4o-mini-transcribe", "gpt-4o-transcribe"]).optional(),
});

describe("Validation: updateSettingsSchema", () => {
  it("accepts valid hostRole only", () => {
    expect(updateSettingsSchema.safeParse({ hostRole: "producer" }).success).toBe(true);
  });

  it("accepts valid analysisModel only", () => {
    expect(updateSettingsSchema.safeParse({ analysisModel: "gpt-4o" }).success).toBe(true);
  });

  it("accepts all fields together", () => {
    const result = updateSettingsSchema.safeParse({ hostRole: "engineer", analysisModel: "gpt-4.1-mini", transcriptionModel: "gpt-4o-transcribe" });
    expect(result.success).toBe(true);
  });

  it("accepts empty object (all optional)", () => {
    expect(updateSettingsSchema.safeParse({}).success).toBe(true);
  });

  it("rejects invalid hostRole", () => {
    expect(updateSettingsSchema.safeParse({ hostRole: "invalid-role" }).success).toBe(false);
  });

  it("rejects invalid analysisModel", () => {
    expect(updateSettingsSchema.safeParse({ analysisModel: "gpt-5-nano" }).success).toBe(false);
  });

  it("rejects invalid transcriptionModel", () => {
    expect(updateSettingsSchema.safeParse({ transcriptionModel: "whisper-1" }).success).toBe(false);
  });

  it("strips unknown fields", () => {
    const result = updateSettingsSchema.safeParse({ hostRole: "host", unknownField: "should be stripped" });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data).not.toHaveProperty("unknownField");
  });

  it("validates all four hostRole options", () => {
    for (const role of ["host", "producer", "engineer", "correspondent"]) {
      expect(updateSettingsSchema.safeParse({ hostRole: role }).success).toBe(true);
    }
  });

  it("validates all four analysisModel options", () => {
    for (const model of ["gpt-4o-mini", "gpt-4o", "gpt-4.1-mini", "gpt-4.1-nano"]) {
      expect(updateSettingsSchema.safeParse({ analysisModel: model }).success).toBe(true);
    }
  });
});

const createSessionSchema = z.object({
  title: z.string().min(1),
  clientName: z.string().optional(),
  industry: z.string().optional(),
});

describe("Validation: createSessionSchema", () => {
  it("accepts title only", () => {
    expect(createSessionSchema.safeParse({ title: "New Episode" }).success).toBe(true);
  });

  it("accepts all fields", () => {
    expect(createSessionSchema.safeParse({ title: "Cloud Migration", clientName: "BigCorp", industry: "finance" }).success).toBe(true);
  });

  it("rejects missing title", () => {
    expect(createSessionSchema.safeParse({}).success).toBe(false);
  });

  it("rejects empty string title", () => {
    expect(createSessionSchema.safeParse({ title: "" }).success).toBe(false);
  });
});

const createCompetencySchema = z.object({
  name: z.string().min(1),
  type: z.enum(["service", "product", "offering"]),
  source: z.enum(["in-house", "partner"]),
  partnerName: z.string().nullable().optional(),
  description: z.string().nullable().optional(),
});

describe("Validation: createCompetencySchema", () => {
  it("accepts valid competency with required fields", () => {
    expect(createCompetencySchema.safeParse({ name: "Cloud Migration", type: "service", source: "in-house" }).success).toBe(true);
  });

  it("accepts all fields including optional", () => {
    expect(createCompetencySchema.safeParse({ name: "CrowdStrike Falcon", type: "product", source: "partner", partnerName: "SecureOps", description: "EDR" }).success).toBe(true);
  });

  it("rejects missing name", () => {
    expect(createCompetencySchema.safeParse({ type: "service", source: "in-house" }).success).toBe(false);
  });

  it("rejects invalid type", () => {
    expect(createCompetencySchema.safeParse({ name: "Test", type: "widget", source: "in-house" }).success).toBe(false);
  });

  it("rejects invalid source", () => {
    expect(createCompetencySchema.safeParse({ name: "Test", type: "service", source: "external" }).success).toBe(false);
  });

  it("validates all three type options", () => {
    for (const type of ["service", "product", "offering"]) {
      expect(createCompetencySchema.safeParse({ name: "Test", type, source: "in-house" }).success).toBe(true);
    }
  });
});

const updateTopicSchema = z.object({
  capabilitySource: z.enum(["in-house", "partner", "unknown"]).optional(),
  partnerName: z.string().nullable().optional(),
});

describe("Validation: updateTopicSchema", () => {
  it("accepts capabilitySource update", () => {
    expect(updateTopicSchema.safeParse({ capabilitySource: "partner" }).success).toBe(true);
  });

  it("accepts null partnerName (clearing partner)", () => {
    expect(updateTopicSchema.safeParse({ capabilitySource: "in-house", partnerName: null }).success).toBe(true);
  });

  it("rejects invalid capabilitySource", () => {
    expect(updateTopicSchema.safeParse({ capabilitySource: "external" }).success).toBe(false);
  });

  it("validates all three capability sources", () => {
    for (const source of ["in-house", "partner", "unknown"]) {
      expect(updateTopicSchema.safeParse({ capabilitySource: source }).success).toBe(true);
    }
  });
});
