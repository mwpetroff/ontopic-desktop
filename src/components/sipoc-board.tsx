import { ChevronRight, X } from "lucide-react";
import type { SIPOCData } from "@shared/schema";

type SipocCategory = keyof Omit<SIPOCData, "lastUpdated">;

export const SIPOC_COLUMNS: Array<{
  key: SipocCategory;
  letter: string;
  label: string;
  header: string;
  card: string;
}> = [
  { key: "suppliers", letter: "S", label: "Suppliers", header: "bg-slate-500", card: "bg-slate-50 dark:bg-slate-800/40 border-slate-200 dark:border-slate-700" },
  { key: "inputs", letter: "I", label: "Inputs", header: "bg-amber-500", card: "bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800" },
  { key: "process", letter: "P", label: "Process", header: "bg-sky-500", card: "bg-sky-50 dark:bg-sky-900/20 border-sky-200 dark:border-sky-800" },
  { key: "outputs", letter: "O", label: "Outputs", header: "bg-emerald-500", card: "bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800" },
  { key: "customers", letter: "C", label: "Customers", header: "bg-rose-500", card: "bg-rose-50 dark:bg-rose-900/20 border-rose-200 dark:border-rose-800" },
];

export function SipocBoard({
  data,
  onRemoveItem,
  compact = false,
}: {
  data: SIPOCData | null;
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

  return (
    <div className="min-w-0">
      {/* Header band — colored blocks connected by flow arrows, evoking the classic SIPOC map layout */}
      <div className="flex items-stretch mb-2">
        {SIPOC_COLUMNS.map((col, i) => (
          <div key={col.key} className="flex items-stretch flex-1 min-w-0">
            <div
              className={`flex flex-col items-center justify-center rounded-t-md text-white flex-1 min-w-0 ${col.header} ${compact ? "py-1" : "py-2"}`}
            >
              <span className={compact ? "text-xs font-black leading-none" : "text-xl font-black leading-none"}>{col.letter}</span>
              {!compact && (
                <span className="text-[9px] font-semibold uppercase tracking-wider opacity-90 mt-0.5">{col.label}</span>
              )}
            </div>
            {i < SIPOC_COLUMNS.length - 1 && (
              <div className="flex items-center justify-center w-3 shrink-0" aria-hidden="true">
                <ChevronRight className={`text-muted-foreground/50 ${compact ? "h-2.5 w-2.5" : "h-3.5 w-3.5"}`} />
              </div>
            )}
          </div>
        ))}
      </div>

      <div className={`grid grid-cols-5 ${compact ? "gap-0.5" : "gap-1.5"} items-start`}>
        {SIPOC_COLUMNS.map((col) => {
          const items = data[col.key];
          return (
            <div key={col.key} className="min-w-0 space-y-1">
              {items.length > 0 ? (
                items.map((item, i) => (
                  <div
                    key={i}
                    className={`group rounded border ${col.card} ${compact ? "px-1 py-0.5" : "px-2 py-1.5"} flex items-start justify-between gap-1`}
                    data-testid={`sipoc-item-${col.key}-${i}`}
                  >
                    <span className={compact ? "text-[9px] leading-snug" : "text-xs leading-snug"}>{item.text}</span>
                    {onRemoveItem && (
                      <button
                        onClick={() => onRemoveItem(col.key, i)}
                        className="shrink-0 text-muted-foreground/0 group-hover:text-muted-foreground/60 hover:!text-destructive transition-colors"
                        data-testid={`button-remove-sipoc-${col.key}-${i}`}
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
  );
}
