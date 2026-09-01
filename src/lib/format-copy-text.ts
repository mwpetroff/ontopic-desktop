import type {
  ActionItem, FollowUpQuestion, Requirement, PainPoint, SIPOCData, BANTData,
  MethodologyProgress, CompetitorMention, TimelineSignal, RiskFlag,
} from "@shared/schema";

export function formatActionItems(items: ActionItem[]): string {
  return items.map((i) => `- ${i.text}${i.assignee ? ` (${i.assignee})` : ""}${i.priority ? ` [${i.priority}]` : ""}`).join("\n");
}

export function formatFollowUps(items: FollowUpQuestion[]): string {
  return items.map((q) => `- ${q.question}${q.context ? `\n  ${q.context}` : ""}`).join("\n");
}

export function formatRequirements(items: Requirement[]): string {
  return items.map((r) => `- ${r.text}${r.source ? ` (${r.source})` : ""}`).join("\n");
}

export function formatPainPoints(items: PainPoint[]): string {
  return items.map((p) => `- ${p.text}${p.impact ? `\n  Impact: ${p.impact}` : ""}`).join("\n");
}

export function formatSipoc(data: SIPOCData | null): string {
  if (!data) return "";
  const section = (label: string, items: { text: string }[]) =>
    `${label}:\n${items.length ? items.map((i) => `- ${i.text}`).join("\n") : "(none)"}`;
  return [
    section("Suppliers", data.suppliers),
    section("Inputs", data.inputs),
    section("Process", data.process),
    section("Outputs", data.outputs),
    section("Customers", data.customers),
  ].join("\n\n");
}

export function formatBant(data: BANTData | null): string {
  if (!data) return "";
  const rows: Array<[keyof BANTData, string]> = [
    ["budget", "Budget"], ["authority", "Authority"], ["needs", "Needs"], ["timeline", "Timeline"],
  ];
  return rows.map(([key, label]) => `${label}: ${data[key]?.value || "(not yet identified)"}`).join("\n");
}

export function formatMethodology(progress: MethodologyProgress | null): string {
  if (!progress) return "";
  return progress.stages.map((s) => `${s.completed ? "[x]" : "[ ]"} ${s.name}`).join("\n");
}

export function formatCompetitorMentions(items: CompetitorMention[]): string {
  return items.map((m) => `- ${m.name}: ${m.context}`).join("\n");
}

export function formatTimelineSignals(items: TimelineSignal[]): string {
  return items.map((t) => `- ${t.date}: ${t.context}${t.urgency ? ` [${t.urgency}]` : ""}`).join("\n");
}

export function formatRiskFlags(items: RiskFlag[]): string {
  return items.map((r) => `- ${r.text}${r.type ? ` [${r.type}]` : ""}`).join("\n");
}

export function formatTopics(items: Array<{ term: string; definition: string }>): string {
  return items.map((t) => `- ${t.term}: ${t.definition}`).join("\n");
}

export function formatSimilarProjects(items: Array<{ title?: string; projectId: number; relevance: string }>): string {
  return items.map((m) => `- ${m.title || `Project #${m.projectId}`}: ${m.relevance}`).join("\n");
}
