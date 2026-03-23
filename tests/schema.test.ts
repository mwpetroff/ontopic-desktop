import { describe, it, expect } from "vitest";
import {
  insertSessionSchema,
  insertTopicSchema,
  insertPartnerSchema,
  insertSettingsSchema,
  insertVoiceProfileSchema,
  insertCompetencySchema,
} from "@shared/schema";

describe("Schema: insertSessionSchema", () => {
  it("accepts a valid session with title only", () => {
    expect(insertSessionSchema.safeParse({ title: "My Episode" }).success).toBe(true);
  });

  it("accepts a session with all optional fields", () => {
    expect(insertSessionSchema.safeParse({
      title: "Full Episode", clientName: "Acme Corp", industry: "healthcare",
      overallSentiment: 50, summary: "A good meeting",
    }).success).toBe(true);
  });

  it("rejects a session without a title", () => {
    expect(insertSessionSchema.safeParse({}).success).toBe(false);
  });

  it("strips auto-generated fields (id, createdAt, totalTopics, etc.)", () => {
    const result = insertSessionSchema.safeParse({ title: "Test", id: 999, createdAt: new Date(), totalTopics: 100 });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).not.toHaveProperty("id");
      expect(result.data).not.toHaveProperty("createdAt");
      expect(result.data).not.toHaveProperty("totalTopics");
    }
  });

  it("allows null for optional nullable fields", () => {
    expect(insertSessionSchema.safeParse({ title: "Test", clientName: null, industry: null }).success).toBe(true);
  });
});

describe("Schema: insertTopicSchema", () => {
  it("accepts a valid topic with required fields", () => {
    expect(insertTopicSchema.safeParse({
      sessionId: 1, term: "Kubernetes", definition: "Container orchestration platform",
      category: "infrastructure", type: "tool", capabilitySource: "in-house",
    }).success).toBe(true);
  });

  it("rejects a topic missing sessionId", () => {
    expect(insertTopicSchema.safeParse({ term: "Docker", definition: "Containerization tool" }).success).toBe(false);
  });

  it("rejects a topic missing term", () => {
    expect(insertTopicSchema.safeParse({ sessionId: 1, definition: "Some definition" }).success).toBe(false);
  });

  it("rejects a topic missing definition", () => {
    expect(insertTopicSchema.safeParse({ sessionId: 1, term: "Splunk" }).success).toBe(false);
  });

  it("accepts optional partnerName", () => {
    const result = insertTopicSchema.safeParse({
      sessionId: 1, term: "Splunk", definition: "SIEM platform",
      category: "security", type: "tool", capabilitySource: "partner", partnerName: "SecureOps Inc",
    });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.partnerName).toBe("SecureOps Inc");
  });
});

describe("Schema: insertPartnerSchema", () => {
  it("accepts a partner with name only", () => {
    expect(insertPartnerSchema.safeParse({ name: "Acme Solutions" }).success).toBe(true);
  });

  it("accepts a partner with all fields including specialties array", () => {
    const result = insertPartnerSchema.safeParse({
      name: "TechPartner Co", specialties: ["cloud", "security"],
      contactInfo: "partner@example.com", notes: "Preferred vendor",
    });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.specialties).toEqual(["cloud", "security"]);
  });

  it("rejects a partner without a name", () => {
    expect(insertPartnerSchema.safeParse({}).success).toBe(false);
  });

  it("allows null for optional fields", () => {
    expect(insertPartnerSchema.safeParse({ name: "Test", contactInfo: null, notes: null }).success).toBe(true);
  });
});

describe("Schema: insertSettingsSchema", () => {
  it("accepts empty object (all fields have defaults)", () => {
    expect(insertSettingsSchema.safeParse({}).success).toBe(true);
  });

  it("accepts valid hostRole", () => {
    expect(insertSettingsSchema.safeParse({ hostRole: "producer" }).success).toBe(true);
  });

  it("accepts valid analysisModel", () => {
    expect(insertSettingsSchema.safeParse({ analysisModel: "gpt-4o" }).success).toBe(true);
  });

  it("accepts caseStudyUrls as array", () => {
    const result = insertSettingsSchema.safeParse({ caseStudyUrls: ["https://example.com"] });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.caseStudyUrls).toEqual(["https://example.com"]);
  });
});

describe("Schema: insertCompetencySchema", () => {
  it("accepts a valid competency with required fields", () => {
    expect(insertCompetencySchema.safeParse({ name: "Kubernetes Management", type: "service", source: "in-house" }).success).toBe(true);
  });

  it("accepts a competency with all fields", () => {
    const result = insertCompetencySchema.safeParse({
      name: "CrowdStrike EDR", type: "product", source: "partner",
      partnerName: "SecureOps", description: "EDR platform",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.partnerName).toBe("SecureOps");
      expect(result.data.description).toBe("EDR platform");
    }
  });

  it("rejects a competency without a name", () => {
    expect(insertCompetencySchema.safeParse({ type: "service", source: "in-house" }).success).toBe(false);
  });

  it("allows null for optional fields", () => {
    expect(insertCompetencySchema.safeParse({ name: "Test", type: "service", source: "in-house", partnerName: null, description: null }).success).toBe(true);
  });

  it("strips auto-generated fields", () => {
    const result = insertCompetencySchema.safeParse({ name: "Test", type: "product", source: "partner", id: 999, createdAt: new Date() });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).not.toHaveProperty("id");
      expect(result.data).not.toHaveProperty("createdAt");
    }
  });
});

describe("Schema: insertVoiceProfileSchema", () => {
  it("accepts a voice profile with name", () => {
    expect(insertVoiceProfileSchema.safeParse({ name: "Speaker A" }).success).toBe(true);
  });

  it("rejects without a name", () => {
    expect(insertVoiceProfileSchema.safeParse({}).success).toBe(false);
  });

  it("strips auto-generated fields", () => {
    const result = insertVoiceProfileSchema.safeParse({ name: "Speaker B", id: 5, sampleCount: 10 });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).not.toHaveProperty("id");
      expect(result.data).not.toHaveProperty("sampleCount");
    }
  });
});
