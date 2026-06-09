import { sql } from "drizzle-orm";
import { sqliteTable, integer, text, index } from "drizzle-orm/sqlite-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export * from "./models/auth";

export const settings = sqliteTable("settings", {
  id: integer("id", { mode: "number" }).primaryKey({ autoIncrement: true }),
  hostRole: text("host_role").notNull().default("host"),
  analysisModel: text("analysis_model").notNull().default("gpt-4o-mini"),
  transcriptionModel: text("transcription_model").notNull().default("gpt-4o-mini-transcribe"),
  caseStudyUrls: text("case_study_urls", { mode: "json" }).$type<string[]>().notNull().default(sql`'[]'`),
  salesMethodology: text("sales_methodology"),
  createdAt: integer("created_at", { mode: "timestamp" }).default(sql`(unixepoch())`).notNull(),
});

export interface BANTField {
  value: string;
  evidence: string;
  firstHeard: string;
  lastUpdated: string;
  history: Array<{ value: string; evidence: string; timestamp: string }>;
}

export interface BANTData {
  budget: BANTField | null;
  authority: BANTField | null;
  needs: BANTField | null;
  timeline: BANTField | null;
}

export interface MethodologyStage {
  id: string;
  name: string;
  completed: boolean;
  completedAt?: string;
  evidence?: string;
}

export interface MethodologyProgress {
  methodology: string;
  stages: MethodologyStage[];
  lastUpdated: string;
}

export const sessions = sqliteTable("sessions", {
  id: integer("id", { mode: "number" }).primaryKey({ autoIncrement: true }),
  title: text("title").notNull(),
  clientName: text("client_name"),
  industry: text("industry"),
  status: text("status").notNull().default("active"),
  totalTopics: integer("total_topics", { mode: "number" }).notNull().default(0),
  transcript: text("transcript").notNull().default(""),
  overallSentiment: integer("overall_sentiment", { mode: "number" }),
  sentimentData: text("sentiment_data", { mode: "json" }).$type<Array<{ chunkIndex: number; score: number; label: string; speaker?: string }>>(),
  actionItems: text("action_items", { mode: "json" }).$type<Array<{ text: string; assignee?: string; priority?: string }>>(),
  followUpQuestions: text("follow_up_questions", { mode: "json" }).$type<Array<{ question: string; context?: string }>>(),
  speakers: text("speakers", { mode: "json" }).$type<Array<{ name: string; title?: string; role?: "host" | "guest" }>>(),
  similarProjectMatches: text("similar_project_matches", { mode: "json" }).$type<Array<{ projectId: number; relevance: string; title?: string; industry?: string; clientName?: string; projectDate?: string }>>(),
  bantData: text("bant_data", { mode: "json" }).$type<BANTData>(),
  methodologyProgress: text("methodology_progress", { mode: "json" }).$type<MethodologyProgress>(),
  competitorMentions: text("competitor_mentions", { mode: "json" }).$type<CompetitorMention[]>(),
  timelineSignals: text("timeline_signals", { mode: "json" }).$type<TimelineSignal[]>(),
  riskFlags: text("risk_flags", { mode: "json" }).$type<RiskFlag[]>(),
  requirements: text("requirements", { mode: "json" }).$type<Requirement[]>(),
  painPoints: text("pain_points", { mode: "json" }).$type<PainPoint[]>(),
  summary: text("summary"),
  createdAt: integer("created_at", { mode: "timestamp" }).default(sql`(unixepoch())`).notNull(),
  endedAt: integer("ended_at", { mode: "timestamp" }),
}, (table) => [
  index("idx_sessions_created_at").on(table.createdAt),
]);

export const topics = sqliteTable("topics", {
  id: integer("id", { mode: "number" }).primaryKey({ autoIncrement: true }),
  sessionId: integer("session_id", { mode: "number" }).notNull().references(() => sessions.id, { onDelete: "cascade" }),
  term: text("term").notNull(),
  definition: text("definition").notNull(),
  category: text("category").notNull().default("general"),
  type: text("type").notNull().default("concept"),
  capabilitySource: text("capability_source").notNull().default("unknown"),
  partnerName: text("partner_name"),
  mentionCount: integer("mention_count", { mode: "number" }).notNull().default(1),
  firstMentionedAt: integer("first_mentioned_at", { mode: "timestamp" }).default(sql`(unixepoch())`).notNull(),
}, (table) => [
  index("idx_topics_session_id").on(table.sessionId),
  index("idx_topics_first_mentioned_at").on(table.firstMentionedAt),
]);

export const voiceProfiles = sqliteTable("voice_profiles", {
  id: integer("id", { mode: "number" }).primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  title: text("title"),
  isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
  sampleCount: integer("sample_count", { mode: "number" }).notNull().default(0),
  frequencyData: text("frequency_data", { mode: "json" }),
  createdAt: integer("created_at", { mode: "timestamp" }).default(sql`(unixepoch())`).notNull(),
});

export const partners = sqliteTable("partners", {
  id: integer("id", { mode: "number" }).primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  specialties: text("specialties", { mode: "json" }).$type<string[]>().notNull().default(sql`'[]'`),
  contactInfo: text("contact_info"),
  notes: text("notes"),
  createdAt: integer("created_at", { mode: "timestamp" }).default(sql`(unixepoch())`).notNull(),
});

export const competencies = sqliteTable("competencies", {
  id: integer("id", { mode: "number" }).primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  type: text("type").notNull().default("service"),
  source: text("source").notNull().default("in-house"),
  partnerName: text("partner_name"),
  consultancyName: text("consultancy_name"),
  description: text("description"),
  createdAt: integer("created_at", { mode: "timestamp" }).default(sql`(unixepoch())`).notNull(),
});

