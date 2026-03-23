import { useMemo } from "react";
import type { Topic } from "@shared/schema";
import { getSpeakerColor } from "@/lib/speaker-colors";
import { parseAndMergeBlocks, formatElapsedTimestamp } from "@/lib/transcript";

interface HighlightedTranscriptProps {
  text: string;
  topics: Topic[];
  sessionStart?: string;
  sessionEnd?: string | null;
}

export function HighlightedTranscript({ text, topics, sessionStart, sessionEnd }: HighlightedTranscriptProps) {
  const rendered = useMemo(() => {
    if (!text) return null;

    const blocks = parseAndMergeBlocks(text);
    const speakerMap = new Map<string, number>();

    const startMs = sessionStart ? new Date(sessionStart).getTime() : 0;
    const endMs = sessionEnd ? new Date(sessionEnd).getTime() : (sessionStart ? Date.now() : 0);
    const durationMs = endMs - startMs;
    const showTimestamps = !!sessionStart && durationMs > 0;

    return blocks.map((block, blockIdx) => {
      const highlighted = highlightTerms(block.content, topics);
      const color = block.speaker ? getSpeakerColor(block.speaker, speakerMap) : null;
      const timestamp = showTimestamps
        ? formatElapsedTimestamp(block.rawBlockIndex, block.rawBlockCount, startMs, durationMs)
        : null;

      return (
        <div
          key={blockIdx}
          className={`pl-3 border-l-2 ${color ? color.border : "border-transparent"} ${blockIdx > 0 ? "mt-4" : ""}`}
          data-testid={`transcript-block-${blockIdx}`}
        >
          {block.speaker && (
            <div
              className={`flex items-baseline gap-2 mb-1`}
              data-testid={`speaker-label-${block.speaker.toLowerCase().replace(/\s/g, "-")}`}
            >
              <span className={`text-xs font-semibold ${color ? color.text : "text-primary"}`}>
                {block.speaker}
              </span>
              {timestamp && (
                <span className="text-[10px] text-muted-foreground font-mono" data-testid={`timestamp-${blockIdx}`}>
                  {timestamp}
                </span>
              )}
            </div>
          )}
          <div className="text-sm text-foreground leading-relaxed">
            {highlighted}
          </div>
        </div>
      );
    });
  }, [text, topics, sessionStart, sessionEnd]);

  if (!text) return null;

  return (
    <div
      className="space-y-0"
      data-testid="text-transcript"
    >
      {rendered}
    </div>
  );
}

function highlightTerms(text: string, topics: Topic[]) {
  if (!text || topics.length === 0) return text;

  const terms = topics
    .map((t) => t.term)
    .sort((a, b) => b.length - a.length);

  const escapedTerms = terms.map((t) =>
    t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
  );
  const pattern = new RegExp(`(${escapedTerms.join("|")})`, "gi");

  const parts = text.split(pattern);

  return parts.map((part, i) => {
    const match = topics.find(
      (t) => t.term.toLowerCase() === part.toLowerCase()
    );
    if (match) {
      return (
        <mark
          key={i}
          className="bg-primary/15 text-primary dark:bg-primary/20 dark:text-primary rounded-sm px-0.5 font-medium"
          data-testid={`highlight-${match.term.toLowerCase().replace(/\s+/g, "-")}`}
        >
          {part}
        </mark>
      );
    }
    return <span key={i}>{part}</span>;
  });
}
