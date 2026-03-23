import { db } from "./db";
import { topics, sessions, competencies } from "@shared/schema";
import { eq, and, gte, lt, sql } from "drizzle-orm";
import type { Competency, Topic, SpeakerEntry } from "@shared/schema";

// ===========================================================================
// Topic consolidation helpers
// ===========================================================================

/**
 * Normalise a term for comparison: lowercase, strip punctuation,
 * strip trailing plural 's' from each word.
 */
function normalizeTerm(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w.replace(/ies$/, "y").replace(/s$/, ""))
    .join(" ")
    .trim();
}

/**
 * Returns true if `abbr` is an acronym formed from the first letters of the
 * meaningful words in `full` (stop words like "and", "of" are skipped).
 * Handles plural abbreviations (SLOs → SLO check vs "Service Level Objective").
 */
const ACRONYM_STOP = new Set(["and", "or", "the", "of", "in", "to", "with", "for", "a", "an", "at", "by"]);

function isAcronymOf(abbr: string, full: string): boolean {
  const a = abbr.replace(/s$/i, "").toUpperCase();
  if (a.length < 2 || a.length > 8) return false;
  if (!/^[A-Z0-9]+$/.test(a)) return false;
  const words = full.split(/\s+/).filter((w) => w.length > 0 && !ACRONYM_STOP.has(w.toLowerCase()));
  if (words.length !== a.length) return false;
  return words.every((w, i) => w[0].toUpperCase() === a[i]);
}

/**
 * Strip parenthetical expansions: "SRE (Site Reliability Engineering) model"
 * becomes "sre model", "SLO (Service Level Objective)" becomes "slo".
 */
function stripParens(s: string): string {
  return s.replace(/\s*\([^)]*\)/g, "").trim().toLowerCase();
}

/**
 * Returns true when two topic terms are semantically equivalent and should
 * be consolidated into a single entry.
 */
export function areSimilarTopics(a: string, b: string): boolean {
  const aL = a.toLowerCase().trim();
  const bL = b.toLowerCase().trim();
  if (aL === bL) return true;

  // Normalised form match (strips plurals, punctuation)
  const na = normalizeTerm(a);
  const nb = normalizeTerm(b);
  if (na === nb && na.length > 0) return true;

  // Parenthetical expansion match: "SRE (Site Reliability Engineering) model" ≡ "SRE model"
  const aStem = stripParens(aL);
  const bStem = stripParens(bL);
  if (aStem.length >= 2 && aStem === bStem) return true;
  if (aStem.length >= 3 && bStem.includes(aStem)) return true;
  if (bStem.length >= 3 && aStem.includes(bStem)) return true;

  // Acronym check in both directions
  if (isAcronymOf(a, b) || isAcronymOf(b, a)) return true;

  // One term contains the other as a substring (min 3 chars to catch acronyms like SLO)
  const shorter = aL.length <= bL.length ? aL : bL;
  const longer = aL.length <= bL.length ? bL : aL;
  if (shorter.length >= 3 && longer.includes(shorter)) return true;

  // Jaccard similarity on normalised words (≥ 0.6 threshold)
  const stop = new Set(["the", "a", "an", "and", "or", "for", "of", "in", "to", "with", "on", "at", "by"]);
  const wordsA = new Set(na.split(/\s+/).filter((w) => w.length > 1 && !stop.has(w)));
  const wordsB = new Set(nb.split(/\s+/).filter((w) => w.length > 1 && !stop.has(w)));
  if (wordsA.size === 0 || wordsB.size === 0) return false;
  const intersection = [...wordsA].filter((w) => wordsB.has(w)).length;
  const union = new Set([...wordsA, ...wordsB]).size;
  return intersection / union >= 0.6;
}

/**
 * Union-Find grouping of a list of terms by similarity.
 * Returns a Map<rootTerm, allTermsInGroup[]>.
 */
