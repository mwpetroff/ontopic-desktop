import { CheckCircle2, Circle, User, AlertTriangle, ArrowUp, ArrowRight, ArrowDown } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface ActionItem {
  text: string;
  assignee?: string;
  priority?: string;
}

interface ActionItemsPanelProps {
  items: ActionItem[];
  compact?: boolean;
}

function PriorityIcon({ priority }: { priority?: string }) {
  switch (priority) {
    case "high":
      return <ArrowUp className="h-3 w-3 text-red-500" />;
    case "medium":
      return <ArrowRight className="h-3 w-3 text-amber-500" />;
    case "low":
      return <ArrowDown className="h-3 w-3 text-blue-500" />;
    default:
      return <ArrowRight className="h-3 w-3 text-muted-foreground" />;
  }
}

function priorityColor(priority?: string) {
  switch (priority) {
    case "high": return "text-red-600 dark:text-red-400 bg-red-500/10";
    case "medium": return "text-amber-600 dark:text-amber-400 bg-amber-500/10";
    case "low": return "text-blue-600 dark:text-blue-400 bg-blue-500/10";
    default: return "text-muted-foreground bg-muted";
  }
}

export function ActionItemsPanel({ items, compact }: ActionItemsPanelProps) {
  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-center px-4" data-testid="action-items-empty">
        <Circle className="h-6 w-6 text-muted-foreground/20 mb-2" />
        <p className="text-xs text-muted-foreground">
          Action items will appear here as they're detected in the conversation.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-1.5" data-testid="action-items-list">
      {items.map((item, i) => (
        <div
          key={i}
          className={`flex items-start gap-2 rounded-md border border-border p-2 ${compact ? "py-1.5" : ""}`}
          data-testid={`action-item-${i}`}
        >
          <CheckCircle2 className="h-3.5 w-3.5 mt-0.5 shrink-0 text-muted-foreground/40" />
          <div className="flex-1 min-w-0">
            <p className="text-xs leading-relaxed">{item.text}</p>
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              {item.assignee && (
                <span className="inline-flex items-center gap-0.5 text-[10px] text-muted-foreground">
                  <User className="h-2.5 w-2.5" />
                  {item.assignee}
                </span>
              )}
              {item.priority && (
                <Badge variant="secondary" className={`text-[10px] px-1.5 py-0 h-4 gap-0.5 ${priorityColor(item.priority)}`}>
                  <PriorityIcon priority={item.priority} />
                  {item.priority}
                </Badge>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
