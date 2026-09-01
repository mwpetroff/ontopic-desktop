import ExcelJS from "exceljs";
import type { Session, Requirement, PainPoint, SIPOCData } from "@shared/schema";
import { SIPOC_COLUMNS } from "@/components/sipoc-board";

type SessionForExport = Session;

const HEADER_FILL: ExcelJS.Fill = {
  type: "pattern",
  pattern: "solid",
  fgColor: { argb: "FF3C3C3C" },
};

function styleHeaderRow(row: ExcelJS.Row) {
  row.font = { bold: true, color: { argb: "FFFFFFFF" } };
  row.fill = HEADER_FILL;
  row.alignment = { vertical: "middle", wrapText: true };
}

function autosizeColumns(sheet: ExcelJS.Worksheet, widths: number[]) {
  sheet.columns.forEach((col, i) => {
    col.width = widths[i] ?? 20;
  });
}

/** Builds the BA-tabs workbook (Requirements, Pain Points, SIPOC) — split out from the
 * download trigger below so the sheet-construction logic is testable without a DOM. */
export function buildBaTabsWorkbook(session: SessionForExport): ExcelJS.Workbook {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "OnTopic Desktop";
  workbook.created = new Date();

  const requirements = (session.requirements || []) as Requirement[];
  const reqSheet = workbook.addWorksheet("Requirements");
  reqSheet.addRow(["Requirement", "Source"]);
  styleHeaderRow(reqSheet.getRow(1));
  requirements.forEach((r) => reqSheet.addRow([r.text, r.source || ""]));
  autosizeColumns(reqSheet, [70, 25]);
  reqSheet.getColumn(1).alignment = { wrapText: true, vertical: "top" };

  const painPoints = (session.painPoints || []) as PainPoint[];
  const painSheet = workbook.addWorksheet("Pain Points");
  painSheet.addRow(["Pain Point", "Business Impact"]);
  styleHeaderRow(painSheet.getRow(1));
  painPoints.forEach((p) => painSheet.addRow([p.text, p.impact || ""]));
  autosizeColumns(painSheet, [55, 45]);
  painSheet.getColumn(1).alignment = { wrapText: true, vertical: "top" };
  painSheet.getColumn(2).alignment = { wrapText: true, vertical: "top" };

  const sipoc = session.sipocData as SIPOCData | null;
  const sipocSheet = workbook.addWorksheet("SIPOC");
  const hasLinks = !!sipoc?.links?.length;

  sipocSheet.addRow(SIPOC_COLUMNS.map((c) => c.label));
  styleHeaderRow(sipocSheet.getRow(1));

  if (sipoc && hasLinks) {
    // Confirmed chains first — one row per link, exactly as traced from the full
    // transcript by the post-session linking pass. Real row-to-row correspondence,
    // not independent lists padded to the same length.
    for (const link of sipoc.links!) {
      sipocSheet.addRow(SIPOC_COLUMNS.map((c) => link[c.linkKey] || ""));
    }
    const linkedTextByCategory = new Map(
      SIPOC_COLUMNS.map((c) => [c.key, new Set(sipoc.links!.map((l) => l[c.linkKey]).filter(Boolean) as string[])])
    );
    const unlinked = SIPOC_COLUMNS.map((c) => sipoc[c.key].filter((item) => !linkedTextByCategory.get(c.key)!.has(item.text)));
    const anyUnlinked = unlinked.some((items) => items.length > 0);
    if (anyUnlinked) {
      sipocSheet.addRow([]);
      const labelRow = sipocSheet.addRow(["Not Yet Linked"]);
      labelRow.font = { italic: true, color: { argb: "FF888888" } };
      const maxLen = Math.max(1, ...unlinked.map((items) => items.length));
      for (let i = 0; i < maxLen; i++) {
        sipocSheet.addRow(unlinked.map((items) => items[i]?.text || ""));
      }
    }
  } else if (sipoc) {
    const maxLen = Math.max(1, ...SIPOC_COLUMNS.map((c) => sipoc[c.key].length));
    for (let i = 0; i < maxLen; i++) {
      sipocSheet.addRow(SIPOC_COLUMNS.map((c) => sipoc[c.key][i]?.text || ""));
    }
  }
  autosizeColumns(sipocSheet, [24, 24, 24, 24, 24]);
  sipocSheet.eachRow((row) => {
    row.alignment = { wrapText: true, vertical: "top" };
  });

  return workbook;
}

/** Exports the BA-role tabs (Requirements, Pain Points, SIPOC) as a downloaded .xlsx file. */
export async function exportBaTabsExcel(session: SessionForExport): Promise<void> {
  const workbook = buildBaTabsWorkbook(session);
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  const url = URL.createObjectURL(blob);
  const slug = session.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
  const a = document.createElement("a");
  a.href = url;
  a.download = `${slug}-ba-tabs.xlsx`;
  a.click();
  URL.revokeObjectURL(url);
}
