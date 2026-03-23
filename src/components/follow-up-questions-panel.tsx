import { useState, useCallback } from "react";
import { HelpCircle, Lightbulb } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";

interface FollowUpQuestion {
  question: string;
  context?: string;
}

interface FollowUpQuestionsPanelProps {
  questions: FollowUpQuestion[];
}

export function FollowUpQuestionsPanel({ questions }: FollowUpQuestionsPanelProps) {
  const [answered, setAnswered] = useState<Set<number>>(new Set());

  const toggleAnswered = useCallback((index: number) => {
    setAnswered(prev => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  }, []);

  if (questions.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-center px-4" data-testid="followup-questions-empty">
        <HelpCircle className="h-6 w-6 text-muted-foreground/20 mb-2" />
        <p className="text-xs text-muted-foreground">
          Suggested follow-up questions will appear here based on the conversation.
        </p>
      </div>
    );
  }

  const unanswered = questions.filter((_, i) => !answered.has(i));
  const answeredList = questions.filter((_, i) => answered.has(i));
  const answeredCount = answered.size;
  const totalCount = questions.length;

  return (
    <div className="space-y-2" data-testid="followup-questions-list">
      {answeredCount > 0 && (
        <p className="text-[10px] text-muted-foreground" data-testid="followup-answered-count">
          {answeredCount} of {totalCount} answered
        </p>
      )}
      {unanswered.map((q, _uIdx) => {
        const originalIndex = questions.indexOf(q);
        return (
          <div
            key={`q-${originalIndex}`}
            className="flex items-start gap-2 rounded-md border border-border p-2.5 bg-primary/[0.02] dark:bg-primary/[0.04] cursor-pointer"
            data-testid={`followup-question-${originalIndex}`}
            onClick={() => toggleAnswered(originalIndex)}
          >
            <Checkbox
              checked={false}
              onCheckedChange={() => toggleAnswered(originalIndex)}
              className="mt-0.5 shrink-0 h-3.5 w-3.5"
              data-testid={`followup-checkbox-${originalIndex}`}
              onClick={(e) => e.stopPropagation()}
            />
            <Lightbulb className="h-3.5 w-3.5 mt-0.5 shrink-0 text-amber-500" />
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium leading-relaxed">{q.question}</p>
              {q.context && (
                <p className="text-[10px] text-muted-foreground mt-1 leading-relaxed italic">
                  {q.context}
                </p>
              )}
            </div>
          </div>
        );
      })}
      {answeredList.map((q) => {
        const originalIndex = questions.indexOf(q);
        return (
          <div
            key={`q-${originalIndex}`}
            className="flex items-start gap-2 rounded-md border border-border/50 p-2.5 bg-muted/30 cursor-pointer opacity-60"
            data-testid={`followup-question-${originalIndex}`}
            onClick={() => toggleAnswered(originalIndex)}
          >
            <Checkbox
              checked={true}
              onCheckedChange={() => toggleAnswered(originalIndex)}
              className="mt-0.5 shrink-0 h-3.5 w-3.5"
              data-testid={`followup-checkbox-${originalIndex}`}
              onClick={(e) => e.stopPropagation()}
            />
            <Lightbulb className="h-3.5 w-3.5 mt-0.5 shrink-0 text-muted-foreground" />
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium leading-relaxed line-through text-muted-foreground">{q.question}</p>
              {q.context && (
                <p className="text-[10px] text-muted-foreground mt-1 leading-relaxed italic line-through">
                  {q.context}
                </p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
