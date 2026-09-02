import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import type {
  Session, Topic, SpeakerEntry, ActionItem, FollowUpQuestion, Requirement, PainPoint,
  SIPOCData, BANTData, MethodologyProgress, CompetitorMention, TimelineSignal, RiskFlag,
} from "@shared/schema";
import { consolidateSimilarProjects } from "@shared/schema";
import { formatDateForPdf, formatDurationForPdf } from "@/lib/date";
import { parseAndMergeBlocks, formatElapsedTimestamp } from "@/lib/transcript";
import { buildExportFilename } from "@/lib/export-filename";
import { computeSipocRows } from "@/lib/sipoc-rows";

type SessionWithTopics = Session & { topics: Topic[] };

/** Renders one titled table section (page-break-aware) and returns the y position to
 * continue from. `widthFractions` are fractions of contentWidth, so callers don't need
 * to hand-compute mm widths per column. */
function renderTableSection(
  doc: jsPDF, y: number, margin: number, contentWidth: number,
  title: string, head: string[], body: string[][], widthFractions: number[]
): number {
  if (body.length === 0) return y;
  if (y > 240) { doc.addPage(); y = margin; }
  doc.setFontSize(13);
  doc.setFont("helvetica", "bold");
  doc.text(title, margin, y);
  y += 2;

  autoTable(doc, {
    startY: y,
    margin: { left: margin, right: margin },
    head: [head],
    body,
    styles: { fontSize: 9, cellPadding: 3 },
    headStyles: { fillColor: [60, 60, 60] },
    columnStyles: Object.fromEntries(widthFractions.map((f, i) => [i, { cellWidth: contentWidth * f }])),
  });

  return (doc as any).lastAutoTable.finalY + 8;
}

