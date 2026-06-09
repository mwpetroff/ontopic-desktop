import OpenAI from "openai";
import { storage } from "../storage";
import {
  FeatureFlags,
  HOST_ROLE_LABELS,
  HOST_ROLE_ACTION_FOCUS,
  HOST_ROLE_FOLLOWUP_FOCUS,
  HOST_ROLE_SUMMARY_FOCUS,
  type MethodologyStageDefinition,
} from "../constants";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || process.env.AI_INTEGRATIONS_OPENAI_API_KEY || "not-configured",
});

export { openai };

export async function withRetry<T>(
  fn: () => Promise<T>,
  opts: { maxAttempts?: number; label?: string; fallback?: T } = {}
): Promise<T> {
  const { maxAttempts = 3, label = "OpenAI call", fallback } = opts;
  const delays = [1000, 2000, 4000];
  
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error: any) {
      const isRetryable =
        error?.status === 429 ||
        error?.status === 500 ||
        error?.status === 502 ||
        error?.status === 503 ||
        error?.code === "ECONNRESET" ||
        error?.code === "ETIMEDOUT" ||
        error?.message?.includes("timeout");

      if (attempt === maxAttempts || !isRetryable) {
        console.error(`[${label}] Failed after ${attempt} attempt(s):`, error?.message || error);
        if (fallback !== undefined) return fallback;
        throw error;
      }

      const delay = delays[attempt - 1] || 4000;
      console.warn(`[${label}] Attempt ${attempt}/${maxAttempts} failed (${error?.status || error?.code || "unknown"}), retrying in ${delay}ms...`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  if (fallback !== undefined) return fallback;
  throw new Error(`[${label}] All ${maxAttempts} attempts exhausted`);
}

export interface AnalysisResult {
  terms: Array<{
    term: string;
    definition?: string;
    category?: string;
    type?: string;
    capabilitySource?: string;
    partnerName?: string;
    isNew?: boolean;
    increment?: boolean;
  }>;
  speaker?: string | null;
  speakerTitle?: string | null;
  sentiment?: { score: number; label: string };
  actionItems?: Array<{ text: string; assignee?: string; priority?: string }>;
  actionItemOrder?: string[];
  followUpQuestions?: Array<{ question: string; context?: string }>;
  similarProjects?: Array<{ projectId: number; relevance: string }>;
  competitorMentions?: Array<{ name: string; context: string }>;
  timelineSignals?: Array<{ date: string; context: string; urgency?: string }>;
  riskFlags?: Array<{ text: string; type?: string }>;
  requirements?: Array<{ text: string; source?: string }>;
  painPoints?: Array<{ text: string; impact?: string }>;
  bantUpdate?: {
    budget?: { value: string; evidence: string } | null;
    authority?: { value: string; evidence: string } | null;
    needs?: { value: string; evidence: string } | null;
    timeline?: { value: string; evidence: string } | null;
  };
  methodologyStageUpdates?: string[];
}

export function buildAnalysisPrompt(
  existingTerms: string[],
  partnerList: string,
  knownSpeakers: string[],
  features: FeatureFlags = {},
  hostRole: string = "host",
  industry?: string | null,
  competencyContext?: string,
  referenceProjectContext?: string,
  methodologyStages?: MethodologyStageDefinition[],
  existingActionItems?: string[]
) {
  const tasks = [
    "1. **Identify IT Terms**: Find key technical terms, tools, platforms, brands, frameworks, and methodologies. If no IT-specific terms are found, still extract notable discussion topics, product names, company names, or domain-specific terms.",
    "2. **Detect Speakers**: If someone is addressed by name or introduces themselves, note the speaker.",
    "3. **Analyze Sentiment**: Rate the overall sentiment of this text chunk on a scale from -100 (very negative) to +100 (very positive), with 0 being neutral.",
  ];

  let taskNum = 4;
  if (features.actionItems) {
    tasks.push(`${taskNum}. **Extract Action Items**: Identify tasks, to-dos, decisions, or commitments made during this part of the meeting. Each action item should have a concise description, an assignee if mentioned, and a priority ("high", "medium", "low") based on urgency/importance. ${HOST_ROLE_ACTION_FOCUS[hostRole] || HOST_ROLE_ACTION_FOCUS.host}`);
    taskNum++;
  }
  if (features.followUpQuestions) {
    const followUpFocus = HOST_ROLE_FOLLOWUP_FOCUS[hostRole] || HOST_ROLE_FOLLOWUP_FOCUS.host;
    tasks.push(`${taskNum}. **Generate Follow-Up Questions**: As an experienced ${HOST_ROLE_LABELS[hostRole] || HOST_ROLE_LABELS.host}, generate 1-3 insightful follow-up questions. ${followUpFocus}`);
    taskNum++;
  }
  if (features.similarProjects && referenceProjectContext) {
    tasks.push(`${taskNum}. **Match Similar Projects**: From the reference library below, identify projects that are similar to what is being discussed — matching by technology, industry, use case, or problem domain. Return their IDs and a brief reason for relevance.`);
    taskNum++;
  }
  if (features.bantTracking) {
    tasks.push(`${taskNum}. **Extract BANT Signals**: Listen carefully for Budget, Authority, Needs, and Timeline signals in this conversation chunk. For each BANT element detected, provide a concise value summary and a short evidence quote (the actual words from the text).
  - Budget: Any mention of budget amount, approved spend, financial constraints, cost expectations, or investment range
  - Authority: Who makes or influences the purchase decision, approval authority levels, or decision-making process
  - Needs: Pain points, challenges, requirements, desired outcomes, or goals — what problem they are trying to solve
  - Timeline: Deadlines, go-live dates, urgency, evaluation timelines, or consequences of missing dates
  If a BANT element is NOT present in this chunk, return null for that field.`);
    taskNum++;
  }
  if (features.methodologyTracking && methodologyStages && methodologyStages.length > 0) {
    const stageList = methodologyStages.map(s => `  - "${s.id}": ${s.name} — ${s.description}`).join("\n");
    tasks.push(`${taskNum}. **Track Sales Methodology Stages**: Based on this conversation chunk, identify which of the following sales methodology stages have been covered or confirmed. Return an array of stage IDs that apply. Only include stages that are clearly evidenced in this chunk — do not guess.
${stageList}`);
    taskNum++;
  }
  if (features.competitorMentions) {
    tasks.push(`${taskNum}. **Identify Competitor / Incumbent Technology**: Note any vendor products, platforms, or tools currently in use at the client or being evaluated alongside your solution. Include only those explicitly mentioned as in-use or under consideration.`);
    taskNum++;
  }
  if (features.timelineSignals) {
    tasks.push(`${taskNum}. **Extract Timeline Signals**: Identify any specific dates, deadlines, milestones, go-live targets, or urgency signals. Capture what needs to happen by when.`);
    taskNum++;
  }
  if (features.riskFlags) {
    tasks.push(`${taskNum}. **Flag Risks & Dependencies**: Identify blockers, constraints, unresolved dependencies, or delivery risks explicitly mentioned. Include things that must happen before something else can proceed.`);
    taskNum++;
  }
  if (features.requirements) {
    tasks.push(`${taskNum}. **Extract Client Requirements**: Identify explicit needs, desired capabilities, and must-have outcomes stated by the client or prospect. These are what they want the solution to do — distinct from actions or tasks.`);
    taskNum++;
  }
  if (features.painPoints) {
    tasks.push(`${taskNum}. **Extract Pain Points**: Identify specific current-state problems, frustrations, failures, or gaps explicitly mentioned. Include any stated business impact where given.`);
    taskNum++;
  }

  let jsonShape = `{
  "terms": [{"term":"...","definition":"...","category":"infrastructure|security|cloud|development|data|networking|methodology|business|ai-ml|devops|monitoring|collaboration|integration","type":"concept|tool|industry","capabilitySource":"...","partnerName":"..."}],
  "speaker": "Name or null",
  "speakerTitle": "Title/role or null",
  "sentiment": {"score": 0, "label": "neutral"}`;

  if (features.actionItems) {
    jsonShape += `,\n  "actionItems": [{"text":"...","assignee":"Name or null","priority":"high|medium|low"}]`;
    if (existingActionItems && existingActionItems.length >= 2) {
      jsonShape += `,\n  "actionItemOrder": ["full text of item that should be first","full text of item second",...]`;
    }
  }
  if (features.followUpQuestions) {
    jsonShape += `,\n  "followUpQuestions": [{"question":"...","context":"brief reason this question matters"}]`;
  }
  if (features.similarProjects && referenceProjectContext) {
    jsonShape += `,\n  "similarProjects": [{"projectId": 123, "relevance": "brief reason this project is similar"}]`;
  }
  if (features.bantTracking) {
    jsonShape += `,\n  "bantUpdate": {"budget": {"value":"short summary or null","evidence":"quote from text or null"},"authority": {"value":"short summary or null","evidence":"quote from text or null"},"needs": {"value":"short summary or null","evidence":"quote from text or null"},"timeline": {"value":"short summary or null","evidence":"quote from text or null"}}`;
  }
  if (features.methodologyTracking && methodologyStages) {
    jsonShape += `,\n  "methodologyStageUpdates": ["stage-id-1", "stage-id-2"]`;
  }
  if (features.competitorMentions) {
    jsonShape += `,\n  "competitorMentions": [{"name":"vendor/product name","context":"what they use it for or why it was mentioned"}]`;
  }
  if (features.timelineSignals) {
    jsonShape += `,\n  "timelineSignals": [{"date":"specific date or timeframe","context":"what needs to happen by this date","urgency":"high|medium|low"}]`;
  }
  if (features.riskFlags) {
    jsonShape += `,\n  "riskFlags": [{"text":"concise risk or blocker description","type":"dependency|risk|constraint|blocker"}]`;
  }
  if (features.requirements) {
    jsonShape += `,\n  "requirements": [{"text":"requirement or desired outcome","source":"person name or 'client'"}]`;
  }
  if (features.painPoints) {
    jsonShape += `,\n  "painPoints": [{"text":"specific problem or frustration","impact":"business impact if stated, else null"}]`;
  }
  jsonShape += "\n}";

  const roleLabel = HOST_ROLE_LABELS[hostRole] || HOST_ROLE_LABELS.host;

  return `You are a ${hostRole === "account-executive" ? "sales qualification assistant" : "PreSales consulting assistant"} analyzing meeting transcripts for a ${roleLabel}. You must do the following:

${tasks.join("\n")}

For each IT term provide: term, definition (1-2 sentences), category (one of: infrastructure, security, cloud, development, data, networking, methodology, business, ai-ml, devops, monitoring, collaboration), type (use "tool" for specific products/brands/platforms, "concept" for technical methodologies/patterns/architectures, "industry" for domain-specific terminology${industry ? ` related to the ${industry} industry` : ""}), capabilitySource ("in-house", "partner", or "unknown").
${industry ? `The client operates in the **${industry}** industry. Flag domain-specific terminology as type="industry" (e.g., regulatory terms, industry standards, vertical-specific concepts).` : ""}
${partnerList ? `Known partners: ${partnerList}. Match tools to partner specialties when possible, set capabilitySource="partner" and include partnerName.` : ""}
${competencyContext ? `\n**Competency Catalog** (use this to determine capabilitySource):\n${competencyContext}\nMatch detected terms against this catalog. If a term matches an in-house competency, set capabilitySource="in-house". If it matches a partner competency, set capabilitySource="partner" and include the partnerName. Only use "unknown" if no match exists in the catalog or partner list.` : ""}
${existingTerms.length > 0 ? `Already identified terms: ${existingTerms.join(", ")}. For repeat mentions, use increment:true.` : ""}

For speaker detection:
- Look for patterns like "Hi, I'm [Name]", "[Name] said", "Thanks [Name]", direct address by name, or speaker introductions.
- If you can identify the speaker by name, return their name.
- **When in doubt, return the most recent speaker's name.** Single-speaker recordings are very common. Default to continuing with the same speaker.
- A name merely MENTIONED in conversation (e.g. "what do you think, John?" or "I talked to Sarah") does NOT mean that person is the current speaker. Only attribute a new speaker when they are clearly INTRODUCING themselves or the context strongly indicates a different person is now talking.
- Only return "NEW_SPEAKER" if you have strong evidence that a genuinely DIFFERENT person has started speaking AND you cannot determine their name. This should be very rare.
- If you are not confident about who is speaking, return the previous speaker's name rather than null or "NEW_SPEAKER".
- For speakerTitle: If the speaker mentions their own title/role (e.g. "I'm the VP of Engineering"), return it. Otherwise return null.
${knownSpeakers.length > 0 ? `Previously detected speakers in this session: ${knownSpeakers.filter(s => !s.startsWith("Speaker ")).join(", ") || knownSpeakers[0]}. Re-use these names when the same person speaks. The most recent speaker was: ${knownSpeakers[knownSpeakers.length - 1]}. Default to this speaker if uncertain.` : ""}

For sentiment: Consider the tone, word choice, and context. Positive = optimism, agreement, excitement. Negative = concern, frustration, criticism, problems. Neutral = factual, informational.
${features.actionItems ? `\nFor action items: Only include concrete, actionable tasks mentioned or implied. Don't fabricate items not discussed. ${HOST_ROLE_ACTION_FOCUS[hostRole] || ""}` : ""}
${features.actionItems && existingActionItems && existingActionItems.length >= 2 ? `\nExisting action items so far (in current order):\n${existingActionItems.map((t, i) => `${i + 1}. ${t}`).join("\n")}\nIf this chunk contains EXPLICIT dependency or sequencing language (e.g. "before we can do X", "first we need to", "that has to happen before", "prerequisite is"), return the full list in "actionItemOrder" with the dependent item moved earlier. Include ALL existing items plus any new ones you add. Omit "actionItemOrder" entirely if no sequencing language is detected.` : ""}
${features.followUpQuestions ? `\nFor follow-up questions: ${HOST_ROLE_FOLLOWUP_FOCUS[hostRole] || HOST_ROLE_FOLLOWUP_FOCUS.host}` : ""}
${features.similarProjects && referenceProjectContext ? `\n**Reference Library** (past projects to match against):\n${referenceProjectContext}\nIdentify 0-3 projects from this library that relate to the current discussion. Match on technologies, industry, use case, or problem domain. Only include genuinely relevant matches. Return their numeric projectId and a brief relevance explanation.` : ""}
${features.bantTracking ? `\nFor BANT: Extract only what is clearly stated in this chunk. Do not infer or hallucinate. Use short, factual summaries for values (e.g. "$500K annually", "CFO has final approval", "CRM consolidation and pipeline visibility", "Go live by Q3"). Use the prospect's own words as evidence quotes.` : ""}
${features.competitorMentions ? `\nFor competitor mentions: Only include vendors/products explicitly named as currently deployed at the client or actively being evaluated. Omit passing references or hypothetical mentions. Keep context brief (under 15 words).` : ""}
${features.timelineSignals ? `\nFor timeline signals: Capture specific dates, fiscal quarters, relative timeframes ("end of year", "before contract renewal"), and urgency language ("we need this by", "deadline is"). Rate urgency: high = hard deadline with consequences, medium = stated preference, low = aspirational.` : ""}
${features.riskFlags ? `\nFor risk flags: Focus on what could block or slow delivery — dependencies on other teams/systems, missing approvals, technical unknowns, contractual constraints, or competing priorities. Be concise (under 20 words per item). type: dependency = must happen before this; blocker = prevents progress now; risk = might cause problems; constraint = limits options.` : ""}
${features.requirements ? `\nFor requirements: Capture the client's stated needs as functional outcomes ("we need X to do Y") not implementation details. One clear sentence per item. source: use the speaker's name if identifiable, else "client".` : ""}
${features.painPoints ? `\nFor pain points: Capture specific, named problems — not generic dissatisfaction. Each pain should describe what's broken/missing and, if stated, what business consequence it causes. Keep each under 25 words.` : ""}

Return JSON:
${jsonShape}

Sentiment labels: "very_negative" (-100 to -60), "negative" (-59 to -20), "neutral" (-19 to 19), "positive" (20 to 59), "very_positive" (60 to 100)`;
}

export async function analyzeText(
  sessionId: number,
  inputText: string,
  existingTerms: string[],
  partnerList: string,
  knownSpeakers: string[],
  features: FeatureFlags = {},
  hostRole: string = "host",
  industry?: string | null,
  analysisModel: string = "gpt-4o-mini",
  competencyContext?: string,
  referenceProjectContext?: string,
  methodologyStages?: MethodologyStageDefinition[],
  existingActionItems?: string[]
): Promise<AnalysisResult> {
  return withRetry(
    async () => {
      const analysisResponse = await openai.chat.completions.create({
        model: analysisModel,
        messages: [
          {
            role: "system",
            content: buildAnalysisPrompt(existingTerms, partnerList, knownSpeakers, features, hostRole, industry, competencyContext, referenceProjectContext, methodologyStages, existingActionItems),
          },
          {
            role: "user",
            content: inputText,
          },
        ],
        response_format: { type: "json_object" },
        max_completion_tokens: 2048,
      });

      const analysisText = analysisResponse.choices[0]?.message?.content || "{}";
      try {
        return JSON.parse(analysisText) as AnalysisResult;
      } catch {
        return { terms: [] } as AnalysisResult;
      }
    },
    { label: `analyzeText(session=${sessionId})`, fallback: { terms: [] } as AnalysisResult }
  );
}

export async function generateSummary(sessionId: number, transcript: string): Promise<string> {
  const sessionTopics = await storage.getTopicsBySession(sessionId);
  const topicList = sessionTopics.map((t) => t.term).join(", ");
  const appSettings = await storage.getSettings();
  const hostRole = appSettings.hostRole || "host";
  const roleLabel = HOST_ROLE_LABELS[hostRole] || HOST_ROLE_LABELS.host;
  const session = await storage.getSession(sessionId);
  const industry = session?.industry;

  const summaryModel = appSettings.analysisModel || "gpt-4o-mini";

  const summary = await withRetry(
    async () => {
      const response = await openai.chat.completions.create({
        model: summaryModel,
        messages: [
          {
            role: "system",
            content: `You are a meeting summarizer for NRI North America OnTopic, a PreSales consulting intelligence tool. Summarize ONLY what is explicitly stated in the transcript provided. Do NOT invent, infer, or extrapolate any information that is not directly present in the text.

CRITICAL RULES:
- If the transcript is too short or lacks substantive content, respond with exactly: "This session did not contain enough content to generate a meaningful summary."
- Never fabricate topics, decisions, people, technologies, or outcomes that are not mentioned in the transcript.
- Only include information that is clearly evidenced by the actual words in the transcript.
- If a topic is only partially discussed, note it briefly and accurately — do not expand it.

When there IS sufficient content, write a concise summary (3-5 paragraphs) in the style of a professional consulting engagement note.

You are writing this summary for a ${roleLabel}. ${HOST_ROLE_SUMMARY_FOCUS[hostRole] || HOST_ROLE_SUMMARY_FOCUS.host}

Focus only on what was actually discussed:
- The main topics and themes that were explicitly mentioned
- Key decisions or directions that were clearly stated
- Notable concerns or challenges that were raised
- Technical recommendations or solutions that were proposed

${topicList ? `Key terms detected in this session: ${topicList}` : ""}
${industry ? `Client industry: ${industry}.` : ""}

Write in third person. Do not use bullet points. Do not start with "In this meeting" or "In this session". Do not pad the summary — if the session was short or inconclusive, say so plainly.`,
          },
          { role: "user", content: transcript },
        ],
        temperature: 0.2,
        max_tokens: 800,
      });
      return response.choices[0]?.message?.content?.trim() || "";
    },
    { label: `generateSummary(session=${sessionId})`, fallback: "" }
  );

  if (summary) {
    await storage.updateSession(sessionId, { summary });
  }
  return summary;
}
