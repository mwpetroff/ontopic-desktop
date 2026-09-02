import ExcelJS from "exceljs";
import type {
  Session, Topic, ActionItem, FollowUpQuestion, Requirement, PainPoint, SIPOCData,
  BANTData, MethodologyProgress, CompetitorMention, TimelineSignal, RiskFlag,
} from "@shared/schema";
import { consolidateSimilarProjects } from "@shared/schema";
import { SIPOC_COLUMNS } from "@/components/sipoc-board";
import { formatDateForPdf, formatDurationForPdf } from "@/lib/date";
import { parseAndMergeBlocks, formatElapsedTimestamp } from "@/lib/transcript";

type SessionWithTopics = Session & { topics: Topic[] };

// One accent color per sheet — shows up as the tab color in Excel's sheet strip, so a
// reader can jump straight to the section they want without opening each tab.
const TAB_COLOR = {
  overview: "334155", transcript: "2563EB", keyTerms: "7C3AED", actionItems: "EA580C",
  followUps: "0D9488", similarProjects: "16A34A", requirements: "4F46E5", painPoints: "DC2626",
  sipoc: "64748B", bant: "D97706", methodology: "0891B2", competitors: "CA8A04",
  timeline: "0369A1", risks: "B91C1C",
} as const;

function fill(argb: string): ExcelJS.Fill {
  return { type: "pattern", pattern: "solid", fgColor: { argb: `FF${argb}` } };
}

/** Adds a worksheet rendered as a real Excel Table (banded rows, filter buttons) with a
 * color-coded tab. If there are no rows, still shows the column headers so the sheet
 * reads as "nothing found here" rather than a blank, confusing tab. */
function addTableSheet(
  workbook: ExcelJS.Workbook,
  opts: { name: string; tabColor: string; columns: string[]; rows: (string | number)[][]; widths: number[] }
): ExcelJS.Worksheet {
  const sheet = workbook.addWorksheet(opts.name, { properties: { tabColor: { argb: `FF${opts.tabColor}` } } });
  if (opts.rows.length > 0) {
    sheet.addTable({
      name: opts.name.replace(/[^A-Za-z0-9]/g, "") + "Table",
      ref: "A1",
      headerRow: true,
      style: { theme: "TableStyleMedium2", showRowStripes: true },
      columns: opts.columns.map((name) => ({ name, filterButton: true })),
      rows: opts.rows,
    });
  } else {
    const headerRow = sheet.addRow(opts.columns);
    headerRow.font = { bold: true, color: { argb: "FFFFFFFF" } };
    headerRow.fill = fill(opts.tabColor);
    sheet.addRow([]).getCell(1).value = "No data captured in this section.";
    sheet.getCell("A2").font = { italic: true, color: { argb: "FF888888" } };
  }
  opts.widths.forEach((w, i) => {
    sheet.getColumn(i + 1).width = w;
  });
  sheet.eachRow((row) => {
    row.alignment = { wrapText: true, vertical: "top" };
  });
  sheet.views = [{ state: "frozen", ySplit: 1 }];
  return sheet;
}

function addOverviewSheet(workbook: ExcelJS.Workbook, session: SessionWithTopics) {
  const sheet = workbook.addWorksheet("Overview", { properties: { tabColor: { argb: `FF${TAB_COLOR.overview}` } } });
  sheet.columns = [{ width: 22 }, { width: 70 }];

  const titleRow = sheet.addRow([session.title]);
  sheet.mergeCells(`A${titleRow.number}:B${titleRow.number}`);
  titleRow.height = 26;
  titleRow.getCell(1).font = { bold: true, size: 16, color: { argb: "FFFFFFFF" } };
  titleRow.getCell(1).fill = fill(TAB_COLOR.overview);
  titleRow.getCell(1).alignment = { vertical: "middle" };

  sheet.addRow([]);

  const metaRows: Array<[string, string]> = [
    ["Client", session.clientName || "—"],
    ["Industry", session.industry || "—"],
    ["Date", formatDateForPdf(session.createdAt)],
    ["Duration", formatDurationForPdf(session.createdAt, session.endedAt)],
    ["Status", session.status],
    ["Overall Sentiment", session.overallSentiment != null ? String(session.overallSentiment) : "—"],
    ["Topics Detected", String(session.topics.length)],
  ];
  for (const [label, value] of metaRows) {
    const row = sheet.addRow([label, value]);
    row.getCell(1).font = { bold: true, color: { argb: "FF666666" } };
    row.getCell(2).alignment = { wrapText: true, vertical: "top" };
  }

  if (session.summary) {
    sheet.addRow([]);
    const headerRow = sheet.addRow(["Key Takeaway"]);
    sheet.mergeCells(`A${headerRow.number}:B${headerRow.number}`);
    headerRow.getCell(1).font = { bold: true, size: 12 };
    const summaryRow = sheet.addRow([session.summary]);
    sheet.mergeCells(`A${summaryRow.number}:B${summaryRow.number}`);
    summaryRow.getCell(1).alignment = { wrapText: true, vertical: "top" };
    summaryRow.height = Math.max(30, Math.ceil(session.summary.length / 90) * 15);
  }
}

