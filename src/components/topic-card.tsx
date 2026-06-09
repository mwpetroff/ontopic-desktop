import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Building2, Home, HelpCircle, Wrench, BookOpen, ChevronDown, Clock, Trash2 } from "lucide-react";
import type { Topic, Partner } from "@shared/schema";

const categoryColors: Record<string, string> = {
  infrastructure: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
  security: "bg-red-500/10 text-red-600 dark:text-red-400",
  cloud: "bg-sky-500/10 text-sky-600 dark:text-sky-400",
  development: "bg-green-500/10 text-green-600 dark:text-green-400",
  data: "bg-purple-500/10 text-purple-600 dark:text-purple-400",
  networking: "bg-orange-500/10 text-orange-600 dark:text-orange-400",
  methodology: "bg-teal-500/10 text-teal-600 dark:text-teal-400",
  business: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  "ai-ml": "bg-violet-500/10 text-violet-600 dark:text-violet-400",
  devops: "bg-cyan-500/10 text-cyan-600 dark:text-cyan-400",
  monitoring: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  collaboration: "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400",
  general: "bg-gray-500/10 text-gray-600 dark:text-gray-400",
};

const capabilityIcons: Record<string, typeof Home> = {
  "in-house": Home,
  partner: Building2,
  unknown: HelpCircle,
};

const capabilityLabels: Record<string, string> = {
  "in-house": "In-House",
  partner: "Partner",
  unknown: "Unknown",
};

const capabilityColors: Record<string, string> = {
  "in-house": "text-green-600 dark:text-green-400",
  partner: "text-blue-600 dark:text-blue-400",
  unknown: "text-muted-foreground",
};

