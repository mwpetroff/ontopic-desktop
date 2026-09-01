import type {
  ActionItem, FollowUpQuestion, Requirement, PainPoint, SIPOCData, SIPOCLink, BANTData,
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

// SIPOCData's category arrays are plural ("suppliers"); SIPOCLink's fields are singular
// ("supplier") since a link is one row, not a bucket — "process" is the odd one out.
const SIPOC_CATEGORY_TO_LINK_KEY = {
  suppliers: "supplier", inputs: "input", process: "process", outputs: "output", customers: "customer",
} as const satisfies Record<string, keyof SIPOCLink>;
type SipocCategoryKey = keyof typeof SIPOC_CATEGORY_TO_LINK_KEY;

export function formatSipoc(data: SIPOCData | null): string {
  if (!data) return "";
  const section = (label: string, items: { text: string }[]) =>
    `${label}:\n${items.length ? items.map((i) => `- ${i.text}`).join("\n") : "(none)"}`;

  if (data.links && data.links.length > 0) {
    const chains = data.links
      .map((l) => [l.supplier, l.input, l.process, l.output, l.customer].filter(Boolean).join(" → "))
      .join("\n");
    const linkedTextByCategory: Partial<Record<SipocCategoryKey, Set<string>>> = {};
    for (const key of Object.keys(SIPOC_CATEGORY_TO_LINK_KEY) as SipocCategoryKey[]) {
      const linkKey = SIPOC_CATEGORY_TO_LINK_KEY[key];
      linkedTextByCategory[key] = new Set(data.links.map((l) => l[linkKey]).filter(Boolean) as string[]);
    }
    const unlinked = (Object.keys(SIPOC_CATEGORY_TO_LINK_KEY) as SipocCategoryKey[])
      .map((key) => section(
        key.charAt(0).toUpperCase() + key.slice(1),
        data[key].filter((item) => !linkedTextByCategory[key]!.has(item.text))
      ))
      .join("\n\n");
    return `Confirmed Chains:\n${chains}\n\nNot Yet Linked:\n\n${unlinked}`;
  }

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
