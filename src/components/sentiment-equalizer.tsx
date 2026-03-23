import { useMemo, useState } from "react";
import { Smile, Frown, Meh, TrendingUp, TrendingDown, Minus, Activity } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface SentimentPoint {
  chunkIndex: number;
  score: number;
  label: string;
  speaker?: string;
}

function scoreToColor(score: number): string {
  const normalized = (score + 100) / 200;
  if (normalized >= 0.7) {
    const t = (normalized - 0.7) / 0.3;
    const r = Math.round(34 + (22 - 34) * t);
    const g = Math.round(197 + (163 - 197) * t);
    const b = Math.round(94 + (74 - 94) * t);
    return `rgb(${r}, ${g}, ${b})`;
  }
  if (normalized >= 0.4) {
    const t = (normalized - 0.4) / 0.3;
    const r = Math.round(234 + (34 - 234) * t);
    const g = Math.round(179 + (197 - 179) * t);
    const b = Math.round(8 + (94 - 8) * t);
    return `rgb(${r}, ${g}, ${b})`;
  }
  const t = normalized / 0.4;
  const r = Math.round(239 + (234 - 239) * t);
  const g = Math.round(68 + (179 - 68) * t);
  const b = Math.round(68 + (8 - 68) * t);
  return `rgb(${r}, ${g}, ${b})`;
}

function scoreToHeight(score: number): number {
  return 0.2 + (Math.abs(score) / 100) * 0.8;
}

function scoreToLabel(score: number): string {
  if (score >= 60) return "Very Positive";
  if (score >= 20) return "Positive";
  if (score > -20) return "Neutral";
  if (score > -60) return "Negative";
  return "Very Negative";
}

function ScoreIcon({ score, className }: { score: number; className?: string }) {
  if (score >= 20) return <Smile className={className} />;
  if (score > -20) return <Meh className={className} />;
  return <Frown className={className} />;
}

function formatBarTimestamp(chunkIndex: number, totalChunks: number, sessionStartMs: number, sessionDurationMs: number): string {
  if (!sessionStartMs || !sessionDurationMs || totalChunks <= 0) return "";
  const elapsedMs = (chunkIndex / Math.max(totalChunks, 1)) * sessionDurationMs;
  const totalSeconds = Math.floor(elapsedMs / 1000);
  const mm = Math.floor(totalSeconds / 60).toString().padStart(2, "0");
  const ss = (totalSeconds % 60).toString().padStart(2, "0");
  return `${mm}:${ss}`;
}

interface SentimentEqualizerProps {
  sentimentData: SentimentPoint[];
  overallSentiment: number;
  maxBars?: number;
  sessionStart?: string;
  sessionEnd?: string | null;
}

export function SentimentEqualizer({ sentimentData, overallSentiment, maxBars = 24, sessionStart, sessionEnd }: SentimentEqualizerProps) {
  const data = sentimentData || [];

  if (data.length === 0) return null;

  const display = data.length > maxBars ? data.slice(-maxBars) : data;
  const overallColor = scoreToColor(overallSentiment);

  const startMs = sessionStart ? new Date(sessionStart).getTime() : 0;
  const endMs = sessionEnd ? new Date(sessionEnd).getTime() : (sessionStart ? Date.now() : 0);
  const durationMs = endMs - startMs;

  return (
    <TooltipProvider delayDuration={0}>
      <div className="flex items-center gap-1.5" data-testid="sentiment-equalizer">
        <div
          className="flex items-end gap-[2px] h-6 shrink-0"
        >
          {display.map((point, i) => {
            const height = scoreToHeight(point.score);
            const color = scoreToColor(point.score);
            const isLatest = i === display.length - 1;
            const timestamp = formatBarTimestamp(point.chunkIndex, data.length, startMs, durationMs);
            const tooltipText = [
              point.speaker || null,
              timestamp || null,
              `${scoreToLabel(point.score)} (${point.score > 0 ? "+" : ""}${point.score})`,
            ].filter(Boolean).join(" \u2022 ");

            return (
              <Tooltip key={point.chunkIndex}>
                <TooltipTrigger asChild>
                  <div
                    className="rounded-sm transition-all duration-500 ease-out cursor-pointer"
                    style={{
                      width: 4,
                      height: `${height * 100}%`,
                      backgroundColor: color,
                      opacity: isLatest ? 1 : 0.6 + (i / display.length) * 0.4,
                    }}
                    data-testid={`eq-bar-${i}`}
                  />
                </TooltipTrigger>
                <TooltipContent side="top" className="text-xs">
                  {tooltipText}
                </TooltipContent>
              </Tooltip>
            );
          })}
        </div>
        <span
          className="text-[10px] font-medium whitespace-nowrap"
          style={{ color: overallColor }}
        >
          {scoreToLabel(overallSentiment)}
        </span>
      </div>
    </TooltipProvider>
  );
}