function groupSimilarTerms(terms: string[]): Map<string, string[]> {
  const parent = new Map<string, string>(terms.map((t) => [t, t]));

  function find(x: string): string {
    if (parent.get(x) !== x) parent.set(x, find(parent.get(x)!));
    return parent.get(x)!;
  }
  function union(a: string, b: string) {
    const ra = find(a);
    const rb = find(b);
    if (ra !== rb) parent.set(ra, rb);
  }

  for (let i = 0; i < terms.length; i++) {
    for (let j = i + 1; j < terms.length; j++) {
      if (areSimilarTopics(terms[i], terms[j])) {
        union(terms[i], terms[j]);
      }
    }
  }

  const groups = new Map<string, string[]>();
  for (const t of terms) {
    const root = find(t);
    if (!groups.has(root)) groups.set(root, []);
    groups.get(root)!.push(t);
  }
  return groups;
}

/**
 * From a group of similar terms, pick the most descriptive canonical label.
 * Prefers: more words → higher mention count → alphabetically first.
 */
function pickCanonical(terms: string[], mentionsByTerm: Map<string, number>): string {
  return terms.reduce((best, t) => {
    const bw = best.split(/\s+/).filter(Boolean).length;
    const tw = t.split(/\s+/).filter(Boolean).length;
    if (tw > bw) return t;
    if (tw === bw && (mentionsByTerm.get(t) ?? 0) > (mentionsByTerm.get(best) ?? 0)) return t;
    return best;
  });
}

// ===========================================================================
// Confidence matching: topic term → competency
// ===========================================================================

export function computeCompetencyMatch(topicTerm: string, competency: Competency): number {
  const term = topicTerm.toLowerCase().trim();
  const name = competency.name.toLowerCase().trim();
  const desc = (competency.description || "").toLowerCase();

  if (term === name) return 0.95;
  if (term.includes(name) || name.includes(term)) return 0.82;

  const stopWords = new Set(["the", "a", "an", "and", "or", "for", "of", "in", "to", "with", "on", "at", "by", "as", "is", "are", "was", "were"]);
  const termWords = new Set(term.split(/\W+/).filter((w) => w.length > 2 && !stopWords.has(w)));
  const compWords = new Set(
    [...name.split(/\W+/), ...desc.split(/\W+/)].filter((w) => w.length > 2 && !stopWords.has(w))
  );

  const intersection = [...termWords].filter((w) => compWords.has(w)).length;
  if (intersection === 0) return 0;

  const union = new Set([...termWords, ...compWords]).size;
  return Math.min(0.78, (intersection / union) * 2.5);
}

// ===========================================================================
// Topic frequency across all sessions
// ===========================================================================

export interface TopicFrequency {
  term: string;
  aliases: string[];
  category: string;
  capabilitySource: string;
  totalMentions: number;
  sessionCount: number;
}

export async function getTopicFrequency(options?: {
  limit?: number;
  industry?: string;
  from?: Date;
  to?: Date;
}): Promise<TopicFrequency[]> {
  const rawRows = await db
    .select({
      term: topics.term,
      category: topics.category,
      capabilitySource: topics.capabilitySource,
      totalMentions: sql<number>`SUM(${topics.mentionCount})::int`,
      sessionCount: sql<number>`COUNT(DISTINCT ${topics.sessionId})::int`,
    })
    .from(topics)
    .innerJoin(sessions, eq(topics.sessionId, sessions.id))
    .where(
      and(
        options?.industry ? eq(sessions.industry, options.industry) : undefined,
        options?.from ? gte(sessions.createdAt, options.from) : undefined,
        options?.to ? lt(sessions.createdAt, options.to) : undefined
      )
    )
    .groupBy(topics.term, topics.category, topics.capabilitySource)
    .orderBy(sql`SUM(${topics.mentionCount}) DESC`);

  // Consolidate similar terms
  const mentionsByTerm = new Map(rawRows.map((r) => [r.term, r.totalMentions]));
  const groups = groupSimilarTerms(rawRows.map((r) => r.term));

  const consolidated: TopicFrequency[] = [];
  for (const members of groups.values()) {
    const canonical = pickCanonical(members, mentionsByTerm);
    const memberRows = members.map((m) => rawRows.find((r) => r.term === m)!).filter(Boolean);

    // Majority-vote capabilitySource and category
    const capVotes = new Map<string, number>();
    const catVotes = new Map<string, number>();
    for (const r of memberRows) {
      capVotes.set(r.capabilitySource, (capVotes.get(r.capabilitySource) ?? 0) + r.totalMentions);
      catVotes.set(r.category, (catVotes.get(r.category) ?? 0) + r.totalMentions);
    }
    const capabilitySource = [...capVotes.entries()].sort((a, b) => b[1] - a[1])[0][0];
    const category = [...catVotes.entries()].sort((a, b) => b[1] - a[1])[0][0];

    consolidated.push({
      term: canonical,
      aliases: members.filter((m) => m !== canonical),
      category,
      capabilitySource,
      totalMentions: memberRows.reduce((s, r) => s + r.totalMentions, 0),
      sessionCount: Math.max(...memberRows.map((r) => r.sessionCount)),
    });
  }

  return consolidated
    .sort((a, b) => b.totalMentions - a.totalMentions)
    .slice(0, options?.limit ?? 25);
}

