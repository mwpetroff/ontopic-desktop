import { ChevronRight, X } from "lucide-react";
import type { SIPOCData, SIPOCLink } from "@shared/schema";

type SipocCategory = keyof Omit<SIPOCData, "lastUpdated" | "links" | "linkedAt">;

// SIPOCData's flat category arrays are plural ("suppliers"); SIPOCLink's fields are
// singular ("supplier") since a link is one row, not a bucket. linkKey bridges the two —
// note "process" doesn't follow the simple drop-the-trailing-s pattern, hence an explicit map.
export const SIPOC_COLUMNS: Array<{
  key: SipocCategory;
  linkKey: keyof SIPOCLink;
  letter: string;
  label: string;
  header: string;
  card: string;
}> = [
  { key: "suppliers", linkKey: "supplier", letter: "S", label: "Suppliers", header: "bg-slate-500", card: "bg-slate-50 dark:bg-slate-800/40 border-slate-200 dark:border-slate-700" },
  { key: "inputs", linkKey: "input", letter: "I", label: "Inputs", header: "bg-amber-500", card: "bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800" },
  { key: "process", linkKey: "process", letter: "P", label: "Process", header: "bg-sky-500", card: "bg-sky-50 dark:bg-sky-900/20 border-sky-200 dark:border-sky-800" },
  { key: "outputs", linkKey: "output", letter: "O", label: "Outputs", header: "bg-emerald-500", card: "bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800" },
  { key: "customers", linkKey: "customer", letter: "C", label: "Customers", header: "bg-rose-500", card: "bg-rose-50 dark:bg-rose-900/20 border-rose-200 dark:border-rose-800" },
];