interface SentimentEqualizerFullProps {
  sentimentData: SentimentPoint[];
  overallSentiment?: number | null;
  sessionStart?: string;
  sessionEnd?: string | null;
}

export function SentimentEqualizerFull({ sentimentData, overallSentiment, sessionStart, sessionEnd }: SentimentEqualizerFullProps) {
  const data = sentimentData || [];
  const overall = overallSentiment ?? 0;
  const [hoveredBar, setHoveredBar] = useState<number | null>(null);

  const startMs = sessionStart ? new Date(sessionStart).getTime() : 0;
  const endMs = sessionEnd ? new Date(sessionEnd).getTime() : (sessionStart ? Date.now() : 0);
  const durationMs = endMs - startMs;

  const trend = useMemo(() => {
    if (data.length < 2) return 0;
    const half = Math.floor(data.length / 2);
    const firstHalf = data.slice(0, half);
    const secondHalf = data.slice(half);
    const firstAvg = firstHalf.reduce((s, d) => s + d.score, 0) / firstHalf.length;
    const secondAvg = secondHalf.reduce((s, d) => s + d.score, 0) / secondHalf.length;
    return secondAvg - firstAvg;
  }, [data]);

  const latestScore = data.length > 0 ? data[data.length - 1].score : 0;
  const latestColor = scoreToColor(latestScore);

  if (data.length === 0) return null;

  const overallColor = scoreToColor(overall);
  const gaugePercent = ((overall + 100) / 200) * 100;

  return (
    <div className="rounded-lg border border-border bg-card/60 p-3" data-testid="sentiment-equalizer-full">
      <div className="flex items-stretch gap-4">
        <div className="flex flex-col items-center justify-center gap-1 min-w-[80px]" data-testid="sentiment-score-display">
          <div
            className="relative flex items-center justify-center w-14 h-14 rounded-full border-[3px] transition-colors duration-700"
            style={{
              borderColor: overallColor,
              boxShadow: `0 0 12px ${overallColor}40, 0 0 24px ${overallColor}20`,
            }}
          >
            <ScoreIcon score={overall} className="h-6 w-6 transition-colors duration-700" style={{ color: overallColor }} />
          </div>
          <span className="text-lg font-bold tabular-nums leading-none" style={{ color: overallColor }} data-testid="text-sentiment-score">
            {overall > 0 ? "+" : ""}{overall}
          </span>
          <span className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: overallColor }}>
            {scoreToLabel(overall)}
          </span>
        </div>

        <div className="flex-1 flex flex-col gap-2 min-w-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <Activity className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-[11px] font-medium text-muted-foreground">
                {data.length} reading{data.length !== 1 ? "s" : ""}
              </span>
            </div>
            {data.length >= 2 && (
              <div className="flex items-center gap-1 text-[11px] font-medium">
                {trend > 5 ? (
                  <>
                    <TrendingUp className="h-3.5 w-3.5 text-green-500" />
                    <span className="text-green-500">Improving</span>
                  </>
                ) : trend < -5 ? (
                  <>
                    <TrendingDown className="h-3.5 w-3.5 text-red-500" />
                    <span className="text-red-500">Declining</span>
                  </>
                ) : (
                  <>
                    <Minus className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="text-muted-foreground">Stable</span>
                  </>
                )}
              </div>
            )}
          </div>

          <TooltipProvider delayDuration={0}>
            <div className="flex items-end gap-[3px] w-full" style={{ height: 72 }}>
              {data.map((point, i) => {
                const height = scoreToHeight(point.score);
                const color = scoreToColor(point.score);
                const isLatest = i === data.length - 1;
                const isHovered = hoveredBar === i;
                const timestamp = formatBarTimestamp(point.chunkIndex, data.length, startMs, durationMs);

                return (
                  <Tooltip key={point.chunkIndex}>
                    <TooltipTrigger asChild>
                      <div
                        className={`flex-1 rounded-sm min-w-[4px] max-w-[16px] transition-all duration-300 ease-out cursor-pointer ${isLatest ? "sentiment-bar-pulse" : ""}`}
                        style={{
                          height: `${height * 100}%`,
                          backgroundColor: color,
                          opacity: isHovered ? 1 : isLatest ? 1 : 0.5 + (i / data.length) * 0.5,
                          boxShadow: isHovered
                            ? `0 0 10px ${color}, 0 0 20px ${color}80`
                            : isLatest ? `0 0 10px ${color}, 0 0 20px ${color}80, 0 -4px 16px ${color}50` : undefined,
                          transform: isHovered ? "scaleX(1.4)" : undefined,
                        }}
                        onMouseEnter={() => setHoveredBar(i)}
                        onMouseLeave={() => setHoveredBar(null)}
                        data-testid={`eq-bar-full-${i}`}
                      />
                    </TooltipTrigger>
                    <TooltipContent side="top" className="text-xs space-y-0.5 max-w-[200px]">
                      <div className="flex items-center gap-1.5">
                        <ScoreIcon score={point.score} className="h-3 w-3 shrink-0" style={{ color }} />
                        <span className="font-medium">{scoreToLabel(point.score)} ({point.score > 0 ? "+" : ""}{point.score})</span>
                      </div>
                      {(point.speaker || timestamp) && (
                        <div className="text-muted-foreground flex items-center gap-1.5">
                          {point.speaker && <span>{point.speaker}</span>}
                          {point.speaker && timestamp && <span>•</span>}
                          {timestamp && <span>{timestamp}</span>}
                        </div>
                      )}
                    </TooltipContent>
                  </Tooltip>
                );
              })}
            </div>
          </TooltipProvider>

          <div className="w-full h-2 rounded-full bg-muted overflow-hidden" data-testid="sentiment-gauge">
            <div
              className="h-full rounded-full transition-all duration-700 ease-out"
              style={{
                width: `${gaugePercent}%`,
                background: `linear-gradient(90deg, #ef4444, #eab308, #22c55e)`,
              }}
            />
          </div>

          {data.some(d => d.speaker) && (
            <div className="flex flex-wrap gap-1">
              {[...new Set(data.map(d => d.speaker).filter(Boolean))].map(speaker => {
                const speakerPoints = data.filter(d => d.speaker === speaker);
                const avgScore = Math.round(speakerPoints.reduce((s, d) => s + d.score, 0) / speakerPoints.length);
                const spkColor = scoreToColor(avgScore);
                return (
                  <span
                    key={speaker}
                    className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full border font-medium"
                    style={{ borderColor: `${spkColor}40`, color: spkColor, backgroundColor: `${spkColor}10` }}
                    title={`${speaker}: avg ${avgScore > 0 ? "+" : ""}${avgScore}`}
                  >
                    <ScoreIcon score={avgScore} className="h-2.5 w-2.5" />
                    {speaker}
                  </span>
                );
              })}
            </div>
          )}
        </div>

        {data.length > 0 && (
          <div
            className="flex flex-col items-center justify-center gap-0.5 min-w-[60px] rounded-lg px-2 py-1 transition-colors duration-500"
            style={{ backgroundColor: `${latestColor}15` }}
            data-testid="sentiment-latest"
          >
            <span className="text-[9px] uppercase tracking-wider text-muted-foreground font-medium">Latest</span>
            <span className="text-base font-bold tabular-nums" style={{ color: latestColor }}>
              {latestScore > 0 ? "+" : ""}{latestScore}
            </span>
            <ScoreIcon score={latestScore} className="h-4 w-4" style={{ color: latestColor }} />
          </div>
        )}
      </div>
    </div>
  );
}
