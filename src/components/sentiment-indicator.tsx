import { useMemo } from "react";
import { TrendingUp, TrendingDown, Minus, Smile, Frown, Meh } from "lucide-react";

interface SentimentPoint {
  chunkIndex: number;
  score: number;
  label: string;
  speaker?: string;
}

interface SentimentIndicatorProps {
  sentimentData: SentimentPoint[];
  overallSentiment?: number | null;
  compact?: boolean;
}

function getSentimentColor(score: number): string {
  if (score >= 60) return "text-green-500";
  if (score >= 20) return "text-emerald-500";
  if (score > -20) return "text-muted-foreground";
  if (score > -60) return "text-orange-500";
  return "text-red-500";
}

function getSentimentBgColor(score: number): string {
  if (score >= 60) return "bg-green-500";
  if (score >= 20) return "bg-emerald-500";
  if (score > -20) return "bg-gray-400 dark:bg-gray-500";
  if (score > -60) return "bg-orange-500";
  return "bg-red-500";
}

function getSentimentLabel(score: number): string {
  if (score >= 60) return "Very Positive";
  if (score >= 20) return "Positive";
  if (score > -20) return "Neutral";
  if (score > -60) return "Negative";
  return "Very Negative";
}

function SentimentIcon({ score, className }: { score: number; className?: string }) {
  if (score >= 20) return <Smile className={className} />;
  if (score > -20) return <Meh className={className} />;
  return <Frown className={className} />;
}

export function SentimentIndicator({ sentimentData, overallSentiment, compact }: SentimentIndicatorProps) {
  const data = sentimentData || [];
  const overall = overallSentiment ?? 0;

  const trend = useMemo(() => {
    if (data.length < 2) return 0;
    const half = Math.floor(data.length / 2);
    const firstHalf = data.slice(0, half);
    const secondHalf = data.slice(half);
    const firstAvg = firstHalf.reduce((s, d) => s + d.score, 0) / firstHalf.length;
    const secondAvg = secondHalf.reduce((s, d) => s + d.score, 0) / secondHalf.length;
    return secondAvg - firstAvg;
  }, [data]);

  if (data.length === 0) return null;

  if (compact) {
    return (
      <div className="flex items-center gap-1.5" data-testid="sentiment-compact">
        <SentimentIcon score={overall} className={`h-3.5 w-3.5 ${getSentimentColor(overall)}`} />
        <span className={`text-xs font-medium ${getSentimentColor(overall)}`}>
          {getSentimentLabel(overall)}
        </span>
      </div>
    );
  }

  const maxAbsScore = Math.max(...data.map((d) => Math.abs(d.score)), 1);
  const chartHeight = 48;

  return (
    <div className="space-y-2" data-testid="sentiment-chart">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <SentimentIcon score={overall} className={`h-4 w-4 ${getSentimentColor(overall)}`} />
          <span className={`text-xs font-semibold ${getSentimentColor(overall)}`}>
            {getSentimentLabel(overall)}
          </span>
          <span className="text-[10px] text-muted-foreground">({overall > 0 ? "+" : ""}{overall})</span>
        </div>
        {data.length >= 2 && (
          <div className="flex items-center gap-0.5 text-[10px] text-muted-foreground">
            {trend > 5 ? (
              <TrendingUp className="h-3 w-3 text-green-500" />
            ) : trend < -5 ? (
              <TrendingDown className="h-3 w-3 text-red-500" />
            ) : (
              <Minus className="h-3 w-3" />
            )}
            <span>{trend > 5 ? "Improving" : trend < -5 ? "Declining" : "Stable"}</span>
          </div>
        )}
      </div>

      <div className="relative" style={{ height: chartHeight }}>
        <div className="absolute inset-x-0 top-1/2 h-px bg-border" />
        <div className="flex items-end justify-between h-full gap-px">
          {data.map((point, i) => {
            const normalizedHeight = (Math.abs(point.score) / 100) * (chartHeight / 2);
            const isPositive = point.score >= 0;
            return (
              <div
                key={i}
                className="flex-1 flex flex-col items-center justify-center relative"
                style={{ height: chartHeight }}
                title={`${point.speaker ? point.speaker + ": " : ""}${getSentimentLabel(point.score)} (${point.score > 0 ? "+" : ""}${point.score})`}
              >
                <div
                  className={`w-full max-w-[12px] rounded-sm transition-all ${getSentimentBgColor(point.score)} opacity-70`}
                  style={{
                    height: Math.max(normalizedHeight, 2),
                    position: "absolute",
                    ...(isPositive
                      ? { bottom: chartHeight / 2 }
                      : { top: chartHeight / 2 }),
                  }}
                  data-testid={`sentiment-bar-${i}`}
                />
              </div>
            );
          })}
        </div>
      </div>

      {data.some((d) => d.speaker) && (
        <div className="flex flex-wrap gap-1.5">
          {[...new Set(data.map((d) => d.speaker).filter(Boolean))].map((speaker) => (
            <span
              key={speaker}
              className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground"
              data-testid={`speaker-tag-${speaker?.toLowerCase().replace(/\s/g, "-")}`}
            >
              {speaker}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

export function SentimentBadge({ score, sessionId }: { score: number; sessionId?: number }) {
  return (
    <span
      className={`inline-flex items-center gap-1 text-[10px] font-medium ${getSentimentColor(score)}`}
      data-testid={sessionId ? `sentiment-badge-${sessionId}` : "sentiment-badge"}
    >
      <SentimentIcon score={score} className="h-3 w-3" />
      {getSentimentLabel(score)}
    </span>
  );
}