export const insertSettingsSchema = createInsertSchema(settings, {
  caseStudyUrls: z.array(z.string()).default([]),
}).omit({
  id: true,
  createdAt: true,
});

export const insertSessionSchema = createInsertSchema(sessions).omit({
  id: true,
  createdAt: true,
  endedAt: true,
  totalTopics: true,
  transcript: true,
  status: true,
});

export const insertTopicSchema = createInsertSchema(topics).omit({
  id: true,
  firstMentionedAt: true,
  mentionCount: true,
});

export const insertVoiceProfileSchema = createInsertSchema(voiceProfiles).omit({
  id: true,
  createdAt: true,
  sampleCount: true,
});

export const insertPartnerSchema = createInsertSchema(partners, {
  specialties: z.array(z.string()).default([]),
}).omit({
  id: true,
  createdAt: true,
});

export const referenceProjects = sqliteTable("reference_projects", {
  id: integer("id", { mode: "number" }).primaryKey({ autoIncrement: true }),
  title: text("title").notNull(),
  description: text("description").notNull(),
  url: text("url"),
  tags: text("tags", { mode: "json" }).$type<string[]>().notNull().default(sql`'[]'`),
  industry: text("industry"),
  clientName: text("client_name"),
  projectDate: integer("project_date", { mode: "timestamp" }),
  createdAt: integer("created_at", { mode: "timestamp" }).default(sql`(unixepoch())`).notNull(),
}, (table) => [
  index("idx_reference_projects_created_at").on(table.createdAt),
]);

export const insertCompetencySchema = createInsertSchema(competencies).omit({
  id: true,
  createdAt: true,
});

export const insertReferenceProjectSchema = createInsertSchema(referenceProjects, {
  tags: z.array(z.string()).default([]),
}).omit({
  id: true,
  createdAt: true,
});

export interface SentimentEntry {
  chunkIndex: number;
  score: number;
  label: string;
  speaker?: string;
}

export interface ActionItem {
  text: string;
  assignee?: string;
  priority?: string;
}

export interface FollowUpQuestion {
  question: string;
  context?: string;
}

export interface SpeakerEntry {
  name: string;
  title?: string;
  role?: "host" | "guest";
}

export type Settings = typeof settings.$inferSelect;
export type InsertSettings = z.infer<typeof insertSettingsSchema>;
export type Session = typeof sessions.$inferSelect;
export type InsertSession = z.infer<typeof insertSessionSchema>;
export type Topic = typeof topics.$inferSelect;
export type InsertTopic = z.infer<typeof insertTopicSchema>;
export type VoiceProfile = typeof voiceProfiles.$inferSelect;
export type InsertVoiceProfile = z.infer<typeof insertVoiceProfileSchema>;
export type Partner = typeof partners.$inferSelect;
export type InsertPartner = z.infer<typeof insertPartnerSchema>;
export type Competency = typeof competencies.$inferSelect;
export type InsertCompetency = z.infer<typeof insertCompetencySchema>;
export type ReferenceProject = typeof referenceProjects.$inferSelect;
export type InsertReferenceProject = z.infer<typeof insertReferenceProjectSchema>;

export interface CompetitorMention {
  name: string;
  context: string;
}

export interface TimelineSignal {
  date: string;
  context: string;
  urgency?: string;
}

export interface RiskFlag {
  text: string;
  type?: string;
}

export interface Requirement {
  text: string;
  source?: string;
}

export interface PainPoint {
  text: string;
  impact?: string;
}

export interface SimilarProjectMatch {
  projectId: number;
  relevance: string;
  title?: string;
  industry?: string;
  clientName?: string;
  projectDate?: string;
}

export function consolidateSimilarProjects(
  matches: SimilarProjectMatch[]
): SimilarProjectMatch[] {
  if (matches.length <= 1) return matches;

  const groups = new Map<string, SimilarProjectMatch[]>();
  for (const match of matches) {
    const key = (match.title || `project-${match.projectId}`).toLowerCase().trim();
    const group = groups.get(key) || [];
    group.push(match);
    groups.set(key, group);
  }

  const consolidated: SimilarProjectMatch[] = [];
  for (const group of groups.values()) {
    if (group.length === 1) {
      consolidated.push(group[0]);
      continue;
    }

    const seen = new Set<string>();
    const uniqueRelevances: string[] = [];
    for (const m of group) {
      const normalized = m.relevance.toLowerCase().trim();
      if (!seen.has(normalized)) {
        seen.add(normalized);
        uniqueRelevances.push(m.relevance);
      }
    }

    const combined = uniqueRelevances.length > 1
      ? uniqueRelevances.join(" Additionally, ").replace(/\.\s*Additionally,/g, ". Additionally,")
      : uniqueRelevances[0];

    const best = group.reduce((a, b) => {
      let scoreA = 0, scoreB = 0;
      if (a.industry) scoreA++;
      if (a.clientName) scoreA++;
      if (a.projectDate) scoreA++;
      if (b.industry) scoreB++;
      if (b.clientName) scoreB++;
      if (b.projectDate) scoreB++;
      return scoreB > scoreA ? b : a;
    });

    consolidated.push({
      projectId: best.projectId,
      relevance: combined,
      title: best.title,
      industry: best.industry || group.find(m => m.industry)?.industry,
      clientName: best.clientName || group.find(m => m.clientName)?.clientName,
      projectDate: best.projectDate || group.find(m => m.projectDate)?.projectDate,
    });
  }

  return consolidated;
}

export { conversations, messages } from "./models/chat";
