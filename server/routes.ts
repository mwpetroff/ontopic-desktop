import type { Express } from "express";
import { createServer, type Server } from "http";
import express from "express";
import multer from "multer";
import { storage } from "./storage";
import { toFile } from "openai";
import { detectAudioFormat } from "./replit_integrations/audio/client";
import { z } from "zod";
import { isAuthenticated } from "./auth";
import { FeatureFlags, METHODOLOGY_STAGES, featuresForRole } from "./constants";
import { openai, analyzeText, generateSummary, withRetry } from "./services/analysis";
import type { AnalysisResult } from "./services/analysis";
import type { SentimentEntry, ActionItem, FollowUpQuestion, SpeakerEntry, ReferenceProject, BANTData, MethodologyProgress } from "@shared/schema";
import { resolveSpeaker, updateSessionTopics, aggregateSentiment, accumulateSimilarProjects, updateSpeakersList, persistSessionUpdates, mergeBantData, applyMethodologyStageUpdates, dedupeByText } from "./analysis-helpers";
import { getTopicFrequency, getTopicTrends, getGapAnalysis, getNeedsVsOfferings, getDistinctIndustries, buildSessionGraph } from "./analytics";

const audioBodyParser = express.json({ limit: "50mb" });

// ─── Session analysis queue (A-06) ───────────────────────────────────────────
// Serializes concurrent /analyze calls per session to prevent read-then-write races.
const sessionQueues = new Map<number, Promise<unknown>>();
function enqueueForSession<T>(sessionId: number, fn: () => Promise<T>): Promise<T> {
  const prev = sessionQueues.get(sessionId) ?? Promise.resolve();
  const next = prev.then(fn, fn); // chain even on prior failure so queue stays unblocked
  sessionQueues.set(sessionId, next);
  next.finally(() => {
    if (sessionQueues.get(sessionId) === next) sessionQueues.delete(sessionId);
  });
  return next as Promise<T>;
}

// ─── Static prompt context cache (A-09) ──────────────────────────────────────
// Partners, competencies, and reference projects are global and change rarely.
// Cache them to avoid 3 DB reads + string rebuilds on every analyze call.
interface StaticPromptContext {
  partnerList: string;
  competencyContext: string;
  allReferenceProjects: ReferenceProject[];
  cachedAt: number;
}
let _staticContextCache: StaticPromptContext | null = null;
const STATIC_CONTEXT_TTL_MS = 5 * 60_000; // 5-min safety-net TTL; explicit invalidation is primary

function invalidateStaticContext(): void {
  _staticContextCache = null;
}

async function getStaticPromptContext(): Promise<StaticPromptContext> {
  const now = Date.now();
  if (_staticContextCache && now - _staticContextCache.cachedAt < STATIC_CONTEXT_TTL_MS) {
    return _staticContextCache;
  }
  const [allPartners, allCompetencies, allReferenceProjects] = await Promise.all([
    storage.getPartners(),
    storage.getCompetencies(),
    storage.getReferenceProjects(),
  ]);
  const partnerList = allPartners
    .map((p) => `${p.name} (specialties: ${(p.specialties || []).join(", ")})`)
    .join("; ");
  let competencyContext = "";
  if (allCompetencies.length > 0) {
    const inHouse = allCompetencies.filter(c => c.source === "in-house");
    const partnerComps = allCompetencies.filter(c => c.source === "partner");
    const lines: string[] = [];
    if (inHouse.length > 0) lines.push("In-house capabilities: " + inHouse.map(c => `${c.name} (${c.type}${c.description ? ": " + c.description : ""})`).join("; "));
    if (partnerComps.length > 0) lines.push("Partner capabilities: " + partnerComps.map(c => `${c.name} (${c.type}${c.partnerName ? " via " + c.partnerName : ""}${c.description ? ": " + c.description : ""})`).join("; "));
    competencyContext = lines.join("\n");
  }
  _staticContextCache = { partnerList, competencyContext, allReferenceProjects, cachedAt: now };
  return _staticContextCache;
}

// ─── Safe JSON column accessor (A-10) ────────────────────────────────────────
// Drizzle parses JSON columns on read; if a column is null/corrupt this ensures
// we always get a typed array rather than crashing or mis-casting.
function safeArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

interface VoiceMatchHint {
  name: string;
  title?: string;
  confidence: number;
}