function HeaderBand({ compact }: { compact: boolean }) {
  return (
    <div className="flex items-stretch mb-2">
      {SIPOC_COLUMNS.map((col, i) => (
        <div key={col.key} className="flex items-stretch flex-1 min-w-0">
          <div className={`flex flex-col items-center justify-center rounded-t-md text-white flex-1 min-w-0 text-center ${col.header} ${compact ? "py-1" : "py-2"}`}>
            {!compact && <span className="text-xl font-black leading-none">{col.letter}</span>}
            <span className={compact ? "text-[8px] font-semibold uppercase tracking-wide leading-tight px-0.5" : "text-[9px] font-semibold uppercase tracking-wider opacity-90 mt-0.5"}>
              {col.label}
            </span>
          </div>
          {i < SIPOC_COLUMNS.length - 1 && (
            <div className="flex items-center justify-center w-3 shrink-0" aria-hidden="true">
              <ChevronRight className={`text-muted-foreground/50 ${compact ? "h-2.5 w-2.5" : "h-3.5 w-3.5"}`} />
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

export function SipocBoard({
  data,
  links,
  onRemoveItem,
  compact = false,
}: {
  data: SIPOCData | null;
  links?: SIPOCLink[];
  onRemoveItem?: (category: SipocCategory, index: number) => void;
  compact?: boolean;
}) {
  const hasAny = !!data && SIPOC_COLUMNS.some((c) => data[c.key].length > 0);

  if (!data || !hasAny) {
    return (
      <p className={compact ? "text-xs text-muted-foreground/50 py-4 text-center" : "text-sm text-muted-foreground py-8 text-center"}>
        Suppliers, inputs, process, outputs, and customers surface here as the process is described.
      </p>
    );
  }

  const hasLinks = !!links && links.length > 0;
  const linkedTextByCategory: Partial<Record<SipocCategory, Set<string>>> = {};
  if (hasLinks) {
    for (const col of SIPOC_COLUMNS) {
      linkedTextByCategory[col.key] = new Set(links!.map((l) => l[col.linkKey]).filter(Boolean) as string[]);
    }
  }

  return (
    <div className="min-w-0 space-y-3">
      <HeaderBand compact={compact} />

      {hasLinks && (
        <div className="space-y-1">
          <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
            Confirmed Chains — traced from the full transcript
          </span>
          <div className="space-y-1">
            {links!.map((link, i) => {
              const values = SIPOC_COLUMNS.map((col) => link[col.linkKey]);
              return (
                <div
                  key={i}
                  className={`group flex items-stretch rounded-md border border-transparent hover:border-primary/40 hover:bg-muted/40 transition-colors ${compact ? "gap-0.5 p-0.5" : "gap-1 p-1"} ${i % 2 === 1 ? "bg-muted/20" : ""}`}
                  data-testid={`sipoc-link-${i}`}
                  title={link.evidence}
                >
                  <span className={`flex items-center justify-center shrink-0 rounded-full bg-muted text-muted-foreground/70 font-semibold ${compact ? "w-4 h-4 text-[8px]" : "w-5 h-5 text-[10px]"}`}>
                    {i + 1}
                  </span>
                  <div className="flex items-stretch flex-1 min-w-0">
                    {SIPOC_COLUMNS.map((col, colIdx) => {
                      const value = values[colIdx];
                      const nextValue = colIdx < SIPOC_COLUMNS.length - 1 ? values[colIdx + 1] : undefined;
                      return (
                        <div key={col.key} className="flex items-stretch flex-1 min-w-0">
                          <div
                            className={`rounded border flex-1 min-w-0 flex items-center ${compact ? "px-1 py-0.5" : "px-2 py-1.5"} ${value ? col.card : "border-transparent"}`}
                          >
                            <span className={`${compact ? "text-[9px]" : "text-xs"} leading-snug ${value ? "" : "text-muted-foreground/25"}`}>
                              {value || "·"}
                            </span>
                          </div>
                          {colIdx < SIPOC_COLUMNS.length - 1 && (
                            <div className="flex items-center justify-center w-3 shrink-0" aria-hidden="true">
                              {value && nextValue ? (
                                <ChevronRight className={`text-muted-foreground/60 ${compact ? "h-2.5 w-2.5" : "h-3 w-3"}`} />
                              ) : (
                                <span className="text-muted-foreground/15">·</span>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="space-y-1">
        {hasLinks && (
          <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Not Yet Linked</span>
        )}
        <div className={`grid grid-cols-5 ${compact ? "gap-0.5" : "gap-1.5"} items-start`}>
          {SIPOC_COLUMNS.map((col) => {
            const linkedSet = linkedTextByCategory[col.key];
            const items = data[col.key]
              .map((item, originalIndex) => ({ item, originalIndex }))
              .filter(({ item }) => !linkedSet || !linkedSet.has(item.text));
            return (
              <div key={col.key} className="min-w-0 space-y-1">
                {items.length > 0 ? (
                  items.map(({ item, originalIndex }) => (
                    <div
                      key={originalIndex}
                      className={`group rounded border ${col.card} ${compact ? "px-1 py-0.5" : "px-2 py-1.5"} flex items-start justify-between gap-1`}
                      data-testid={`sipoc-item-${col.key}-${originalIndex}`}
                    >
                      <span className={compact ? "text-[9px] leading-snug" : "text-xs leading-snug"}>{item.text}</span>
                      {onRemoveItem && (
                        <button
                          onClick={() => onRemoveItem(col.key, originalIndex)}
                          className="shrink-0 text-muted-foreground/0 group-hover:text-muted-foreground/60 hover:!text-destructive transition-colors"
                          data-testid={`button-remove-sipoc-${col.key}-${originalIndex}`}
                          aria-label={`Remove ${col.label.slice(0, -1)}`}
                        >
                          <X className={compact ? "h-2.5 w-2.5" : "h-3 w-3"} />
                        </button>
                      )}
                    </div>
                  ))
                ) : (
                  <div className={`rounded border border-dashed border-muted-foreground/20 ${compact ? "px-1 py-0.5" : "px-2 py-1.5"}`}>
                    <span className={compact ? "text-[9px] text-muted-foreground/40" : "text-[10px] text-muted-foreground/40"}>—</span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