// ===========================================================================
// Topic trends — weekly category breakdown
// ===========================================================================

export interface TopicTrendRow {
  week: string;
  category: string;
  totalMentions: number;
}

export async function getTopicTrends(options?: {
  from?: Date;
  to?: Date;
}): Promise<TopicTrendRow[]> {
  const result = await db
    .select({
      week: sql<string>`DATE_TRUNC('week', ${sessions.createdAt})::text`,
      category: topics.category,
      totalMentions: sql<number>`SUM(${topics.mentionCount})::int`,
    })
    .from(topics)
    .innerJoin(sessions, eq(topics.sessionId, sessions.id))
    .where(
      and(
        options?.from ? gte(sessions.createdAt, options.from) : undefined,
        options?.to ? lt(sessions.createdAt, options.to) : undefined
      )
    )
    .groupBy(sql`DATE_TRUNC('week', ${sessions.createdAt})`, topics.category)
    .orderBy(sql`DATE_TRUNC('week', ${sessions.createdAt}) ASC`);

  return result.map((r) => ({
    week: r.week ? r.week.slice(0, 10) : "",
    category: r.category,
    totalMentions: r.totalMentions,
  }));
}

// ===========================================================================
// Gap analysis — unknown topics with best competency match + confidence
// ===========================================================================

export interface GapMatch {
  topicTerm: string;
  aliases: string[];
  category: string;
  totalMentions: number;
  sessionCount: number;
  lastSeen: string;
  bestMatch: {
    name: string;
    source: string;
    type: string;
    partnerName: string | null;
    confidence: number;
  } | null;
}

export async function getGapAnalysis(): Promise<GapMatch[]> {
  const rawGapTopics = await db
    .select({
      term: topics.term,
      category: topics.category,
      totalMentions: sql<number>`SUM(${topics.mentionCount})::int`,
      sessionCount: sql<number>`COUNT(DISTINCT ${topics.sessionId})::int`,
      lastSeen: sql<string>`MAX(${topics.firstMentionedAt})::text`,
    })
    .from(topics)
    .where(eq(topics.capabilitySource, "unknown"))
    .groupBy(topics.term, topics.category)
    .orderBy(sql`SUM(${topics.mentionCount}) DESC`);

  if (rawGapTopics.length === 0) return [];

  const allCompetencies = await db.select().from(competencies);

  // Consolidate similar gap topics
  const mentionsByTerm = new Map(rawGapTopics.map((r) => [r.term, r.totalMentions]));
  const groups = groupSimilarTerms(rawGapTopics.map((r) => r.term));

  const consolidated: GapMatch[] = [];
  for (const members of groups.values()) {
    const canonical = pickCanonical(members, mentionsByTerm);
    const memberRows = members.map((m) => rawGapTopics.find((r) => r.term === m)!).filter(Boolean);

    const catVotes = new Map<string, number>();
    for (const r of memberRows) {
      catVotes.set(r.category, (catVotes.get(r.category) ?? 0) + r.totalMentions);
    }
    const category = [...catVotes.entries()].sort((a, b) => b[1] - a[1])[0][0];

    const totalMentions = memberRows.reduce((s, r) => s + r.totalMentions, 0);
    const sessionCount = Math.max(...memberRows.map((r) => r.sessionCount));
    const lastSeen = memberRows
      .map((r) => r.lastSeen ?? "")
      .sort()
      .at(-1)
      ?.slice(0, 10) ?? "";

    // Find best competency match across all aliases + canonical
    let bestMatch: GapMatch["bestMatch"] = null;
    for (const termVariant of members) {
      for (const comp of allCompetencies) {
        const confidence = computeCompetencyMatch(termVariant, comp);
        if (confidence > 0.3 && (!bestMatch || confidence > bestMatch.confidence)) {
          bestMatch = {
            name: comp.name,
            source: comp.source,
            type: comp.type,
            partnerName: comp.partnerName ?? null,
            confidence,
          };
        }
      }
    }

    consolidated.push({
      topicTerm: canonical,
      aliases: members.filter((m) => m !== canonical),
      category,
      totalMentions,
      sessionCount,
      lastSeen,
      bestMatch,
    });
  }

  return consolidated.sort((a, b) => b.totalMentions - a.totalMentions);
}