export function exportSessionPdf(session: SessionWithTopics) {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 14;
  const contentWidth = pageWidth - margin * 2;
  let y = margin;

  doc.setFontSize(18);
  doc.setFont("helvetica", "bold");
  const titleLines = doc.splitTextToSize(session.title, contentWidth);
  doc.text(titleLines, margin, y);
  y += titleLines.length * 8 + 2;

  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(100, 100, 100);
  const metaParts: string[] = [];
  if (session.clientName) metaParts.push(`Client: ${session.clientName}`);
  if (session.industry) metaParts.push(`Industry: ${session.industry}`);
  metaParts.push(`Date: ${formatDateForPdf(session.createdAt)}`);
  metaParts.push(`Duration: ${formatDurationForPdf(session.createdAt, session.endedAt)}`);

  doc.text(metaParts.join("  |  "), margin, y);
  y += 8;

  doc.setDrawColor(200, 200, 200);
  doc.line(margin, y, pageWidth - margin, y);
  y += 8;
  doc.setTextColor(0, 0, 0);

  if (session.summary) {
    doc.setFontSize(13);
    doc.setFont("helvetica", "bold");
    doc.text("Key Takeaway", margin, y);
    y += 7;

    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    const summaryLines = doc.splitTextToSize(session.summary, contentWidth);
    doc.text(summaryLines, margin, y);
    y += summaryLines.length * 5 + 8;
  }

  const sessionSpeakers = (session.speakers || []) as SpeakerEntry[];
  if (sessionSpeakers.length > 0) {
    if (y > 250) { doc.addPage(); y = margin; }
    doc.setFontSize(13);
    doc.setFont("helvetica", "bold");
    doc.text("Host & Guests", margin, y);
    y += 7;

    const hosts = sessionSpeakers.filter(s => s.role === "host");
    const guests = sessionSpeakers.filter(s => s.role !== "host");

    if (hosts.length > 0) {
      doc.setFontSize(9);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(100, 100, 100);
      doc.text("HOST", margin, y);
      doc.setTextColor(0, 0, 0);
      y += 5;
      for (const speaker of hosts) {
        doc.setFontSize(10);
        doc.setFont("helvetica", "bold");
        const label = speaker.title
          ? `${speaker.name}  \u2014  ${speaker.title}`
          : speaker.name;
        doc.text(label, margin + 4, y);
        y += 5;
      }
      y += 2;
    }

    if (guests.length > 0) {
      doc.setFontSize(9);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(100, 100, 100);
      doc.text(hosts.length > 0 ? "GUESTS" : "PARTICIPANTS", margin, y);
      doc.setTextColor(0, 0, 0);
      y += 5;
      for (const speaker of guests) {
        doc.setFontSize(10);
        doc.setFont("helvetica", "bold");
        const label = speaker.title
          ? `${speaker.name}  \u2014  ${speaker.title}`
          : speaker.name;
        doc.text(label, margin + 4, y);
        y += 5;
      }
    }
    y += 4;
  }

  const tools = session.topics.filter(t => t.type === "tool");
  const concepts = session.topics.filter(t => t.type === "concept");
  const industryTerms = session.topics.filter(t => t.type === "industry");

  const topicGroups = [
    { label: "Products & Brands", items: tools },
    { label: "Key Concepts", items: concepts },
    { label: "Industry Terms", items: industryTerms },
  ].filter(g => g.items.length > 0);

  if (topicGroups.length > 0) {
    if (y > 250) { doc.addPage(); y = margin; }
    doc.setFontSize(13);
    doc.setFont("helvetica", "bold");
    doc.text("Key Terms", margin, y);
    y += 4;

    for (const group of topicGroups) {
      if (y > 260) { doc.addPage(); y = margin; }
      y += 6;
      doc.setFontSize(11);
      doc.setFont("helvetica", "bold");
      doc.text(group.label, margin, y);
      y += 2;

      autoTable(doc, {
        startY: y,
        margin: { left: margin, right: margin },
        head: [["Term", "Definition", "First Mentioned"]],
        body: group.items.map(t => {
          let timestamp = "";
          if (t.firstMentionedAt && session.createdAt) {
            const mentionTime = new Date(t.firstMentionedAt).getTime();
            const startTime = new Date(session.createdAt).getTime();
            const diffMs = Math.max(0, mentionTime - startTime);
            const totalSec = Math.floor(diffMs / 1000);
            const h = Math.floor(totalSec / 3600);
            const m = Math.floor((totalSec % 3600) / 60);
            const s = totalSec % 60;
            timestamp = h > 0 ? `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}` : `${m}:${String(s).padStart(2, "0")}`;
          }
          return [t.term, t.definition || "", timestamp];
        }),
        styles: { fontSize: 9, cellPadding: 3 },
        headStyles: { fillColor: [60, 60, 60] },
        columnStyles: {
          0: { cellWidth: 40, fontStyle: "bold" },
          1: { cellWidth: contentWidth - 60 },
          2: { cellWidth: 20, halign: "center" as const },
        },
      });

      y = (doc as any).lastAutoTable.finalY + 6;
    }
  }

  const actionItems = (session.actionItems || []) as ActionItem[];
  if (actionItems.length > 0) {
    if (y > 240) { doc.addPage(); y = margin; }
    doc.setFontSize(13);
    doc.setFont("helvetica", "bold");
    doc.text("Action Items", margin, y);
    y += 2;

    autoTable(doc, {
      startY: y,
      margin: { left: margin, right: margin },
      head: [["Action", "Assignee", "Priority"]],
      body: actionItems.map(item => [
        item.text,
        item.assignee || "-",
        item.priority || "-",
      ]),
      styles: { fontSize: 9, cellPadding: 3 },
      headStyles: { fillColor: [60, 60, 60] },
      columnStyles: {
        0: { cellWidth: contentWidth - 70 },
        1: { cellWidth: 35 },
        2: { cellWidth: 35 },
      },
    });

    y = (doc as any).lastAutoTable.finalY + 8;
  }

  const followUps = (session.followUpQuestions || []) as FollowUpQuestion[];
  if (followUps.length > 0) {
    if (y > 240) { doc.addPage(); y = margin; }
    doc.setFontSize(13);
    doc.setFont("helvetica", "bold");
    doc.text("Follow-Up Questions", margin, y);
    y += 2;

    autoTable(doc, {
      startY: y,
      margin: { left: margin, right: margin },
      head: [["Question", "Context"]],
      body: followUps.map(fq => [
        fq.question,
        fq.context || "-",
      ]),
      styles: { fontSize: 9, cellPadding: 3 },
      headStyles: { fillColor: [60, 60, 60] },
      columnStyles: {
        0: { cellWidth: contentWidth * 0.55 },
        1: { cellWidth: contentWidth * 0.45 },
      },
    });

    y = (doc as any).lastAutoTable.finalY + 8;
  }

  const rawSimilarMatches = (session.similarProjectMatches || []) as Array<{ projectId: number; relevance: string; title?: string; industry?: string; clientName?: string; projectDate?: string }>;
  const similarMatches = consolidateSimilarProjects(rawSimilarMatches);
  if (similarMatches.length > 0) {
    if (y > 240) { doc.addPage(); y = margin; }
    doc.setFontSize(13);
    doc.setFont("helvetica", "bold");
    doc.text("Similar Projects", margin, y);
    y += 2;

    autoTable(doc, {
      startY: y,
      margin: { left: margin, right: margin },
      head: [["Project", "Industry / Client", "Date", "Relevance"]],
      body: similarMatches.map(m => [
        m.title || `Project #${m.projectId}`,
        [m.industry, m.clientName].filter(Boolean).join(" · ") || "-",
        m.projectDate ? new Date(m.projectDate).toLocaleDateString("en-US", { year: "numeric", month: "short" }) : "-",
        m.relevance,
      ]),
      styles: { fontSize: 9, cellPadding: 3 },
      headStyles: { fillColor: [60, 60, 60] },
      columnStyles: {
        0: { cellWidth: contentWidth * 0.25, fontStyle: "bold" },
        1: { cellWidth: contentWidth * 0.2 },
        2: { cellWidth: contentWidth * 0.1 },
        3: { cellWidth: contentWidth * 0.45 },
      },
    });

    y = (doc as any).lastAutoTable.finalY + 8;
  }

  // Role-specific sections — only the ones with data appear, same as the Excel export.
  const requirements = (session.requirements || []) as Requirement[];
  y = renderTableSection(doc, y, margin, contentWidth, "Requirements", ["Requirement", "Source"],
    requirements.map(r => [r.text, r.source || "-"]), [0.72, 0.28]);

  const painPoints = (session.painPoints || []) as PainPoint[];
  y = renderTableSection(doc, y, margin, contentWidth, "Pain Points", ["Pain Point", "Business Impact"],
    painPoints.map(p => [p.text, p.impact || "-"]), [0.55, 0.45]);

  const sipoc = session.sipocData as SIPOCData | null;
  if (sipoc) {
    const { columns, linkedRows, unlinkedRows } = computeSipocRows(sipoc);
    y = renderTableSection(doc, y, margin, contentWidth, "SIPOC", columns, linkedRows, [0.2, 0.2, 0.2, 0.2, 0.2]);
    if (unlinkedRows.length > 0) {
      y = renderTableSection(doc, y, margin, contentWidth, "SIPOC — Not Yet Linked", columns, unlinkedRows, [0.2, 0.2, 0.2, 0.2, 0.2]);
    }
  }

  const bant = session.bantData as BANTData | null;
  if (bant && (bant.budget || bant.authority || bant.needs || bant.timeline)) {
    const rows = (["budget", "authority", "needs", "timeline"] as const)
      .filter(key => bant[key])
      .map(key => [key.charAt(0).toUpperCase() + key.slice(1), bant[key]!.value, bant[key]!.evidence || "-"]);
    y = renderTableSection(doc, y, margin, contentWidth, "BANT", ["Element", "Value", "Evidence"], rows, [0.15, 0.35, 0.5]);
  }

  const methodology = session.methodologyProgress as MethodologyProgress | null;
  if (methodology && methodology.stages.length > 0) {
    y = renderTableSection(doc, y, margin, contentWidth, "Methodology", ["Stage", "Completed"],
      methodology.stages.map(s => [s.name, s.completed ? "Yes" : "No"]), [0.8, 0.2]);
  }

  const competitorMentions = (session.competitorMentions || []) as CompetitorMention[];
  y = renderTableSection(doc, y, margin, contentWidth, "Competitor Mentions", ["Name", "Context"],
    competitorMentions.map(c => [c.name, c.context]), [0.3, 0.7]);

  const timelineSignals = (session.timelineSignals || []) as TimelineSignal[];
  y = renderTableSection(doc, y, margin, contentWidth, "Timeline Signals", ["Date", "Context", "Urgency"],
    timelineSignals.map(t => [t.date, t.context, t.urgency || "-"]), [0.2, 0.65, 0.15]);

  const riskFlags = (session.riskFlags || []) as RiskFlag[];
  y = renderTableSection(doc, y, margin, contentWidth, "Risk Flags", ["Item", "Type"],
    riskFlags.map(r => [r.text, r.type || "-"]), [0.8, 0.2]);

  if (session.transcript && session.transcript.length > 0) {
    if (y > 240) { doc.addPage(); y = margin; }
    doc.setFontSize(13);
    doc.setFont("helvetica", "bold");
    doc.text("Full Transcript", margin, y);
    y += 7;

    const mergedBlocks = parseAndMergeBlocks(session.transcript);
    const sessionStartMs = new Date(session.createdAt).getTime();
    const sessionEndMs = session.endedAt ? new Date(session.endedAt).getTime() : Date.now();
    const sessionDurationMs = sessionEndMs - sessionStartMs;

    const lineHeight = 4.5;
    const pageHeight = doc.internal.pageSize.getHeight();

    for (let blockIdx = 0; blockIdx < mergedBlocks.length; blockIdx++) {
      const block = mergedBlocks[blockIdx];

      if (block.speaker) {
        const timestamp = formatElapsedTimestamp(block.rawBlockIndex, block.rawBlockCount, sessionStartMs, sessionDurationMs);

        if (blockIdx > 0) {
          y += 4;
        }

        if (y + 10 > pageHeight - margin) {
          doc.addPage();
          y = margin;
        }

        doc.setFontSize(9);
        doc.setFont("helvetica", "bold");
        doc.text(`${timestamp}  \u2014  ${block.speaker}`, margin, y);
        y += 5;

        doc.setFontSize(9);
        doc.setFont("helvetica", "normal");
        const textLines = doc.splitTextToSize(block.content, contentWidth);
        for (let i = 0; i < textLines.length; i++) {
          if (y + lineHeight > pageHeight - margin) {
            doc.addPage();
            y = margin;
          }
          doc.text(textLines[i], margin, y);
          y += lineHeight;
        }
      } else {
        doc.setFontSize(9);
        doc.setFont("helvetica", "normal");
        const textLines = doc.splitTextToSize(block.content, contentWidth);
        for (let i = 0; i < textLines.length; i++) {
          if (y + lineHeight > pageHeight - margin) {
            doc.addPage();
            y = margin;
          }
          doc.text(textLines[i], margin, y);
          y += lineHeight;
        }
      }
    }
  }

  doc.save(`${buildExportFilename(session)}.pdf`);
}

export function exportSessionJson(session: SessionWithTopics) {
  const blob = new Blob([JSON.stringify(session, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${buildExportFilename(session)}.json`;
  a.click();
  URL.revokeObjectURL(url);
}
