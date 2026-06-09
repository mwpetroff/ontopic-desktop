import { describe, it, expect } from "vitest";
import { DatabaseStorage } from "../server/storage";

// DatabaseStorage uses server/db.ts which reads DATABASE_PATH from env.
// tests/setup.ts sets DATABASE_PATH to a fresh temp SQLite file before this runs.
const storage = new DatabaseStorage();

let testSessionId: number;
let testTopicId: number;
let testPartnerId: number;
let testVoiceProfileId: number;
let testCompetencyId: number;

describe("Storage: Settings", () => {
  it("getSettings returns or creates a singleton", async () => {
    const settings = await storage.getSettings();
    expect(settings).toBeDefined();
    expect(settings.id).toBeGreaterThan(0);
    expect(settings.hostRole).toBeDefined();
  });

  it("updateSettings changes hostRole", async () => {
    const original = await storage.getSettings();
    const updated = await storage.updateSettings({ hostRole: "engineer" });
    expect(updated.hostRole).toBe("engineer");
    await storage.updateSettings({ hostRole: original.hostRole });
  });

  it("updateSettings changes analysisModel", async () => {
    const original = await storage.getSettings();
    const updated = await storage.updateSettings({ analysisModel: "gpt-4o" });
    expect(updated.analysisModel).toBe("gpt-4o");
    await storage.updateSettings({ analysisModel: original.analysisModel });
  });

  it("getSettings returns consistent values after update", async () => {
    await storage.updateSettings({ hostRole: "producer" });
    const settings = await storage.getSettings();
    expect(settings.hostRole).toBe("producer");
    await storage.updateSettings({ hostRole: "host" });
  });
});

describe("Storage: Sessions", () => {
  it("creates a session", async () => {
    const session = await storage.createSession({ title: "Unit Test Episode", clientName: "Test Client", industry: "technology" });
    testSessionId = session.id;
    expect(session.title).toBe("Unit Test Episode");
    expect(session.status).toBe("active");
    expect(session.transcript).toBe("");
    expect(session.totalTopics).toBe(0);
  });

  it("gets a session by id", async () => {
    const session = await storage.getSession(testSessionId);
    expect(session?.title).toBe("Unit Test Episode");
  });

  it("returns undefined for nonexistent session", async () => {
    expect(await storage.getSession(999999)).toBeUndefined();
  });

  it("lists all sessions (includes test session)", async () => {
    const sessions = await storage.getAllSessions();
    expect(sessions.some(s => s.id === testSessionId)).toBe(true);
  });

  it("updates a session", async () => {
    const updated = await storage.updateSession(testSessionId, { title: "Updated Title", transcript: "[Mark] Testing" });
    expect(updated?.title).toBe("Updated Title");
    expect(updated?.transcript).toBe("[Mark] Testing");
  });

  it("updates session with JSON fields", async () => {
    const actionItems = [{ text: "Follow up on POC", assignee: "Mark", priority: "high" }];
    const updated = await storage.updateSession(testSessionId, { actionItems, overallSentiment: 65 });
    expect(updated?.actionItems).toEqual(actionItems);
    expect(updated?.overallSentiment).toBe(65);
  });

  it("ends a session", async () => {
    const ended = await storage.endSession(testSessionId);
    expect(ended?.status).toBe("completed");
    expect(ended?.endedAt).toBeDefined();
  });
});

describe("Storage: Topics", () => {
  it("creates a topic for a session", async () => {
    const topic = await storage.createTopic({
      sessionId: testSessionId, term: "Kubernetes",
      definition: "Container orchestration platform", category: "infrastructure",
      type: "tool", capabilitySource: "in-house",
    });
    testTopicId = topic.id;
    expect(topic.term).toBe("Kubernetes");
    expect(topic.mentionCount).toBe(1);
  });

  it("gets topics by session", async () => {
    await storage.createTopic({ sessionId: testSessionId, term: "Zero Trust", definition: "Security framework", category: "security", type: "concept", capabilitySource: "unknown" });
    const topics = await storage.getTopicsBySession(testSessionId);
    expect(topics.length).toBe(2);
  });

  it("finds topic by term (case insensitive)", async () => {
    const topic = await storage.findTopicByTerm(testSessionId, "kubernetes");
    expect(topic?.term).toBe("Kubernetes");
  });

  it("returns undefined for nonexistent term", async () => {
    expect(await storage.findTopicByTerm(testSessionId, "Nonexistent")).toBeUndefined();
  });

  it("updates a topic", async () => {
    const updated = await storage.updateTopic(testTopicId, { capabilitySource: "partner", partnerName: "CloudOps Ltd", mentionCount: 5 });
    expect(updated?.capabilitySource).toBe("partner");
    expect(updated?.partnerName).toBe("CloudOps Ltd");
    expect(updated?.mentionCount).toBe(5);
  });
});

