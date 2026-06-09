import { db } from "./db";
import { sessions, topics, voiceProfiles, partners, settings, competencies, referenceProjects } from "@shared/schema";
import { eq, desc } from "drizzle-orm";
import type { Session, InsertSession, Topic, InsertTopic, VoiceProfile, InsertVoiceProfile, Partner, InsertPartner, Settings, Competency, InsertCompetency, ReferenceProject, InsertReferenceProject } from "@shared/schema";

export interface IStorage {
  getSettings(): Promise<Settings>;
  updateSettings(data: Partial<Settings>): Promise<Settings>;

  createSession(data: InsertSession): Promise<Session>;
  getSession(id: number): Promise<Session | undefined>;
  getAllSessions(limit?: number, offset?: number): Promise<Session[]>;
  updateSession(id: number, data: Partial<Session>): Promise<Session | undefined>;
  deleteSession(id: number): Promise<void>;
  endSession(id: number): Promise<Session | undefined>;

  createTopic(data: InsertTopic): Promise<Topic>;
  getTopicsBySession(sessionId: number): Promise<Topic[]>;
  updateTopic(id: number, data: Partial<Topic>): Promise<Topic | undefined>;
  deleteTopic(id: number): Promise<void>;
  findTopicByTerm(sessionId: number, term: string): Promise<Topic | undefined>;

  createVoiceProfile(data: InsertVoiceProfile): Promise<VoiceProfile>;
  getVoiceProfiles(): Promise<VoiceProfile[]>;
  getActiveProfile(): Promise<VoiceProfile | undefined>;
  updateVoiceProfile(id: number, data: Partial<VoiceProfile>): Promise<VoiceProfile | undefined>;
  deleteVoiceProfile(id: number): Promise<void>;

  createPartner(data: InsertPartner): Promise<Partner>;
  getPartners(): Promise<Partner[]>;
  getPartner(id: number): Promise<Partner | undefined>;
  updatePartner(id: number, data: Partial<Partner>): Promise<Partner | undefined>;
  deletePartner(id: number): Promise<void>;
  deleteAllPartners(): Promise<void>;

  createCompetency(data: InsertCompetency): Promise<Competency>;
  getCompetencies(): Promise<Competency[]>;
  updateCompetency(id: number, data: Partial<Competency>): Promise<Competency | undefined>;
  deleteCompetency(id: number): Promise<void>;
  deleteAllCompetencies(): Promise<void>;

  createReferenceProject(data: InsertReferenceProject): Promise<ReferenceProject>;
  getReferenceProjects(): Promise<ReferenceProject[]>;
  getReferenceProject(id: number): Promise<ReferenceProject | undefined>;
  updateReferenceProject(id: number, data: Partial<ReferenceProject>): Promise<ReferenceProject | undefined>;
  deleteReferenceProject(id: number): Promise<void>;
}

export class DatabaseStorage implements IStorage {
  async getSettings(): Promise<Settings> {
    const [existing] = await db.select().from(settings);
    if (existing) return existing;
    const [created] = await db.insert(settings).values({}).returning();
    return created;
  }

  async updateSettings(data: Partial<Settings>): Promise<Settings> {
    const current = await this.getSettings();
    const [updated] = await db.update(settings).set(data).where(eq(settings.id, current.id)).returning();
    return updated;
  }

  async createSession(data: InsertSession): Promise<Session> {
    const [session] = await db.insert(sessions).values(data).returning();
    return session;
  }

  async getSession(id: number): Promise<Session | undefined> {
    const [session] = await db.select().from(sessions).where(eq(sessions.id, id));
    return session;
  }

  async getAllSessions(limit = 100, offset = 0): Promise<Session[]> {
    return db.select().from(sessions).orderBy(desc(sessions.createdAt))
      .limit(limit).offset(offset);
  }

  async updateSession(id: number, data: Partial<Session>): Promise<Session | undefined> {
    const [session] = await db.update(sessions).set(data).where(eq(sessions.id, id)).returning();
    return session;
  }

  async deleteSession(id: number): Promise<void> {
    await db.delete(topics).where(eq(topics.sessionId, id));
    await db.delete(sessions).where(eq(sessions.id, id));
  }

  async endSession(id: number): Promise<Session | undefined> {
    const sessionTopics = await this.getTopicsBySession(id);
    const [session] = await db.update(sessions).set({
      status: "completed",
      endedAt: new Date(),
      totalTopics: sessionTopics.length,
    }).where(eq(sessions.id, id)).returning();
    return session;
  }

  async createTopic(data: InsertTopic): Promise<Topic> {
    const [topic] = await db.insert(topics).values(data).returning();
    return topic;
  }