function formatRelativeTimestamp(firstMentionedAt: string | Date, sessionStart: string | Date): string | null {
  const mentionTime = new Date(firstMentionedAt).getTime();
  const startTime = new Date(sessionStart).getTime();
  if (isNaN(mentionTime) || isNaN(startTime)) return null;
  const diffMs = Math.max(0, mentionTime - startTime);
  const totalSeconds = Math.floor(diffMs / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  }
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

interface TopicCardProps {
  topic: Topic;
  isNew?: boolean;
  editable?: boolean;
  sessionId?: number;
  sessionStartTime?: string | Date;
}

export function TopicCard({ topic, isNew, editable = false, sessionId, sessionStartTime }: TopicCardProps) {
  const [isOpen, setIsOpen] = useState(false);
  const colorClass = categoryColors[topic.category] || categoryColors.general;
  const CapIcon = capabilityIcons[topic.capabilitySource] || HelpCircle;
  const TypeIcon = topic.type === "tool" ? Wrench : BookOpen;

  const { data: partners = [] } = useQuery<Partner[]>({
    queryKey: ["/api/partners"],
    enabled: editable && isOpen,
  });

  const updateMutation = useMutation({
    mutationFn: async (data: { capabilitySource: string; partnerName?: string | null }) => {
      const res = await apiRequest("PATCH", `/api/topics/${topic.id}`, data);
      return res.json();
    },
    onSuccess: () => {
      if (sessionId) {
        queryClient.invalidateQueries({ queryKey: [`/api/sessions/${sessionId}/topics`] });
        queryClient.invalidateQueries({ queryKey: ["/api/sessions", sessionId] });
      }
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("DELETE", `/api/topics/${topic.id}`);
    },
    onSuccess: () => {
      if (sessionId) {
        queryClient.invalidateQueries({ queryKey: [`/api/sessions/${sessionId}/topics`] });
        queryClient.invalidateQueries({ queryKey: ["/api/sessions", sessionId] });
      }
    },
  });

  const handleCapabilityChange = (value: string) => {
    if (value === "in-house") {
      updateMutation.mutate({ capabilitySource: "in-house", partnerName: null });
    } else if (value === "unknown") {
      updateMutation.mutate({ capabilitySource: "unknown", partnerName: null });
    } else if (value.startsWith("partner:")) {
      const partnerName = value.replace("partner:", "");
      updateMutation.mutate({ capabilitySource: "partner", partnerName });
    }
    setIsOpen(false);
  };

  return (
    <div
      className={`group p-3 rounded-md border border-border bg-card transition-all duration-500 ${
        isNew ? "animate-in fade-in slide-in-from-right-4 duration-500" : ""
      }`}
      data-testid={`topic-card-${topic.id}`}
    >
      <div className="flex items-start justify-between gap-2 mb-1.5">
        <div className="flex items-center gap-1.5 min-w-0">
          <TypeIcon className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
          <h4 className="text-sm font-semibold text-card-foreground leading-tight truncate">
            {topic.term}
          </h4>
        </div>
        <div className="flex items-center gap-1.5 shrink-0 flex-wrap">
          {topic.mentionCount > 1 && (
            <span className="text-[10px] font-medium text-muted-foreground tabular-nums">
              x{topic.mentionCount}
            </span>
          )}
          <Badge
            variant="secondary"
            className={`text-[10px] px-1.5 py-0 h-5 font-medium border-0 ${
              topic.type === "tool"
                ? "bg-primary/10 text-primary"
                : colorClass
            }`}
          >
            {topic.type === "tool" ? "tool" : topic.category}
          </Badge>
          {topic.type === "tool" && topic.category !== "general" && (
            <Badge
              variant="secondary"
              className={`text-[10px] px-1.5 py-0 h-5 font-medium ${colorClass} border-0`}
            >
              {topic.category}
            </Badge>
          )}
          {editable && (
            <Button
              size="icon"
              variant="ghost"
              className="h-5 w-5 opacity-0 group-hover:opacity-100 transition-opacity"
              onClick={() => deleteMutation.mutate()}
              disabled={deleteMutation.isPending}
              data-testid={`button-delete-topic-${topic.id}`}
            >
              <Trash2 className="h-3 w-3 text-muted-foreground hover:text-destructive" />
            </Button>
          )}
        </div>
      </div>

      <p className="text-xs text-muted-foreground leading-relaxed mb-2">
        {topic.definition}
      </p>

      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-3">
          <div className={`flex items-center gap-1 text-[11px] font-medium ${capabilityColors[topic.capabilitySource]}`}>
            <CapIcon className="h-3 w-3" />
            <span>{capabilityLabels[topic.capabilitySource]}</span>
            {topic.partnerName && (
              <span className="text-muted-foreground">
                ({topic.partnerName})
              </span>
            )}
          </div>
          {sessionStartTime && topic.firstMentionedAt && (() => {
            const ts = formatRelativeTimestamp(topic.firstMentionedAt, sessionStartTime);
            if (!ts) return null;
            return (
              <div className="flex items-center gap-0.5 text-[10px] text-muted-foreground/70" data-testid={`topic-timestamp-${topic.id}`}>
                <Clock className="h-2.5 w-2.5" />
                <span className="tabular-nums">{ts}</span>
              </div>
            );
          })()}
        </div>

        {editable && (
          <Popover open={isOpen} onOpenChange={setIsOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 px-2 text-[10px] text-muted-foreground"
                data-testid={`button-set-capability-${topic.id}`}
              >
                Set
                <ChevronDown className="h-3 w-3 ml-0.5" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-48 p-1" align="end">
              <button
                className="w-full flex items-center gap-2 px-2 py-1.5 text-xs rounded-sm hover:bg-accent text-left"
                onClick={() => handleCapabilityChange("in-house")}
                data-testid={`option-in-house-${topic.id}`}
              >
                <Home className="h-3.5 w-3.5 text-green-600 dark:text-green-400" />
                In-House
              </button>
              {partners.map((p) => (
                <button
                  key={p.id}
                  className="w-full flex items-center gap-2 px-2 py-1.5 text-xs rounded-sm hover:bg-accent text-left"
                  onClick={() => handleCapabilityChange(`partner:${p.name}`)}
                  data-testid={`option-partner-${p.id}-${topic.id}`}
                >
                  <Building2 className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
                  {p.name}
                </button>
              ))}
              <button
                className="w-full flex items-center gap-2 px-2 py-1.5 text-xs rounded-sm hover:bg-accent text-left"
                onClick={() => handleCapabilityChange("unknown")}
                data-testid={`option-unknown-${topic.id}`}
              >
                <HelpCircle className="h-3.5 w-3.5 text-muted-foreground" />
                Unknown
              </button>
            </PopoverContent>
          </Popover>
        )}
      </div>
    </div>
  );
}