describe("Storage: Partners", () => {
  it("creates a partner", async () => {
    const partner = await storage.createPartner({ name: "UnitTest Partner Co", specialties: ["cloud", "devops"], contactInfo: "test@partner.com" });
    testPartnerId = partner.id;
    expect(partner.name).toBe("UnitTest Partner Co");
    expect(partner.specialties).toEqual(["cloud", "devops"]);
  });

  it("gets a partner by id", async () => {
    const partner = await storage.getPartner(testPartnerId);
    expect(partner?.name).toBe("UnitTest Partner Co");
  });

  it("lists all partners", async () => {
    const partners = await storage.getPartners();
    expect(partners.some(p => p.id === testPartnerId)).toBe(true);
  });

  it("updates a partner", async () => {
    const updated = await storage.updatePartner(testPartnerId, { notes: "Updated in test", specialties: ["cloud", "devops", "security"] });
    expect(updated?.notes).toBe("Updated in test");
    expect(updated?.specialties).toEqual(["cloud", "devops", "security"]);
  });

  it("returns undefined for nonexistent partner", async () => {
    expect(await storage.getPartner(999999)).toBeUndefined();
  });
});

describe("Storage: Competencies", () => {
  it("creates a competency", async () => {
    const comp = await storage.createCompetency({ name: "UnitTest Cloud Migration", type: "service", source: "in-house", description: "End-to-end cloud migration consulting" });
    testCompetencyId = comp.id;
    expect(comp.name).toBe("UnitTest Cloud Migration");
    expect(comp.description).toBe("End-to-end cloud migration consulting");
  });

  it("lists all competencies", async () => {
    const all = await storage.getCompetencies();
    expect(all.some(c => c.id === testCompetencyId)).toBe(true);
  });

  it("updates a competency", async () => {
    const updated = await storage.updateCompetency(testCompetencyId, { name: "UnitTest Cloud Transformation", source: "partner", partnerName: "CloudBridge" });
    expect(updated?.name).toBe("UnitTest Cloud Transformation");
    expect(updated?.partnerName).toBe("CloudBridge");
  });

  it("returns undefined for nonexistent competency", async () => {
    expect(await storage.updateCompetency(999999, { name: "Nope" })).toBeUndefined();
  });

  it("deletes a competency", async () => {
    await storage.deleteCompetency(testCompetencyId);
    expect((await storage.getCompetencies()).some(c => c.id === testCompetencyId)).toBe(false);
  });
});

describe("Storage: Voice Profiles", () => {
  it("creates a voice profile", async () => {
    const profile = await storage.createVoiceProfile({ name: "Test Speaker" });
    testVoiceProfileId = profile.id;
    expect(profile.name).toBe("Test Speaker");
    expect(profile.sampleCount).toBe(0);
  });

  it("lists voice profiles", async () => {
    const profiles = await storage.getVoiceProfiles();
    expect(profiles.some(p => p.id === testVoiceProfileId)).toBe(true);
  });

  it("updates a voice profile", async () => {
    const updated = await storage.updateVoiceProfile(testVoiceProfileId, { sampleCount: 3 });
    expect(updated?.sampleCount).toBe(3);
  });
});

describe("Storage: Session pagination (A-16)", () => {
  const paginationIds: number[] = [];

  it("creates 5 sessions for pagination test", async () => {
    for (let i = 1; i <= 5; i++) {
      const s = await storage.createSession({ title: `Pagination Session ${i}`, clientName: null, industry: null });
      paginationIds.push(s.id);
    }
    expect(paginationIds).toHaveLength(5);
  });

  it("getAllSessions(limit=3) returns at most 3 sessions", async () => {
    const result = await storage.getAllSessions(3);
    expect(result.length).toBeLessThanOrEqual(3);
  });

  it("getAllSessions(limit=2, offset=0) and (limit=2, offset=2) return different sessions", async () => {
    const page1 = await storage.getAllSessions(2, 0);
    const page2 = await storage.getAllSessions(2, 2);
    const ids1 = page1.map(s => s.id);
    const ids2 = page2.map(s => s.id);
    expect(ids1.every(id => !ids2.includes(id))).toBe(true);
  });

  it("getAllSessions(offset=99999) returns empty array when past the end", async () => {
    const result = await storage.getAllSessions(10, 99999);
    expect(result).toHaveLength(0);
  });

  it("cleans up pagination sessions", async () => {
    for (const id of paginationIds) {
      await storage.deleteSession(id);
    }
    const remaining = await storage.getAllSessions(100);
    expect(paginationIds.every(id => !remaining.some(s => s.id === id))).toBe(true);
  });
});

describe("Storage: Cleanup and cascades", () => {
  it("deletes test voice profile", async () => {
    await storage.deleteVoiceProfile(testVoiceProfileId);
    expect((await storage.getVoiceProfiles()).some(p => p.id === testVoiceProfileId)).toBe(false);
  });

  it("deletes test partner", async () => {
    await storage.deletePartner(testPartnerId);
    expect(await storage.getPartner(testPartnerId)).toBeUndefined();
  });

  it("deletes test session and cascades topics", async () => {
    await storage.deleteSession(testSessionId);
    expect(await storage.getSession(testSessionId)).toBeUndefined();
    expect((await storage.getTopicsBySession(testSessionId)).length).toBe(0);
  });
});