// ===========================================================================
// Needs vs. Offerings — all topics split into matched vs. gaps
// ===========================================================================

export interface NeedsVsOfferingsResult {
  matched: Array<{
    topicTerm: string;
    aliases: string[];
    category: string;
    capabilitySource: string;
    partnerName: string | null;
    totalMentions: number;
    sessionCount: number;
  }>;
  gaps: GapMatch[];
}

export async function getNeedsVsOfferings(): Promise<NeedsVsOfferingsResult> {
  const rawMatched = await db
    .select({
      term: topics.term,
      category: topics.category,
      capabilitySource: topics.capabilitySource,
      partnerName: topics.partnerName,
      totalMentions: sql<number>`SUM(${topics.mentionCount})::int`,
      sessionCount: sql<number>`COUNT(DISTINCT ${topics.sessionId})::int`,
    })
    .from(topics)
    .where(and(sql`${topics.capabilitySource} != 'unknown'`))
    .groupBy(topics.term, topics.category, topics.capabilitySource, topics.partnerName)
    .orderBy(sql`SUM(${topics.mentionCount}) DESC`);

  // Consolidate matched topics
  const mentionsByTerm = new Map(rawMatched.map((r) => [r.term, r.totalMentions]));
  const groups = groupSimilarTerms(rawMatched.map((r) => r.term));

  const matched = [...groups.values()].map((members) => {
    const canonical = pickCanonical(members, mentionsByTerm);
    const memberRows = members.map((m) => rawMatched.find((r) => r.term === m)!).filter(Boolean);
    const capVotes = new Map<string, number>();
    const catVotes = new Map<string, number>();
    for (const r of memberRows) {
      capVotes.set(r.capabilitySource, (capVotes.get(r.capabilitySource) ?? 0) + r.totalMentions);
      catVotes.set(r.category, (catVotes.get(r.category) ?? 0) + r.totalMentions);
    }
    const capabilitySource = [...capVotes.entries()].sort((a, b) => b[1] - a[1])[0][0];
    const category = [...catVotes.entries()].sort((a, b) => b[1] - a[1])[0][0];
    const partnerName = memberRows.find((r) => r.partnerName)?.partnerName ?? null;
    return {
      topicTerm: canonical,
      aliases: members.filter((m) => m !== canonical),
      category,
      capabilitySource,
      partnerName,
      totalMentions: memberRows.reduce((s, r) => s + r.totalMentions, 0),
      sessionCount: Math.max(...memberRows.map((r) => r.sessionCount)),
    };
  }).sort((a, b) => b.totalMentions - a.totalMentions);

  const gaps = await getGapAnalysis();
  return { matched, gaps };
}

// ===========================================================================
// Distinct industries helper (for filter dropdown)
// ===========================================================================