  async getTopicsBySession(sessionId: number): Promise<Topic[]> {
    return db.select().from(topics).where(eq(topics.sessionId, sessionId)).orderBy(desc(topics.firstMentionedAt));
  }

  async updateTopic(id: number, data: Partial<Topic>): Promise<Topic | undefined> {
    const [topic] = await db.update(topics).set(data).where(eq(topics.id, id)).returning();
    return topic;
  }

  async deleteTopic(id: number): Promise<void> {
    await db.delete(topics).where(eq(topics.id, id));
  }

  async findTopicByTerm(sessionId: number, term: string): Promise<Topic | undefined> {
    const allTopics = await this.getTopicsBySession(sessionId);
    return allTopics.find(t => t.term.toLowerCase() === term.toLowerCase());
  }

  async createVoiceProfile(data: InsertVoiceProfile): Promise<VoiceProfile> {
    if (data.isActive) {
      await db.update(voiceProfiles).set({ isActive: false });
    }
    const [profile] = await db.insert(voiceProfiles).values(data).returning();
    return profile;
  }

  async getVoiceProfiles(): Promise<VoiceProfile[]> {
    return db.select().from(voiceProfiles).orderBy(desc(voiceProfiles.createdAt));
  }

  async getActiveProfile(): Promise<VoiceProfile | undefined> {
    const [profile] = await db.select().from(voiceProfiles).where(eq(voiceProfiles.isActive, true));
    return profile;
  }

  async updateVoiceProfile(id: number, data: Partial<VoiceProfile>): Promise<VoiceProfile | undefined> {
    if (data.isActive) {
      await db.update(voiceProfiles).set({ isActive: false });
    }
    const [profile] = await db.update(voiceProfiles).set(data).where(eq(voiceProfiles.id, id)).returning();
    return profile;
  }

  async deleteVoiceProfile(id: number): Promise<void> {
    await db.delete(voiceProfiles).where(eq(voiceProfiles.id, id));
  }

  async createPartner(data: InsertPartner): Promise<Partner> {
    const [partner] = await db.insert(partners).values(data).returning();
    return partner;
  }

  async getPartners(): Promise<Partner[]> {
    return db.select().from(partners).orderBy(desc(partners.createdAt));
  }

  async getPartner(id: number): Promise<Partner | undefined> {
    const [partner] = await db.select().from(partners).where(eq(partners.id, id));
    return partner;
  }

  async updatePartner(id: number, data: Partial<Partner>): Promise<Partner | undefined> {
    const [partner] = await db.update(partners).set(data).where(eq(partners.id, id)).returning();
    return partner;
  }

  async deletePartner(id: number): Promise<void> {
    await db.delete(partners).where(eq(partners.id, id));
  }

  async deleteAllPartners(): Promise<void> {
    await db.delete(partners);
  }

  async createCompetency(data: InsertCompetency): Promise<Competency> {
    const [competency] = await db.insert(competencies).values(data).returning();
    return competency;
  }

  async getCompetencies(): Promise<Competency[]> {
    return db.select().from(competencies).orderBy(desc(competencies.createdAt));
  }

  async updateCompetency(id: number, data: Partial<Competency>): Promise<Competency | undefined> {
    const [competency] = await db.update(competencies).set(data).where(eq(competencies.id, id)).returning();
    return competency;
  }

  async deleteCompetency(id: number): Promise<void> {
    await db.delete(competencies).where(eq(competencies.id, id));
  }

  async deleteAllCompetencies(): Promise<void> {
    await db.delete(competencies);
  }

  async createReferenceProject(data: InsertReferenceProject): Promise<ReferenceProject> {
    const [project] = await db.insert(referenceProjects).values(data).returning();
    return project;
  }

  async getReferenceProjects(): Promise<ReferenceProject[]> {
    return db.select().from(referenceProjects).orderBy(
      desc(referenceProjects.projectDate),
      desc(referenceProjects.createdAt)
    );
  }

  async getReferenceProject(id: number): Promise<ReferenceProject | undefined> {
    const [project] = await db.select().from(referenceProjects).where(eq(referenceProjects.id, id));
    return project;
  }

  async updateReferenceProject(id: number, data: Partial<ReferenceProject>): Promise<ReferenceProject | undefined> {
    const [project] = await db.update(referenceProjects).set(data).where(eq(referenceProjects.id, id)).returning();
    return project;
  }

  async deleteReferenceProject(id: number): Promise<void> {
    await db.delete(referenceProjects).where(eq(referenceProjects.id, id));
  }
}

export const storage = new DatabaseStorage();