async function processAnalysis(
  sessionId: number,
  transcriptText: string,
  session: any,
  features: FeatureFlags = {},
  voiceMatch?: VoiceMatchHint
) {
  const [existingTopics, appSettings, staticCtx] = await Promise.all([
    storage.getTopicsBySession(sessionId),
    storage.getSettings(),
    getStaticPromptContext(),
  ]);
  const { partnerList, competencyContext, allReferenceProjects } = staticCtx;

  const existingTerms = existingTopics.map((t) => t.term.toLowerCase());

  const existingSentiment = safeArray<SentimentEntry>(session.sentimentData);
  const knownSpeakers = [
    ...new Set(existingSentiment.map((s) => s.speaker).filter(Boolean) as string[]),
  ];

  const hostRole = appSettings.hostRole || "host";
  const salesMethodology = (appSettings as any).salesMethodology as string | null ?? null;
  const industry = session.industry || null;

  const analysisModel = appSettings.analysisModel || "gpt-4o-mini";

  let referenceProjectContext = "";
  if (features.similarProjects && allReferenceProjects.length > 0) {
    referenceProjectContext = allReferenceProjects.map(p => {
      const dateStr = p.projectDate ? ` [date: ${new Date(p.projectDate).toLocaleDateString("en-US", { year: "numeric", month: "short" })}]` : "";
      return `[ID:${p.id}] "${p.title}" — ${p.description}${p.tags && p.tags.length > 0 ? ` (tags: ${p.tags.join(", ")})` : ""}${p.industry ? ` [industry: ${p.industry}]` : ""}${p.clientName ? ` [client: ${p.clientName}]` : ""}${dateStr}`;
    }).join("\n");
  }

  const isAERole = hostRole === "account-executive";
  const methodologyStages = (isAERole && salesMethodology) ? METHODOLOGY_STAGES[salesMethodology] ?? [] : [];

  // Role-driven features override any caller-supplied flags
  const roleFeatures = featuresForRole(hostRole, salesMethodology);
  features = { ...roleFeatures, ...features, bantTracking: roleFeatures.bantTracking, methodologyTracking: roleFeatures.methodologyTracking };

  const existingActionItemsForPrompt = features.actionItems
    ? ((session.actionItems || []) as ActionItem[]).map((a: ActionItem) => a.text)
    : undefined;

  const analysis = await analyzeText(
    sessionId,
    transcriptText,
    existingTerms,
    partnerList,
    knownSpeakers,
    features,
    hostRole,
    industry,
    analysisModel,
    competencyContext || undefined,
    referenceProjectContext || undefined,
    methodologyStages.length > 0 ? methodologyStages : undefined,
    existingActionItemsForPrompt
  );

  const { newTopics, updatedTopics } = await updateSessionTopics(sessionId, analysis.terms);

  const { speaker, speakerTitle: resolvedTitle } = resolveSpeaker(
    analysis.speaker || null,
    knownSpeakers,
    voiceMatch
  );

  const rawTitle = analysis.speakerTitle;
  const voiceMatchTitle = voiceMatch?.title || null;
  const speakerTitle = voiceMatchTitle || ((rawTitle && rawTitle !== "null") ? rawTitle : null) || resolvedTitle;

  const isHost = !!(voiceMatch && voiceMatch.confidence >= 0.55);
  const updatedSpeakers = updateSpeakersList(
    safeArray<SpeakerEntry>(session.speakers),
    speaker,
    speakerTitle,
    isHost
  );

  const { newEntry, allSentiment: updatedSentimentData, overallSentiment } = aggregateSentiment(
    existingSentiment,
    analysis,
    speaker
  );
  const sentimentScore = newEntry.score;
  const sentimentLabel = newEntry.label;

  const existingActionItems = safeArray<ActionItem>(session.actionItems);
  const existingFollowUps = safeArray<FollowUpQuestion>(session.followUpQuestions);
  const newActionItems = analysis.actionItems || [];
  const newFollowUpQuestions = analysis.followUpQuestions || [];
  let updatedActionItems = [...existingActionItems, ...newActionItems];
  if (analysis.actionItemOrder && analysis.actionItemOrder.length > 0) {
    const orderMap = new Map(analysis.actionItemOrder.map((text, idx) => [text.toLowerCase().trim(), idx]));
    updatedActionItems = updatedActionItems.sort((a, b) => {
      const ia = orderMap.get(a.text.toLowerCase().trim()) ?? Infinity;
      const ib = orderMap.get(b.text.toLowerCase().trim()) ?? Infinity;
      return ia - ib;
    });
  }
  const updatedFollowUpQuestions = features.followUpQuestions
    ? [...existingFollowUps, ...newFollowUpQuestions].slice(-5)
    : existingFollowUps;

  const existingMatches = safeArray<{ projectId: number; relevance: string; title?: string; industry?: string; clientName?: string; projectDate?: string }>(session.similarProjectMatches);
  const updatedSimilarMatches = accumulateSimilarProjects(
    existingMatches,
    analysis.similarProjects || [],
    allReferenceProjects as ReferenceProject[]
  );
  const newSimilarMatches = updatedSimilarMatches.slice(existingMatches.length);

  const timestamp = new Date().toISOString();
  const updatedBantData = isAERole
    ? mergeBantData((session as any).bantData as BANTData | null, analysis.bantUpdate, timestamp)
    : null;
  const updatedMethodologyProgress = (isAERole && salesMethodology && methodologyStages.length > 0)
    ? applyMethodologyStageUpdates(
        (session as any).methodologyProgress as MethodologyProgress | null,
        analysis.methodologyStageUpdates,
        salesMethodology,
        methodologyStages,
        timestamp
      )
    : null;

  // Accumulate role-specific fields
  type CompetitorMention = { name: string; context: string };
  type TimelineSignal = { date: string; context: string; urgency?: string };
  type RiskFlag = { text: string; type?: string };
  type Requirement = { text: string; source?: string };
  type PainPoint = { text: string; impact?: string };

  const updatedCompetitorMentions = features.competitorMentions
    ? dedupeByText([...safeArray<CompetitorMention>(session.competitorMentions), ...(analysis.competitorMentions || [])], (m: CompetitorMention) => m.name.toLowerCase())
    : undefined;
  const updatedTimelineSignals = features.timelineSignals
    ? [...safeArray<TimelineSignal>(session.timelineSignals), ...(analysis.timelineSignals || [])]
    : undefined;
  const updatedRiskFlags = features.riskFlags
    ? dedupeByText([...safeArray<RiskFlag>(session.riskFlags), ...(analysis.riskFlags || [])], (r: RiskFlag) => r.text.toLowerCase().slice(0, 40))
    : undefined;
  const updatedRequirements = features.requirements
    ? dedupeByText([...safeArray<Requirement>(session.requirements), ...(analysis.requirements || [])], (r: Requirement) => r.text.toLowerCase().slice(0, 40))
    : undefined;
  const updatedPainPoints = features.painPoints
    ? dedupeByText([...safeArray<PainPoint>(session.painPoints), ...(analysis.painPoints || [])], (p: PainPoint) => p.text.toLowerCase().slice(0, 40))
    : undefined;

  const allTopics = await storage.getTopicsBySession(sessionId);
  const formattedTranscript = `[${speaker}] ${transcriptText}`;

  await persistSessionUpdates(
    sessionId,
    {
      totalTopics: allTopics.length,
      sentimentData: updatedSentimentData,
      overallSentiment,
      speakers: updatedSpeakers,
      ...(features.actionItems ? { actionItems: updatedActionItems } : {}),
      ...(features.followUpQuestions ? { followUpQuestions: updatedFollowUpQuestions } : {}),
      ...(newSimilarMatches.length > 0 ? { similarProjectMatches: updatedSimilarMatches } : {}),
      ...(updatedBantData ? { bantData: updatedBantData } : {}),
      ...(updatedMethodologyProgress ? { methodologyProgress: updatedMethodologyProgress } : {}),
      ...(updatedCompetitorMentions ? { competitorMentions: updatedCompetitorMentions } : {}),
      ...(updatedTimelineSignals ? { timelineSignals: updatedTimelineSignals } : {}),
      ...(updatedRiskFlags ? { riskFlags: updatedRiskFlags } : {}),
      ...(updatedRequirements ? { requirements: updatedRequirements } : {}),
      ...(updatedPainPoints ? { painPoints: updatedPainPoints } : {}),
    },
    formattedTranscript,
    transcriptText
  );

  return {
    transcript: formattedTranscript,
    speaker,
    speakerTitle: speakerTitle || undefined,
    speakers: updatedSpeakers,
    sentiment: { score: sentimentScore, label: sentimentLabel },
    overallSentiment,
    newTopics,
    updatedTopics,
    allTopics,
    actionItems: newActionItems,
    followUpQuestions: newFollowUpQuestions,
    allActionItems: updatedActionItems,
    similarProjects: newSimilarMatches,
    bantData: updatedBantData,
    methodologyProgress: updatedMethodologyProgress,
    competitorMentions: analysis.competitorMentions || [],
    allCompetitorMentions: updatedCompetitorMentions || [],
    timelineSignals: analysis.timelineSignals || [],
    allTimelineSignals: updatedTimelineSignals || [],
    riskFlags: analysis.riskFlags || [],
    allRiskFlags: updatedRiskFlags || [],
    requirements: analysis.requirements || [],
    allRequirements: updatedRequirements || [],
    painPoints: analysis.painPoints || [],
    allPainPoints: updatedPainPoints || [],
  };
}

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {

  app.use("/api", (req, res, next) => {
    if (req.path === "/login" || req.path === "/callback" || req.path === "/logout" || req.path === "/auth/user") {
      return next();
    }
    isAuthenticated(req, res, next);
  });

  app.get("/api/settings", async (_req, res) => {
    try {
      const s = await storage.getSettings();
      res.json(s);
    } catch (error) {
      console.error("Error fetching settings:", error);
      res.status(500).json({ error: "Failed to fetch settings" });
    }
  });

  const updateSettingsSchema = z.object({
    hostRole: z.enum(["host", "producer", "engineer", "correspondent", "account-executive"]).optional(),
    analysisModel: z.enum(["gpt-4o-mini", "gpt-4o", "gpt-4.1-nano", "gpt-4.1-mini", "gpt-4.1", "o3-mini", "o4-mini"]).optional(),
    transcriptionModel: z.enum(["gpt-4o-mini-transcribe", "gpt-4o-transcribe"]).optional(),
    caseStudyUrls: z.array(z.string().url()).optional(),
    salesMethodology: z.enum(["sandler", "meddic", "spin", "challenger"]).nullable().optional(),
  });

  app.patch("/api/settings", async (req, res) => {
    try {
      const parsed = updateSettingsSchema.parse(req.body);
      if (Object.keys(parsed).length === 0) {
        return res.status(400).json({ error: "No valid fields to update" });
      }
      const s = await storage.updateSettings(parsed);
      res.json(s);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid settings data", details: error.issues });
      }
      console.error("Error updating settings:", error);
      res.status(500).json({ error: "Failed to update settings" });
    }
  });

  // ─── API Key (browser mode) ───────────────────────────────────────────────
  // In Electron mode the key is managed via IPC (electron-store + process restart).
  // In browser/standalone mode these endpoints let the UI read/write the key
  // against process.env at runtime and persist it to the .env file.

  app.get("/api/settings/api-key", (_req, res) => {
    const key = process.env.OPENAI_API_KEY || "";
    const configured = key.length > 0 && key !== "not-configured";
    res.json({
      configured,
      masked: configured ? `${key.slice(0, 7)}…${key.slice(-4)}` : null,
    });
  });

  app.post("/api/settings/api-key", (req, res) => {
    const { key } = req.body as { key?: string };
    if (!key || typeof key !== "string" || !key.trim()) {
      return res.status(400).json({ error: "key is required" });
    }
    const trimmed = key.trim();
    process.env.OPENAI_API_KEY = trimmed;

    // Persist to the .env file at the project root so it survives restarts.
    try {
      const fs = require("fs");
      const path = require("path");
      const envPath = path.resolve(__dirname, "../.env");
      let contents = fs.existsSync(envPath) ? fs.readFileSync(envPath, "utf8") : "";
      if (/^OPENAI_API_KEY=.*/m.test(contents)) {
        contents = contents.replace(/^OPENAI_API_KEY=.*/m, `OPENAI_API_KEY=${trimmed}`);
      } else {
        contents = contents.trimEnd() + (contents.length ? "\n" : "") + `OPENAI_API_KEY=${trimmed}\n`;
      }
      fs.writeFileSync(envPath, contents, "utf8");
    } catch (err: any) {
      console.warn("[routes] Could not write .env file:", err.message);
    }

    res.json({ ok: true });
  });

  app.get("/api/sessions", async (_req, res) => {
    try {
      const sessions = await storage.getAllSessions();
      res.json(sessions);
    } catch (error) {
      console.error("Error fetching sessions:", error);
      res.status(500).json({ error: "Failed to fetch sessions" });
    }
  });

  app.get("/api/sessions/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const session = await storage.getSession(id);
      if (!session) return res.status(404).json({ error: "Session not found" });
      const sessionTopics = await storage.getTopicsBySession(id);
      res.json({ ...session, topics: sessionTopics });
    } catch (error) {
      console.error("Error fetching session:", error);
      res.status(500).json({ error: "Failed to fetch session" });
    }
  });

  app.post("/api/sessions", async (req, res) => {
    try {
      const { title, clientName, industry } = req.body;
      const session = await storage.createSession({
        title: title || "New Session",
        clientName: clientName || null,
        industry: industry || null,
      });
      res.status(201).json(session);
    } catch (error) {
      console.error("Error creating session:", error);
      res.status(500).json({ error: "Failed to create session" });
    }
  });

  const updateSessionSchema = z.object({
    title: z.string().min(1).optional(),
    clientName: z.string().nullable().optional(),
    industry: z.string().nullable().optional(),
    status: z.enum(["active", "completed"]).optional(),
  });

  app.patch("/api/sessions/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const parsed = updateSessionSchema.parse(req.body);
      const session = await storage.updateSession(id, parsed);
      if (!session) return res.status(404).json({ error: "Session not found" });
      res.json(session);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid session data", details: error.issues });
      }
      console.error("Error updating session:", error);
      res.status(500).json({ error: "Failed to update session" });
    }
  });

  app.patch("/api/sessions/:id/end", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const session = await storage.endSession(id);
      if (!session) return res.status(404).json({ error: "Session not found" });

      if (session.transcript && session.transcript.length > 200) {
        generateSummary(id, session.transcript).catch((err) =>
          console.error("Background summary generation failed:", err)
        );
      }

      res.json(session);
    } catch (error) {
      console.error("Error ending session:", error);
      res.status(500).json({ error: "Failed to end session" });
    }
  });

  app.post("/api/sessions/:id/generate-summary", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const session = await storage.getSession(id);
      if (!session) return res.status(404).json({ error: "Session not found" });
      if (!session.transcript || session.transcript.length < 200) {
        return res.status(400).json({ error: "Not enough transcript to summarize" });
      }
      const summary = await generateSummary(id, session.transcript);
      res.json({ summary });
    } catch (error) {
      console.error("Error generating summary:", error);
      res.status(500).json({ error: "Failed to generate summary" });
    }
  });

  app.delete("/api/sessions/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      await storage.deleteSession(id);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting session:", error);
      res.status(500).json({ error: "Failed to delete session" });
    }
  });

  app.get("/api/sessions/:id/topics", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const sessionTopics = await storage.getTopicsBySession(id);
      res.json(sessionTopics);
    } catch (error) {
      console.error("Error fetching topics:", error);
      res.status(500).json({ error: "Failed to fetch topics" });
    }
  });

  const updateTopicSchema = z.object({
    term: z.string().min(1).optional(),
    definition: z.string().optional(),
    category: z.string().optional(),
    type: z.enum(["concept", "tool", "industry"]).optional(),
    capabilitySource: z.enum(["in-house", "partner", "unknown"]).optional(),
    partnerName: z.string().nullable().optional(),
  });

  app.patch("/api/topics/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const parsed = updateTopicSchema.parse(req.body);
      const topic = await storage.updateTopic(id, parsed);
      if (!topic) return res.status(404).json({ error: "Topic not found" });
      res.json(topic);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid topic data", details: error.issues });
      }
      console.error("Error updating topic:", error);
      res.status(500).json({ error: "Failed to update topic" });
    }
  });

  app.post("/api/sessions/:id/analyze", audioBodyParser, async (req, res) => {
    try {
      const sessionId = parseInt(req.params.id);
      const { audio } = req.body;

      if (!audio) {
        return res.status(400).json({ error: "Audio data is required" });
      }

      if (!process.env.OPENAI_API_KEY || process.env.OPENAI_API_KEY === "not-configured") {
        return res.status(401).json({ error: "OpenAI API key is not configured. Please add it in Settings." });
      }

      const session = await storage.getSession(sessionId);
      if (!session) return res.status(404).json({ error: "Session not found" });

      const features: FeatureFlags = {
        actionItems: !!req.body.features?.actionItems,
        followUpQuestions: !!req.body.features?.followUpQuestions,
        similarProjects: !!req.body.features?.similarProjects,
      };

      const appSettings = await storage.getSettings();
      const transcriptionModel = appSettings.transcriptionModel || "gpt-4o-mini-transcribe";

      const rawBuffer = Buffer.from(audio, "base64");
      const detectedFormat = detectAudioFormat(rawBuffer);
      const formatExt = detectedFormat === "unknown" ? "webm" : detectedFormat;

      const file = await toFile(rawBuffer, `audio.${formatExt}`);
      const transcription = await withRetry(
        () => openai.audio.transcriptions.create({ file, model: transcriptionModel }),
        { label: `transcribe(session=${sessionId})` }
      );

      const transcriptText = transcription.text.trim();

      if (!transcriptText || transcriptText.length < 3) {
        return res.json({ transcript: "", topics: [], newTopics: [] });
      }

      await storage.updateSession(sessionId, {
        transcript: session.transcript ? session.transcript + " " + transcriptText : transcriptText,
      });

      let voiceMatch: VoiceMatchHint | undefined;
      if (req.body.voiceMatch) {
        const vm = req.body.voiceMatch;
        const confidence = Number(vm.confidence);
        if (
          typeof vm.name === "string" && vm.name.trim().length > 0 &&
          Number.isFinite(confidence) && confidence >= 0 && confidence <= 1
        ) {
          voiceMatch = {
            name: vm.name.trim(),
            title: typeof vm.title === "string" && vm.title.trim() ? vm.title.trim() : undefined,
            confidence,
          };
        }
      }
      const result = await enqueueForSession(sessionId, () =>
        processAnalysis(sessionId, transcriptText, session, features, voiceMatch)
      );
      res.json(result);

    } catch (error) {
      console.error("Error analyzing audio:", error);
      const msg = error instanceof Error ? error.message : String(error);
      const isAuthError = msg.includes("401") || msg.toLowerCase().includes("api key") || msg.toLowerCase().includes("authentication") || msg.toLowerCase().includes("incorrect api key");
      if (isAuthError) {
        return res.status(401).json({ error: "OpenAI API key is missing or invalid. Set OPENAI_API_KEY in your .env file or via Settings.", detail: msg });
      }
      res.status(500).json({ error: "Failed to analyze audio", detail: msg });
    }
  });

  app.post("/api/sessions/:id/demo-analyze", async (req, res) => {
    try {
      const sessionId = parseInt(req.params.id);
      const { text, speaker: explicitSpeaker } = req.body;

      if (!text) {
        return res.status(400).json({ error: "Text is required" });
      }

      if (!process.env.OPENAI_API_KEY || process.env.OPENAI_API_KEY === "not-configured") {
        return res.status(401).json({ error: "OpenAI API key is not configured. Please add it in Settings." });
      }

      const features: FeatureFlags = {
        actionItems: !!req.body.features?.actionItems,
        followUpQuestions: !!req.body.features?.followUpQuestions,
        similarProjects: !!req.body.features?.similarProjects,
      };

      const session = await storage.getSession(sessionId);
      if (!session) return res.status(404).json({ error: "Session not found" });

      await storage.updateSession(sessionId, {
        transcript: session.transcript ? session.transcript + " " + text : text,
      });

      // Use the explicit speaker name as a high-confidence voiceMatch so
      // resolveSpeaker bypasses AI detection for demo chunks.
      const demoVoiceMatch = explicitSpeaker
        ? { name: String(explicitSpeaker), confidence: 1.0 }
        : undefined;

      const result = await enqueueForSession(sessionId, () =>
        processAnalysis(sessionId, text, session, features, demoVoiceMatch)
      );
      res.json(result);

    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      console.error("Error in demo analysis:", error);
      res.status(500).json({ error: "Failed to analyze demo text", detail: msg });
    }
  });

  app.get("/api/voice-profiles", async (_req, res) => {
    try {
      const profiles = await storage.getVoiceProfiles();
      res.json(profiles);
    } catch (error) {
      console.error("Error fetching voice profiles:", error);
      res.status(500).json({ error: "Failed to fetch voice profiles" });
    }
  });

  app.post("/api/voice-profiles", async (req, res) => {
    try {
      const { name, title, isActive, frequencyData } = req.body;
      const sampleCount = frequencyData?.sampleCount ?? 0;
      const profile = await storage.createVoiceProfile({
        name: name || "My Voice",
        title: title || null,
        isActive: isActive ?? true,
        frequencyData,
      });
      if (sampleCount > 0) {
        const updated = await storage.updateVoiceProfile(profile.id, { sampleCount });
        res.status(201).json(updated ?? profile);
      } else {
        res.status(201).json(profile);
      }
    } catch (error) {
      console.error("Error creating voice profile:", error);
      res.status(500).json({ error: "Failed to create voice profile" });
    }
  });

  const updateVoiceProfileSchema = z.object({
    name: z.string().min(1).optional(),
    title: z.string().nullable().optional(),
    sampleCount: z.number().int().min(0).optional(),
  });

  app.patch("/api/voice-profiles/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const parsed = updateVoiceProfileSchema.parse(req.body);
      const profile = await storage.updateVoiceProfile(id, parsed);
      if (!profile) return res.status(404).json({ error: "Profile not found" });
      res.json(profile);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid voice profile data", details: error.issues });
      }
      console.error("Error updating voice profile:", error);
      res.status(500).json({ error: "Failed to update voice profile" });
    }
  });

  app.delete("/api/voice-profiles/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      await storage.deleteVoiceProfile(id);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting voice profile:", error);
      res.status(500).json({ error: "Failed to delete voice profile" });
    }
  });

  app.post("/api/voice-profiles/:id/train", audioBodyParser, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const { frequencyData } = req.body;

      const profile = await storage.updateVoiceProfile(id, {
        frequencyData,
        sampleCount: ((await storage.getVoiceProfiles()).find(p => p.id === id)?.sampleCount ?? 0) + 1,
      });

      if (!profile) return res.status(404).json({ error: "Profile not found" });
      res.json(profile);
    } catch (error) {
      console.error("Error training voice profile:", error);
      res.status(500).json({ error: "Failed to train voice profile" });
    }
  });

  app.get("/api/partners", async (_req, res) => {
    try {
      const allPartners = await storage.getPartners();
      res.json(allPartners);
    } catch (error) {
      console.error("Error fetching partners:", error);
      res.status(500).json({ error: "Failed to fetch partners" });
    }
  });

  // Invalidate the static prompt context cache on any write to partners,
  // competencies, or reference-projects so the next analyze call re-fetches.
  app.use(/^\/api\/(partners|competencies|reference-projects)/, (req, _res, next) => {
    if (req.method !== "GET") invalidateStaticContext();
    next();
  });

  app.post("/api/partners", async (req, res) => {
    try {
      const { name, specialties, contactInfo, notes } = req.body;
      const partner = await storage.createPartner({
        name,
        specialties: specialties || [],
        contactInfo: contactInfo || null,
        notes: notes || null,
      });
      res.status(201).json(partner);
    } catch (error) {
      console.error("Error creating partner:", error);
      res.status(500).json({ error: "Failed to create partner" });
    }
  });

  const updatePartnerSchema = z.object({
    name: z.string().min(1).optional(),
    specialties: z.array(z.string()).optional(),
    website: z.string().nullable().optional(),
    notes: z.string().nullable().optional(),
  });

  app.patch("/api/partners/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const parsed = updatePartnerSchema.parse(req.body);
      const partner = await storage.updatePartner(id, parsed);
      if (!partner) return res.status(404).json({ error: "Partner not found" });
      res.json(partner);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid partner data", details: error.issues });
      }
      console.error("Error updating partner:", error);
      res.status(500).json({ error: "Failed to update partner" });
    }
  });

  app.delete("/api/partners/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      await storage.deletePartner(id);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting partner:", error);
      res.status(500).json({ error: "Failed to delete partner" });
    }
  });

  app.delete("/api/partners", async (_req, res) => {
    try {
      await storage.deleteAllPartners();
      res.status(204).send();
    } catch (error) {
      console.error("Error clearing partners:", error);
      res.status(500).json({ error: "Failed to clear partners" });
    }
  });

  const createCompetencySchema = z.object({
    name: z.string().min(1),
    type: z.enum(["service", "product", "offering"]),
    source: z.enum(["in-house", "partner"]),
    partnerName: z.string().nullable().optional(),
    consultancyName: z.string().nullable().optional(),
    description: z.string().nullable().optional(),
  });

  app.get("/api/competencies", async (_req, res) => {
    try {
      const all = await storage.getCompetencies();
      res.json(all);
    } catch (error) {
      console.error("Error fetching competencies:", error);
      res.status(500).json({ error: "Failed to fetch competencies" });
    }
  });

  app.post("/api/competencies", async (req, res) => {
    try {
      const parsed = createCompetencySchema.parse(req.body);
      const competency = await storage.createCompetency(parsed);
      res.status(201).json(competency);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid competency data", details: error.issues });
      }
      console.error("Error creating competency:", error);
      res.status(500).json({ error: "Failed to create competency" });
    }
  });

  const updateCompetencySchema = z.object({
    name: z.string().min(1).optional(),
    type: z.enum(["service", "product", "offering"]).optional(),
    source: z.enum(["in-house", "partner"]).optional(),
    partnerName: z.string().nullable().optional(),
    description: z.string().nullable().optional(),
  });

  app.patch("/api/competencies/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const parsed = updateCompetencySchema.parse(req.body);
      const competency = await storage.updateCompetency(id, parsed);
      if (!competency) return res.status(404).json({ error: "Competency not found" });
      res.json(competency);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid competency data", details: error.issues });
      }
      console.error("Error updating competency:", error);
      res.status(500).json({ error: "Failed to update competency" });
    }
  });

  app.delete("/api/competencies/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      await storage.deleteCompetency(id);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting competency:", error);
      res.status(500).json({ error: "Failed to delete competency" });
    }
  });

  app.delete("/api/competencies", async (_req, res) => {
    try {
      await storage.deleteAllCompetencies();
      res.status(204).send();
    } catch (error) {
      console.error("Error clearing competencies:", error);
      res.status(500).json({ error: "Failed to clear competencies" });
    }
  });

  app.post("/api/competencies/scrape", async (req, res) => {
    try {
      const { url } = req.body;
      if (!url || typeof url !== "string") {
        return res.status(400).json({ error: "URL is required" });
      }

      try {
        const parsed = new URL(url);
        if (!["http:", "https:"].includes(parsed.protocol)) {
          return res.status(400).json({ error: "Only HTTP/HTTPS URLs are allowed" });
        }
      } catch {
        return res.status(400).json({ error: "Invalid URL format" });
      }

      const response = await fetch(url, {
        headers: { "User-Agent": "NRIOnTopic/1.0 (Competency Scraper)" },
        signal: AbortSignal.timeout(15000),
      });
      if (!response.ok) {
        return res.status(400).json({ error: `Failed to fetch URL: ${response.status} ${response.statusText}` });
      }

      const html = await response.text();

      const imageContext: string[] = [];
      const imgRegex = /<img[^>]*(?:alt|title)="([^"]+)"[^>]*>/gi;
      let imgMatch;
      while ((imgMatch = imgRegex.exec(html)) !== null) {
        const val = imgMatch[1].trim();
        if (val && val.length > 1 && !/^mask\s*group/i.test(val) && !/^image/i.test(val) && !/^img/i.test(val) && !/^logo$/i.test(val) && !/^\d+$/.test(val)) {
          const cleaned = val.replace(/[_-]/g, " ").replace(/\.\w+\s*\d*$/, "").replace(/\s+/g, " ").trim();
          if (cleaned.length > 1 && !imageContext.includes(cleaned)) {
            imageContext.push(cleaned);
          }
        }
      }

      const linkTexts: string[] = [];
      const linkRegex = /<a[^>]*>([^<]{2,80})<\/a>/gi;
      let linkMatch;
      while ((linkMatch = linkRegex.exec(html)) !== null) {
        const text = linkMatch[1].trim();
        if (text && text.length > 1 && text.length < 80 && !/</.test(text)) {
          linkTexts.push(text);
        }
      }

      const textContent = html
        .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
        .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
        .replace(/<[^>]+>/g, " ")
        .replace(/&nbsp;/g, " ")
        .replace(/&amp;/g, "&")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, 10000);

      const enrichedContent = [
        textContent,
        imageContext.length > 0 ? `\n\nImage alt-text/titles found on page: ${imageContext.join(", ")}` : "",
        linkTexts.length > 0 ? `\n\nLink text found on page: ${linkTexts.slice(0, 50).join(", ")}` : "",
      ].join("");

      if (enrichedContent.length < 50) {
        return res.status(400).json({ error: "Could not extract meaningful content from URL" });
      }

      const isPartnerPage = /partner/i.test(url) || /partner/i.test(textContent.slice(0, 500));

      let consultancyName = "";
      const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
      if (titleMatch) {
        const rawTitle = titleMatch[1].trim();
        consultancyName = rawTitle
          .split(/\s*[-–—|:]\s*/)[0]
          .replace(/\s*(Partners?|Services?|Products?|Solutions?|About|Home)\s*/gi, "")
          .trim();
      }
      if (!consultancyName) {
        try {
          const parsedUrl = new URL(url);
          consultancyName = parsedUrl.hostname.replace(/^www\./, "").split(".")[0];
          consultancyName = consultancyName.charAt(0).toUpperCase() + consultancyName.slice(1);
        } catch {}
      }

      const appSettings = await storage.getSettings();
      const model = appSettings.analysisModel || "gpt-4o-mini";

      const systemPrompt = isPartnerPage
        ? `You are analyzing a company's partners/alliances page to extract the names of their technology partners and vendors, AND the key products/services each partner is known for.

For each partner you identify, create MULTIPLE entries — one for the partner company itself, plus entries for their well-known products, services, and platforms that an IT consultancy would typically resell or implement.

Examples:
- If you see "Microsoft" → generate entries for: "Microsoft" (partner company), "Microsoft Azure" (cloud platform), "Microsoft 365 / Modern Work" (productivity suite), "Microsoft Entra ID" (identity management), "Microsoft Sentinel" (SIEM), "Microsoft Copilot" (AI assistant), etc.
- If you see "Cisco" → generate: "Cisco" (networking), "Cisco Meraki" (cloud-managed networking), "Cisco Webex" (collaboration), "Cisco Umbrella" (DNS security), etc.
- If you see "CrowdStrike" → generate: "CrowdStrike" (endpoint security), "CrowdStrike Falcon" (EDR platform), etc.

Categorize each entry:
- "product" = specific product, platform, or tool (e.g. Azure, Falcon, Meraki)
- "service" = consulting, managed services, support offerings
- "offering" = packaged solutions, bundles, or programs

For each item provide:
- name: concise product/service name
- type: service|product|offering
- description: 1 sentence about what it does
- partnerName: the parent partner company name (e.g. "Microsoft" for "Microsoft Azure")

Important:
- Look at image alt-text and link text — partner logos often contain company names in alt attributes
- Clean up names: remove file extensions, numbers, underscores — e.g. "Commvault_logo_2019 1" → "Commvault", "Equinix_logo.svg 1" → "Equinix"
- Include ALL partners you can identify, even from subtle clues like logo filenames
- Exclude the company whose website this is — only list their partners
- For major technology vendors (Microsoft, Cisco, AWS, Google, etc.), expand into 3-6 key products/services each
- For smaller/niche vendors, include 1-2 key products

Return JSON: {"items": [{"name":"...","type":"service|product|offering","description":"...","partnerName":"..."}]}`
        : `You are analyzing a company's website to extract their services, products, and specific offerings. 
Identify what this company does and categorize each capability:
- "service" = consulting, managed services, professional services, support offerings
- "product" = software products, platforms, tools they sell or resell
- "offering" = specific packaged solutions, bundles, or named programs

For each item provide: name (concise), type (service/product/offering), and description (1 sentence).

Return JSON: {"items": [{"name":"...","type":"service|product|offering","description":"..."}]}

Be specific and practical. Extract 5-20 items. Focus on technology and IT-related capabilities.`;

      const userPrompt = isPartnerPage
        ? `Extract ALL partner/vendor company names from this partners page content:\n\n${enrichedContent}`
        : `Extract the services, products, and offerings from this website content:\n\n${enrichedContent}`;

      const aiResponse = await withRetry(
        () => openai.chat.completions.create({
          model,
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt },
          ],
          response_format: { type: "json_object" },
          temperature: 0.3,
        }),
        { label: "competencyScrape" }
      );

      const content = aiResponse.choices[0]?.message?.content || "{}";
      let suggestions: Array<{ name: string; type: string; description: string }> = [];
      try {
        const parsed = JSON.parse(content);
        suggestions = Array.isArray(parsed) ? parsed : (parsed.items || parsed.competencies || parsed.capabilities || parsed.results || parsed.partners || []);
      } catch {
        return res.status(500).json({ error: "Failed to parse AI response" });
      }

      res.json({ suggestions, sourceUrl: url, isPartnerPage, consultancyName });
    } catch (error: any) {
      console.error("Error scraping website:", error);
      if (error?.name === "TimeoutError" || error?.name === "AbortError") {
        return res.status(400).json({ error: "Website took too long to respond" });
      }
      res.status(500).json({ error: "Failed to scrape website" });
    }
  });

  app.get("/api/reference-projects", async (_req, res) => {
    try {
      const all = await storage.getReferenceProjects();
      res.json(all);
    } catch (error) {
      console.error("Error fetching reference projects:", error);
      res.status(500).json({ error: "Failed to fetch reference projects" });
    }
  });

  const createReferenceProjectSchema = z.object({
    title: z.string().min(1),
    description: z.string().min(1),
    url: z.string().nullable().optional(),
    tags: z.array(z.string()).optional(),
    industry: z.string().nullable().optional(),
    clientName: z.string().nullable().optional(),
    projectDate: z.string().nullable().optional(),
  });

  app.post("/api/reference-projects", async (req, res) => {
    try {
      const parsed = createReferenceProjectSchema.parse(req.body);
      const project = await storage.createReferenceProject({
        title: parsed.title,
        description: parsed.description,
        url: parsed.url || null,
        tags: parsed.tags || [],
        industry: parsed.industry || null,
        clientName: parsed.clientName || null,
        projectDate: parsed.projectDate ? new Date(parsed.projectDate) : null,
      });
      res.status(201).json(project);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid project data", details: error.issues });
      }
      console.error("Error creating reference project:", error);
      res.status(500).json({ error: "Failed to create reference project" });
    }
  });

  const updateReferenceProjectSchema = z.object({
    title: z.string().min(1).optional(),
    description: z.string().min(1).optional(),
    url: z.string().nullable().optional(),
    tags: z.array(z.string()).optional(),
    industry: z.string().nullable().optional(),
    clientName: z.string().nullable().optional(),
    projectDate: z.string().nullable().optional(),
  });

  app.patch("/api/reference-projects/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const parsed = updateReferenceProjectSchema.parse(req.body);
      const data: Record<string, any> = { ...parsed };
      if (data.projectDate !== undefined) {
        data.projectDate = data.projectDate ? new Date(data.projectDate) : null;
      }
      const project = await storage.updateReferenceProject(id, data);
      if (!project) return res.status(404).json({ error: "Project not found" });
      res.json(project);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid project data", details: error.issues });
      }
      console.error("Error updating reference project:", error);
      res.status(500).json({ error: "Failed to update reference project" });
    }
  });

  app.delete("/api/reference-projects/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      await storage.deleteReferenceProject(id);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting reference project:", error);
      res.status(500).json({ error: "Failed to delete reference project" });
    }
  });

  app.post("/api/reference-projects/scrape", async (req, res) => {
    try {
      const { url } = req.body;
      if (!url || typeof url !== "string") {
        return res.status(400).json({ error: "URL is required" });
      }

      try {
        const parsed = new URL(url);
        if (!["http:", "https:"].includes(parsed.protocol)) {
          return res.status(400).json({ error: "Only HTTP/HTTPS URLs are allowed" });
        }
      } catch {
        return res.status(400).json({ error: "Invalid URL format" });
      }

      const response = await fetch(url, {
        headers: { "User-Agent": "NRIOnTopic/1.0 (Case Study Scraper)" },
        signal: AbortSignal.timeout(15000),
      });
      if (!response.ok) {
        return res.status(400).json({ error: `Failed to fetch URL: ${response.status} ${response.statusText}` });
      }

      const html = await response.text();
      const textContent = html
        .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
        .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
        .replace(/<[^>]+>/g, " ")
        .replace(/&nbsp;/g, " ")
        .replace(/&amp;/g, "&")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, 12000);

      if (textContent.length < 50) {
        return res.status(400).json({ error: "Could not extract meaningful content from URL" });
      }

      const appSettings = await storage.getSettings();
      const model = appSettings.analysisModel || "gpt-4o-mini";

      const aiResponse = await withRetry(
        () => openai.chat.completions.create({
          model,
          messages: [
            {
              role: "system",
              content: `You are analyzing a webpage (likely a case study, project portfolio, or reference page) to extract IT consulting project references.

For each project or case study you identify, extract:
- title: concise project name (e.g. "Contoso Cloud Migration")
- description: 2-3 sentence summary of the project scope, technologies used, and outcome
- tags: array of relevant technology/capability tags (e.g. ["Azure", "migration", "Active Directory"])
- industry: the client's industry if mentioned (e.g. "Healthcare", "Financial Services", "Manufacturing")
- clientName: the client company name if mentioned, or null

Return JSON: {"projects": [{"title":"...","description":"...","tags":["..."],"industry":"...","clientName":"..."}]}

Extract 1-10 projects. Focus on IT consulting, technology implementation, and digital transformation projects. Be specific about technologies and outcomes.`,
            },
            {
              role: "user",
              content: `Extract case study / reference project information from this webpage content:\n\n${textContent}`,
            },
          ],
          response_format: { type: "json_object" },
          temperature: 0.3,
        }),
        { label: "caseStudyScrape" }
      );

      const content = aiResponse.choices[0]?.message?.content || "{}";
      let suggestions: Array<{ title: string; description: string; tags: string[]; industry: string | null; clientName: string | null }> = [];
      try {
        const parsed = JSON.parse(content);
        suggestions = Array.isArray(parsed) ? parsed : (parsed.projects || parsed.items || parsed.caseStudies || parsed.references || []);
      } catch {
        return res.status(500).json({ error: "Failed to parse AI response" });
      }

      res.json({ suggestions, sourceUrl: url });
    } catch (error: any) {
      console.error("Error scraping case study:", error);
      if (error?.name === "TimeoutError" || error?.name === "AbortError") {
        return res.status(400).json({ error: "Website took too long to respond" });
      }
      res.status(500).json({ error: "Failed to scrape website" });
    }
  });

  const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

  app.post("/api/reference-projects/upload", upload.array("files", 10), async (req, res) => {
    try {
      const files = req.files as Express.Multer.File[];
      if (!files || files.length === 0) {
        return res.status(400).json({ error: "At least one file is required" });
      }

      const extractedTexts: string[] = [];

      for (const file of files) {
        const ext = file.originalname.toLowerCase().split(".").pop() || "";
        let text = "";

        if (["txt", "md", "csv"].includes(ext)) {
          text = file.buffer.toString("utf-8");
        } else if (ext === "docx") {
          const raw = file.buffer.toString("utf-8");
          const xmlParts = raw.match(/<w:t[^>]*>([^<]*)<\/w:t>/g);
          if (xmlParts) {
            text = xmlParts.map(p => p.replace(/<[^>]+>/g, "")).join(" ");
          } else {
            text = raw.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
          }
        } else if (ext === "pdf") {
          const raw = file.buffer.toString("latin1");
          const textMatches: string[] = [];
          const streamRegex = /stream\s*\n([\s\S]*?)endstream/g;
          let match;
          while ((match = streamRegex.exec(raw)) !== null) {
            const textInStream = match[1]
              .replace(/\[(.*?)\]\s*TJ/g, (_, inner) => inner.replace(/\(([^)]*)\)/g, "$1").replace(/-?\d+\.?\d*/g, " "))
              .replace(/\(([^)]*)\)\s*Tj/g, "$1");
            const cleaned = textInStream.replace(/[^\x20-\x7E\n]/g, " ").replace(/\s+/g, " ").trim();
            if (cleaned.length > 5) textMatches.push(cleaned);
          }
          text = textMatches.join(" ");
          if (text.length < 20) {
            text = raw.replace(/[^\x20-\x7E\n]/g, " ").replace(/\s+/g, " ").trim();
          }
        } else {
          text = file.buffer.toString("utf-8").replace(/[^\x20-\x7E\n]/g, " ").replace(/\s+/g, " ").trim();
        }

        if (text.length > 0) {
          extractedTexts.push(`--- File: ${file.originalname} ---\n${text.slice(0, 8000)}`);
        }
      }

      if (extractedTexts.length === 0) {
        return res.status(400).json({ error: "Could not extract text from uploaded files" });
      }

      const combinedText = extractedTexts.join("\n\n").slice(0, 15000);

      const appSettings = await storage.getSettings();
      const model = appSettings.analysisModel || "gpt-4o-mini";

      const aiResponse = await withRetry(
        () => openai.chat.completions.create({
          model,
          messages: [
            {
              role: "system",
              content: `You are analyzing uploaded documents to extract IT consulting project references and case studies.

For each project you identify, extract:
- title: concise project name
- description: 2-3 sentence summary of scope, technologies, and outcome
- tags: array of relevant technology/capability tags
- industry: client industry if mentioned, or null
- clientName: client company name if mentioned, or null

Return JSON: {"projects": [{"title":"...","description":"...","tags":["..."],"industry":"...","clientName":"..."}]}

Extract all distinct projects mentioned. Focus on IT consulting, technology implementations, and digital transformation.`,
            },
            {
              role: "user",
              content: `Extract project references from these documents:\n\n${combinedText}`,
            },
          ],
          response_format: { type: "json_object" },
          temperature: 0.3,
        }),
        { label: "documentUpload" }
      );

      const content = aiResponse.choices[0]?.message?.content || "{}";
      let suggestions: Array<{ title: string; description: string; tags: string[]; industry: string | null; clientName: string | null }> = [];
      try {
        const parsed = JSON.parse(content);
        suggestions = Array.isArray(parsed) ? parsed : (parsed.projects || parsed.items || parsed.caseStudies || []);
      } catch {
        return res.status(500).json({ error: "Failed to parse AI response" });
      }

      res.json({ suggestions, fileCount: files.length });
    } catch (error) {
      console.error("Error processing uploaded files:", error);
      res.status(500).json({ error: "Failed to process uploaded files" });
    }
  });

  // ---------------------------------------------------------------------------
  // Analytics endpoints
  // ---------------------------------------------------------------------------

  app.get("/api/analytics/topic-frequency", isAuthenticated, async (req, res) => {
    try {
      const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 25;
      const industry = (req.query.industry as string) || undefined;
      const fromMs = req.query.from ? parseInt(req.query.from as string, 10) : undefined;
      const toMs = req.query.to ? parseInt(req.query.to as string, 10) : undefined;
      const data = await getTopicFrequency({
        limit: isNaN(limit) ? 25 : limit,
        industry,
        from: fromMs ? new Date(fromMs) : undefined,
        to: toMs ? new Date(toMs) : undefined,
      });
      res.json(data);
    } catch (error) {
      console.error("Error fetching topic frequency:", error);
      res.status(500).json({ error: "Failed to fetch topic frequency" });
    }
  });

  app.get("/api/analytics/topic-trends", isAuthenticated, async (req, res) => {
    try {
      const fromMs = req.query.from ? parseInt(req.query.from as string, 10) : undefined;
      const toMs = req.query.to ? parseInt(req.query.to as string, 10) : undefined;
      const data = await getTopicTrends({
        from: fromMs ? new Date(fromMs) : undefined,
        to: toMs ? new Date(toMs) : undefined,
      });
      res.json(data);
    } catch (error) {
      console.error("Error fetching topic trends:", error);
      res.status(500).json({ error: "Failed to fetch topic trends" });
    }
  });

  app.get("/api/analytics/gaps", isAuthenticated, async (_req, res) => {
    try {
      const data = await getGapAnalysis();
      res.json(data);
    } catch (error) {
      console.error("Error fetching gap analysis:", error);
      res.status(500).json({ error: "Failed to fetch gap analysis" });
    }
  });

  app.get("/api/analytics/needs-vs-offerings", isAuthenticated, async (_req, res) => {
    try {
      const data = await getNeedsVsOfferings();
      res.json(data);
    } catch (error) {
      console.error("Error fetching needs vs offerings:", error);
      res.status(500).json({ error: "Failed to fetch needs vs offerings" });
    }
  });

  app.get("/api/analytics/industries", isAuthenticated, async (_req, res) => {
    try {
      const data = await getDistinctIndustries();
      res.json(data);
    } catch (error) {
      console.error("Error fetching industries:", error);
      res.status(500).json({ error: "Failed to fetch industries" });
    }
  });

  app.get("/api/sessions/:id/graph", isAuthenticated, async (req, res) => {
    try {
      const id = parseInt(req.params.id, 10);
      if (isNaN(id)) return res.status(400).json({ error: "Invalid session id" });
      const data = await buildSessionGraph(id);
      res.json(data);
    } catch (error) {
      console.error("Error building session graph:", error);
      res.status(500).json({ error: "Failed to build session graph" });
    }
  });

  return httpServer;
}