function addTranscriptSheet(workbook: ExcelJS.Workbook, session: SessionWithTopics) {
  const blocks = session.transcript ? parseAndMergeBlocks(session.transcript) : [];
  const startMs = new Date(session.createdAt).getTime();
  const endMs = session.endedAt ? new Date(session.endedAt).getTime() : Date.now();
  const durationMs = endMs - startMs;
  const rows = blocks.map((b) => [
    formatElapsedTimestamp(b.rawBlockIndex, b.rawBlockCount, startMs, durationMs),
    b.speaker || "—",
    b.content,
  ]);
  const sheet = addTableSheet(workbook, {
    name: "Transcript", tabColor: TAB_COLOR.transcript,
    columns: ["Time", "Speaker", "Text"], rows, widths: [10, 20, 90],
  });
  sheet.getColumn(3).alignment = { wrapText: true, vertical: "top" };
}

/** Builds the full session export workbook — one sheet per result section, each a real
 * Excel Table with banded rows and a color-coded tab. Sections with no data still get a
 * sheet (so the export is predictable) but show a "no data" note instead of an empty table. */
export function buildSessionWorkbook(session: SessionWithTopics): ExcelJS.Workbook {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "OnTopic Desktop";
  workbook.created = new Date();

  addOverviewSheet(workbook, session);
  addTranscriptSheet(workbook, session);

  addTableSheet(workbook, {
    name: "Key Terms", tabColor: TAB_COLOR.keyTerms,
    columns: ["Term", "Definition", "Category", "Type"],
    rows: session.topics.map((t) => [t.term, t.definition, t.category, t.type]),
    widths: [28, 60, 18, 14],
  });

  const actionItems = (session.actionItems || []) as ActionItem[];
  addTableSheet(workbook, {
    name: "Action Items", tabColor: TAB_COLOR.actionItems,
    columns: ["Action", "Assignee", "Priority"],
    rows: actionItems.map((a) => [a.text, a.assignee || "", a.priority || ""]),
    widths: [60, 20, 12],
  });

  const followUps = (session.followUpQuestions || []) as FollowUpQuestion[];
  addTableSheet(workbook, {
    name: "Follow-Ups", tabColor: TAB_COLOR.followUps,
    columns: ["Question", "Context"],
    rows: followUps.map((f) => [f.question, f.context || ""]),
    widths: [55, 55],
  });

  const similarProjects = consolidateSimilarProjects(
    (session.similarProjectMatches || []) as Array<{ projectId: number; relevance: string; title?: string; industry?: string; clientName?: string; projectDate?: string }>
  );
  addTableSheet(workbook, {
    name: "Similar Projects", tabColor: TAB_COLOR.similarProjects,
    columns: ["Project", "Industry", "Client", "Date", "Relevance"],
    rows: similarProjects.map((m) => [
      m.title || `Project #${m.projectId}`, m.industry || "", m.clientName || "",
      m.projectDate ? new Date(m.projectDate).toLocaleDateString("en-US", { year: "numeric", month: "short" }) : "",
      m.relevance,
    ]),
    widths: [30, 18, 18, 12, 50],
  });

  const requirements = (session.requirements || []) as Requirement[];
  if (requirements.length > 0) {
    addTableSheet(workbook, {
      name: "Requirements", tabColor: TAB_COLOR.requirements,
      columns: ["Requirement", "Source"],
      rows: requirements.map((r) => [r.text, r.source || ""]),
      widths: [70, 25],
    });
  }

  const painPoints = (session.painPoints || []) as PainPoint[];
  if (painPoints.length > 0) {
    addTableSheet(workbook, {
      name: "Pain Points", tabColor: TAB_COLOR.painPoints,
      columns: ["Pain Point", "Business Impact"],
      rows: painPoints.map((p) => [p.text, p.impact || ""]),
      widths: [55, 45],
    });
  }

  const sipoc = session.sipocData as SIPOCData | null;
  if (sipoc) {
    addSipocSheet(workbook, sipoc);
  }

  const bant = session.bantData as BANTData | null;
  if (bant && (bant.budget || bant.authority || bant.needs || bant.timeline)) {
    addTableSheet(workbook, {
      name: "BANT", tabColor: TAB_COLOR.bant,
      columns: ["Element", "Value", "Evidence"],
      rows: (["budget", "authority", "needs", "timeline"] as const)
        .map((key) => [key.charAt(0).toUpperCase() + key.slice(1), bant[key]?.value || "", bant[key]?.evidence || ""]),
      widths: [16, 40, 55],
    });
  }

  const methodology = session.methodologyProgress as MethodologyProgress | null;
  if (methodology && methodology.stages.length > 0) {
    addTableSheet(workbook, {
      name: "Methodology", tabColor: TAB_COLOR.methodology,
      columns: ["Stage", "Completed"],
      rows: methodology.stages.map((s) => [s.name, s.completed ? "Yes" : "No"]),
      widths: [45, 14],
    });
  }

  const competitors = (session.competitorMentions || []) as CompetitorMention[];
  if (competitors.length > 0) {
    addTableSheet(workbook, {
      name: "Competitor Mentions", tabColor: TAB_COLOR.competitors,
      columns: ["Name", "Context"],
      rows: competitors.map((c) => [c.name, c.context]),
      widths: [30, 70],
    });
  }

  const timelineSignals = (session.timelineSignals || []) as TimelineSignal[];
  if (timelineSignals.length > 0) {
    addTableSheet(workbook, {
      name: "Timeline Signals", tabColor: TAB_COLOR.timeline,
      columns: ["Date", "Context", "Urgency"],
      rows: timelineSignals.map((t) => [t.date, t.context, t.urgency || ""]),
      widths: [20, 65, 12],
    });
  }

  const riskFlags = (session.riskFlags || []) as RiskFlag[];
  if (riskFlags.length > 0) {
    addTableSheet(workbook, {
      name: "Risk Flags", tabColor: TAB_COLOR.risks,
      columns: ["Item", "Type"],
      rows: riskFlags.map((r) => [r.text, r.type || ""]),
      widths: [75, 15],
    });
  }

  return workbook;
}