export async function getDistinctIndustries(): Promise<string[]> {
  const rows = await db
    .selectDistinct({ industry: sessions.industry })
    .from(sessions)
    .where(sql`${sessions.industry} IS NOT NULL`);

  return rows.map((r) => r.industry!).filter(Boolean).sort();
}

// ===========================================================================
// Session knowledge graph builder
// ===========================================================================

export interface GraphNode {
  id: string;
  nodeType: "session" | "speaker" | "topic" | "action";
  label: string;
  meta: Record<string, string | number | boolean | null | undefined>;
}

export interface GraphEdge {
  id: string;
  source: string;
  target: string;
  label?: string;
}

export interface SessionGraphData {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

/**
 * Consolidate a list of Topics into groups of similar terms.
 * Returns a list of merged "canonical" topics with summed mentionCount,
 * plus a map from each original topic ID → canonical node ID for edge remapping.
 */
function consolidateTopicsForGraph(rawTopics: Topic[]): {
  mergedTopics: Array<Topic & { aliases: string[] }>;
  idRemap: Map<number, number>; // original id → canonical id
} {
  if (rawTopics.length === 0) return { mergedTopics: [], idRemap: new Map() };

  const mentionsByTerm = new Map(rawTopics.map((t) => [t.term, t.mentionCount]));
  const groups = groupSimilarTerms(rawTopics.map((t) => t.term));

  const mergedTopics: Array<Topic & { aliases: string[] }> = [];
  const idRemap = new Map<number, number>();

  for (const members of groups.values()) {
    const canonical = pickCanonical(members, mentionsByTerm);
    const memberTopics = members.map((m) => rawTopics.find((t) => t.term === m)!).filter(Boolean);
    const canonicalTopic = memberTopics.find((t) => t.term === canonical) ?? memberTopics[0];

    const merged: Topic & { aliases: string[] } = {
      ...canonicalTopic,
      mentionCount: memberTopics.reduce((s, t) => s + t.mentionCount, 0),
      aliases: members.filter((m) => m !== canonical),
    };

    mergedTopics.push(merged);

    // All member topic IDs → canonical topic ID
    for (const mt of memberTopics) {
      idRemap.set(mt.id, canonicalTopic.id);
    }
  }

  return { mergedTopics, idRemap };
}

function inferSpeakerTopicEdges(
  transcript: string,
  speakers: SpeakerEntry[],
  topicList: Array<Topic & { aliases: string[] }>
): Array<{ speakerId: string; topicId: string }> {
  const edges: Array<{ speakerId: string; topicId: string }> = [];

  const speakerTexts = new Map<string, string>();
  for (const line of transcript.split("\n")) {
    const colonIdx = line.indexOf(":");
    if (colonIdx < 1) continue;
    const speaker = line.slice(0, colonIdx).trim();
    const text = line.slice(colonIdx + 1).toLowerCase();
    if (speaker.length < 50) {
      speakerTexts.set(speaker, (speakerTexts.get(speaker) || "") + " " + text);
    }
  }

  function resolveTranscriptSpeaker(transcriptName: string): string | null {
    const tn = transcriptName.toLowerCase();
    for (const sp of speakers) {
      const sn = sp.name.toLowerCase();
      if (tn === sn || tn.includes(sn) || sn.includes(tn)) return `speaker-${sp.name}`;
    }
    const firstWord = tn.split(/\s+/)[0];
    for (const sp of speakers) {
      if (sp.name.toLowerCase().startsWith(firstWord)) return `speaker-${sp.name}`;
    }
    return null;
  }

  for (const topic of topicList) {
    // Search for any variant of this topic (canonical + aliases) in each speaker's text
    const variants = [topic.term, ...(topic.aliases ?? [])].map((v) => v.toLowerCase());
    const seen = new Set<string>();

    for (const [transcriptSpeaker, text] of speakerTexts) {
      if (variants.some((v) => text.includes(v))) {
        const speakerId = resolveTranscriptSpeaker(transcriptSpeaker);
        if (speakerId && !seen.has(speakerId)) {
          seen.add(speakerId);
          edges.push({ speakerId, topicId: `topic-${topic.id}` });
        }
      }
    }
  }

  return edges;
}

export async function buildSessionGraph(sessionId: number): Promise<SessionGraphData> {
  const [sessionRows, rawSessionTopics] = await Promise.all([
    db.select().from(sessions).where(eq(sessions.id, sessionId)),
    db.select().from(topics).where(eq(topics.sessionId, sessionId)),
  ]);

  const session = sessionRows[0];
  if (!session) return { nodes: [], edges: [] };

  const speakers: SpeakerEntry[] = (session.speakers as SpeakerEntry[]) || [];
  const actionItems = (session.actionItems as Array<{ text: string; assignee?: string; priority?: string }>) || [];

  // Consolidate similar topics
  const { mergedTopics } = consolidateTopicsForGraph(rawSessionTopics);

  const nodes: GraphNode[] = [];
  const edges: GraphEdge[] = [];

  // Session node
  nodes.push({
    id: "session",
    nodeType: "session",
    label: session.title || `Session #${session.id}`,
    meta: {
      clientName: session.clientName,
      industry: session.industry,
      totalTopics: session.totalTopics,
    },
  });

  // Speaker nodes + session→speaker edges
  for (const sp of speakers) {
    const spId = `speaker-${sp.name}`;
    nodes.push({
      id: spId,
      nodeType: "speaker",
      label: sp.name,
      meta: { title: sp.title, role: sp.role },
    });
    edges.push({ id: `e-session-${spId}`, source: "session", target: spId });
  }

  // Consolidated topic nodes
  for (const topic of mergedTopics) {
    const topicId = `topic-${topic.id}`;
    nodes.push({
      id: topicId,
      nodeType: "topic",
      label: topic.term,
      meta: {
        category: topic.category,
        capabilitySource: topic.capabilitySource,
        partnerName: topic.partnerName,
        mentionCount: topic.mentionCount,
        definition: topic.definition,
        aliases: topic.aliases.join(", "),
      },
    });
  }

  // Action item nodes + speaker→action edges
  for (let i = 0; i < actionItems.length; i++) {
    const ai = actionItems[i];
    const actionId = `action-${i}`;
    nodes.push({
      id: actionId,
      nodeType: "action",
      label: ai.text,
      meta: { assignee: ai.assignee, priority: ai.priority },
    });

    if (ai.assignee) {
      const matchedSpeaker = speakers.find(
        (sp) =>
          sp.name.toLowerCase().includes(ai.assignee!.toLowerCase()) ||
          ai.assignee!.toLowerCase().includes(sp.name.toLowerCase())
      );
      const edgeSrc = matchedSpeaker ? `speaker-${matchedSpeaker.name}` : "session";
      edges.push({
        id: `e-${edgeSrc}-${actionId}`,
        source: edgeSrc,
        target: actionId,
        label: matchedSpeaker ? "assigned" : "action",
      });
    } else {
      edges.push({ id: `e-session-${actionId}`, source: "session", target: actionId, label: "action" });
    }
  }

  // Speaker→topic edges using all term variants for transcript matching
  const speakerTopicEdges = inferSpeakerTopicEdges(session.transcript || "", speakers, mergedTopics);
  const seenEdgeIds = new Set<string>();
  for (const { speakerId, topicId } of speakerTopicEdges) {
    const edgeId = `e-${speakerId}-${topicId}`;
    if (!seenEdgeIds.has(edgeId)) {
      seenEdgeIds.add(edgeId);
      edges.push({ id: edgeId, source: speakerId, target: topicId });
    }
  }

  // Topics with no speaker edges → connect from session
  const topicsWithEdges = new Set(speakerTopicEdges.map((e) => e.topicId));
  for (const topic of mergedTopics) {
    const topicId = `topic-${topic.id}`;
    if (!topicsWithEdges.has(topicId)) {
      edges.push({ id: `e-session-${topicId}`, source: "session", target: topicId });
    }
  }

  return { nodes, edges };
}
