import { storage } from "./storage";
import { db } from "./db";
import { sessions, topics } from "@shared/schema";
import { eq } from "drizzle-orm";
import type { AnalysisResult } from "./services/analysis";
import type { SentimentEntry, ActionItem, FollowUpQuestion, SpeakerEntry, ReferenceProject, BANTData, BANTField, MethodologyProgress } from "@shared/schema";
import { consolidateSimilarProjects } from "@shared/schema";
import { FeatureFlags, MethodologyStageDefinition } from "./constants";

interface VoiceMatchHint {
  name: string;
  title?: string;
  confidence: number;
}

export function resolveSpeaker(
  aiSpeaker: string | null,
  knownSpeakers: string[],
  voiceMatch?: VoiceMatchHint
): { speaker: string; speakerTitle: string | null } {
  let speaker = aiSpeaker;
  if (speaker === "null") speaker = null;

  const existingSpeakerLabels = knownSpeakers.filter(s => s.startsWith("Speaker "));
  const nextSpeakerNum = existingSpeakerLabels.length + 1;
  const lastSpeaker = knownSpeakers.length > 0 ? knownSpeakers[knownSpeakers.length - 1] : null;

  if (voiceMatch && voiceMatch.confidence >= 0.55) {
    speaker = voiceMatch.name;
  } else if (speaker === "NEW_SPEAKER" || !speaker) {
    if (speaker === "NEW_SPEAKER") {
      const namedSpeakers = knownSpeakers.filter(s => !s.startsWith("Speaker "));
      if (namedSpeakers.length <= 1 && lastSpeaker) {
        speaker = lastSpeaker;
      } else if (lastSpeaker && lastSpeaker.startsWith("Speaker ")) {
        speaker = lastSpeaker;
      } else {
        speaker = `Speaker ${nextSpeakerNum}`;
      }
    } else {
      speaker = lastSpeaker || `Speaker ${nextSpeakerNum}`;
    }
  }

  return { speaker: speaker!, speakerTitle: null };
}

export async function updateSessionTopics(
  sessionId: number,
  terms: AnalysisResult["terms"]
): Promise<{
  newTopics: Array<{ term: string; definition: string; category: string; type: string; capabilitySource: string; partnerName?: string }>;
  updatedTopics: Array<{ term: string; mentionCount: number }>;
}> {
  const newTopics: Array<{ term: string; definition: string; category: string; type: string; capabilitySource: string; partnerName?: string }> = [];
  const updatedTopics: Array<{ term: string; mentionCount: number }> = [];

  for (const item of terms || []) {
    if (!item.term) continue;

    const existing = await storage.findTopicByTerm(sessionId, item.term);

    if (existing) {
      const updated = await storage.updateTopic(existing.id, {
        mentionCount: existing.mentionCount + 1,
      });
      if (updated) {
        updatedTopics.push({ term: updated.term, mentionCount: updated.mentionCount });
      }
    } else if (item.definition && item.category) {
      const topic = await storage.createTopic({
        sessionId,
        term: item.term,
        definition: item.definition,
        category: item.category,
        type: item.type || "concept",
        capabilitySource: item.capabilitySource || "unknown",
        partnerName: item.partnerName || null,
      });
      newTopics.push({
        term: topic.term,
        definition: topic.definition,
        category: topic.category,
        type: topic.type,
        capabilitySource: topic.capabilitySource,
        partnerName: topic.partnerName || undefined,
      });
    }
  }

  return { newTopics, updatedTopics };
}

export function aggregateSentiment(
  existingSentiment: SentimentEntry[],
  analysis: AnalysisResult,
  speaker: string | null
): {
  newEntry: SentimentEntry;
  allSentiment: SentimentEntry[];
  overallSentiment: number;
} {
  const chunkIndex = existingSentiment.length;
  const sentimentScore = analysis.sentiment?.score ?? 0;
  const sentimentLabel = analysis.sentiment?.label ?? "neutral";

  const newEntry: SentimentEntry = {
    chunkIndex,
    score: sentimentScore,
    label: sentimentLabel,
    speaker: speaker || undefined,
  };
  const allSentiment = [...existingSentiment, newEntry];
  const totalScore = allSentiment.reduce((sum, s) => sum + s.score, 0);
  const overallSentiment = Math.round(totalScore / allSentiment.length);

  return { newEntry, allSentiment, overallSentiment };
}