function addSipocSheet(workbook: ExcelJS.Workbook, sipoc: SIPOCData) {
  const sheet = workbook.addWorksheet("SIPOC", { properties: { tabColor: { argb: `FF${TAB_COLOR.sipoc}` } } });
  const headerRow = sheet.addRow(SIPOC_COLUMNS.map((c) => c.label));
  headerRow.eachCell((cell, colNumber) => {
    cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
    cell.fill = fill(SIPOC_TAB_HEADER_HEX[colNumber - 1]);
  });

  const hasLinks = !!sipoc.links?.length;
  if (hasLinks) {
    for (const link of sipoc.links!) {
      const row = sheet.addRow(SIPOC_COLUMNS.map((c) => link[c.linkKey] || ""));
      row.eachCell((cell) => { cell.alignment = { wrapText: true, vertical: "top" }; });
    }
    const linkedTextByCategory = new Map(
      SIPOC_COLUMNS.map((c) => [c.key, new Set(sipoc.links!.map((l) => l[c.linkKey]).filter(Boolean) as string[])])
    );
    const unlinked = SIPOC_COLUMNS.map((c) => sipoc[c.key].filter((item) => !linkedTextByCategory.get(c.key)!.has(item.text)));
    const anyUnlinked = unlinked.some((items) => items.length > 0);
    if (anyUnlinked) {
      sheet.addRow([]);
      const labelRow = sheet.addRow(["Not Yet Linked"]);
      labelRow.font = { italic: true, color: { argb: "FF888888" } };
      const maxLen = Math.max(1, ...unlinked.map((items) => items.length));
      for (let i = 0; i < maxLen; i++) {
        const row = sheet.addRow(unlinked.map((items) => items[i]?.text || ""));
        row.eachCell((cell) => { cell.alignment = { wrapText: true, vertical: "top" }; });
      }
    }
  } else {
    const maxLen = Math.max(1, ...SIPOC_COLUMNS.map((c) => sipoc[c.key].length));
    for (let i = 0; i < maxLen; i++) {
      const row = sheet.addRow(SIPOC_COLUMNS.map((c) => sipoc[c.key][i]?.text || ""));
      row.eachCell((cell) => { cell.alignment = { wrapText: true, vertical: "top" }; });
    }
  }
  sheet.columns.forEach((col) => { col.width = 26; });
  sheet.views = [{ state: "frozen", ySplit: 1 }];
}

// SIPOC_COLUMNS' `header` field is a Tailwind class (e.g. "bg-slate-500") meant for the
// live UI, not a hex color — map to real ARGB hex for the Excel header fill instead of
// parsing Tailwind class names at runtime.
const SIPOC_TAB_HEADER_HEX = ["64748B", "F59E0B", "0EA5E9", "10B981", "F43F5E"];

/** Exports the full session (every result section, one per sheet) as a downloaded .xlsx file. */
export async function exportSessionExcel(session: SessionWithTopics): Promise<void> {
  const workbook = buildSessionWorkbook(session);
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  const url = URL.createObjectURL(blob);
  const slug = session.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
  const a = document.createElement("a");
  a.href = url;
  a.download = `${slug}.xlsx`;
  a.click();
  URL.revokeObjectURL(url);
}
