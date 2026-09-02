import type { SIPOCData } from "@shared/schema";
import { SIPOC_COLUMNS } from "@/components/sipoc-board";

/** Shared by the PDF and Excel exports so both render SIPOC identically: when links
 * exist, one row per confirmed chain followed by any items no link references; when
 * they don't (still live, or an older session from before BL-010), the original
 * independent-column layout padded to the longest category. */
export function computeSipocRows(sipoc: SIPOCData): { columns: string[]; linkedRows: string[][]; unlinkedRows: string[][] } {
  const columns = SIPOC_COLUMNS.map((c) => c.label);

  if (sipoc.links && sipoc.links.length > 0) {
    const linkedRows = sipoc.links.map((link) => SIPOC_COLUMNS.map((c) => link[c.linkKey] || ""));
    const linkedTextByCategory = new Map(
      SIPOC_COLUMNS.map((c) => [c.key, new Set(sipoc.links!.map((l) => l[c.linkKey]).filter(Boolean) as string[])])
    );
    const unlinkedByColumn = SIPOC_COLUMNS.map((c) => sipoc[c.key].filter((item) => !linkedTextByCategory.get(c.key)!.has(item.text)));
    const maxLen = Math.max(0, ...unlinkedByColumn.map((items) => items.length));
    const unlinkedRows: string[][] = [];
    for (let i = 0; i < maxLen; i++) {
      unlinkedRows.push(unlinkedByColumn.map((items) => items[i]?.text || ""));
    }
    return { columns, linkedRows, unlinkedRows };
  }

  const maxLen = Math.max(1, ...SIPOC_COLUMNS.map((c) => sipoc[c.key].length));
  const rows: string[][] = [];
  for (let i = 0; i < maxLen; i++) {
    rows.push(SIPOC_COLUMNS.map((c) => sipoc[c.key][i]?.text || ""));
  }
  return { columns, linkedRows: rows, unlinkedRows: [] };
}