export function accumulateSimilarProjects(
  existingMatches: Array<{ projectId: number; relevance: string; title?: string; industry?: string; clientName?: string; projectDate?: string }>,
  analysisMatches: Array<{ projectId: number; relevance: string }>,
  allReferenceProjects: ReferenceProject[]
): Array<{ projectId: number; relevance: string; title?: string; industry?: string; clientName?: string; projectDate?: string }> {
  const existingMatchIds = new Set(existingMatches.map(m => m.projectId));
  const newMatches = analysisMatches
    .filter((m: any) => !existingMatchIds.has(m.projectId))
    .map((m: any) => {
      const refProject = allReferenceProjects.find(p => p.id === m.projectId);
      return {
        projectId: m.projectId,
        relevance: m.relevance,
        title: refProject?.title,
        industry: refProject?.industry || undefined,
        clientName: refProject?.clientName || undefined,
        projectDate: refProject?.projectDate ? new Date(refProject.projectDate).toISOString() : undefined,
      };
    });
  const all = [...existingMatches, ...newMatches];
  return consolidateSimilarProjects(all);
}

export function updateSpeakersList(
  existingSpeakers: SpeakerEntry[],
  speaker: string | null,
  speakerTitle: string | null,
  isHost?: boolean
): SpeakerEntry[] {
  const updatedSpeakers = [...existingSpeakers];
  if (speaker) {
    const existingEntry = updatedSpeakers.find(s => s.name === speaker);
    if (existingEntry) {
      if (speakerTitle && !existingEntry.title) {
        existingEntry.title = speakerTitle;
      }
      if (isHost && existingEntry.role !== "host") {
        existingEntry.role = "host";
      }
    } else {
      const role = isHost ? "host" as const : "guest" as const;
      updatedSpeakers.push({ name: speaker, ...(speakerTitle ? { title: speakerTitle } : {}), role });
    }
  }
  return updatedSpeakers;
}

export function mergeBantData(
  existing: BANTData | null | undefined,
  update: AnalysisResult["bantUpdate"],
  timestamp: string
): BANTData | null {
  if (!update) return existing ?? null;

  const current: BANTData = existing ?? { budget: null, authority: null, needs: null, timeline: null };
  const keys = ["budget", "authority", "needs", "timeline"] as const;
  const result: BANTData = { ...current };

  for (const key of keys) {
    const newVal = update[key];
    if (!newVal || !newVal.value || newVal.value === "null") continue;

    const prev = current[key];
    if (!prev) {
      result[key] = {
        value: newVal.value,
        evidence: newVal.evidence || "",
        firstHeard: timestamp,
        lastUpdated: timestamp,
        history: [],
      };
    } else if (prev.value !== newVal.value) {
      result[key] = {
        value: newVal.value,
        evidence: newVal.evidence || "",
        firstHeard: prev.firstHeard,
        lastUpdated: timestamp,
        history: [
          ...prev.history,
          { value: prev.value, evidence: prev.evidence, timestamp: prev.lastUpdated },
        ],
      };
    }
  }

  return result;
}

export function applyMethodologyStageUpdates(
  existing: MethodologyProgress | null | undefined,
  stageUpdates: string[] | undefined,
  methodology: string,
  allStages: MethodologyStageDefinition[],
  timestamp: string
): MethodologyProgress {
  const resetNeeded = !existing || existing.methodology !== methodology;
  const current: MethodologyProgress = resetNeeded
    ? {
        methodology,
        stages: allStages.map(s => ({ id: s.id, name: s.name, completed: false })),
        lastUpdated: timestamp,
      }
    : { ...existing, stages: existing.stages.map(s => ({ ...s })) };

  for (const stageId of stageUpdates ?? []) {
    const stage = current.stages.find(s => s.id === stageId);
    if (stage && !stage.completed) {
      stage.completed = true;
      stage.completedAt = timestamp;
    }
  }

  current.lastUpdated = timestamp;
  return current;
}

export async function persistSessionUpdates(
  sessionId: number,
  updates: {
    totalTopics: number;
    sentimentData: SentimentEntry[];
    overallSentiment: number;
    speakers: SpeakerEntry[];
    actionItems?: ActionItem[];
    followUpQuestions?: FollowUpQuestion[];
    similarProjectMatches?: any[];
    bantData?: BANTData | null;
    methodologyProgress?: MethodologyProgress | null;
  },
  formattedTranscript: string,
  transcriptText: string
): Promise<void> {
  const [currentSession] = await db
    .select()
    .from(sessions)
    .where(eq(sessions.id, sessionId));

  if (!currentSession) {
    throw new Error(`Session ${sessionId} not found`);
  }

  const existingTranscript = currentSession.transcript || "";
  const rawChunk = existingTranscript.endsWith(transcriptText)
    ? existingTranscript.slice(0, existingTranscript.length - transcriptText.length)
    : (existingTranscript ? existingTranscript + "\n\n" : "");
  const updatedTranscript = rawChunk.trimEnd()
    ? rawChunk.trimEnd() + "\n\n" + formattedTranscript
    : formattedTranscript;

  await db
    .update(sessions)
    .set({
      ...updates,
      transcript: updatedTranscript,
    })
    .where(eq(sessions.id, sessionId));
}
