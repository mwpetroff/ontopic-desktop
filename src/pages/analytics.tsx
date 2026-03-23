import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartTooltip,
  LineChart, Line, Legend, ScatterChart, Scatter, ZAxis,
  ResponsiveContainer, Cell,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { TrendingUp, BarChart2, Target, AlertCircle, CheckCircle, Building2, Users } from "lucide-react";

// ---- colour helpers --------------------------------------------------------
const CAP_COLORS: Record<string, string> = {
  "in-house": "#22c55e",
  partner: "#3b82f6",
  unknown: "#f59e0b",
};

const CAP_LABELS: Record<string, string> = {
  "in-house": "In-House",
  partner: "Partner",
  unknown: "Gap",
};

const CATEGORY_COLORS: Record<string, string> = {
  products: "#8b5cf6",
  concepts: "#06b6d4",
  industry: "#f97316",
  general: "#64748b",
};

const CONFIDENCE_COLOR = (c: number) =>
  c >= 0.75 ? "#22c55e" : c >= 0.5 ? "#f59e0b" : "#ef4444";

// ---- date range helpers ----------------------------------------------------
type DateRange = "30d" | "90d" | "365d" | "all";

function toFromTo(range: DateRange): { from?: number; to?: number } {
  if (range === "all") return {};
  const days = range === "30d" ? 30 : range === "90d" ? 90 : 365;
  const from = Date.now() - days * 24 * 60 * 60 * 1000;
  return { from };
}

// ---- types from server -----------------------------------------------------
interface TopicFrequency {
  term: string;
  aliases: string[];
  category: string;
  capabilitySource: string;
  totalMentions: number;
  sessionCount: number;
}

interface TopicTrendRow {
  week: string;
  category: string;
  totalMentions: number;
}

interface GapMatch {
  topicTerm: string;
  aliases: string[];
  category: string;
  totalMentions: number;
  sessionCount: number;
  lastSeen: string;
  bestMatch: {
    name: string;
    source: string;
    type: string;
    partnerName: string | null;
    confidence: number;
  } | null;
}

interface NeedsVsOfferings {
  matched: Array<{
    topicTerm: string;
    aliases: string[];
    category: string;
    capabilitySource: string;
    partnerName: string | null;
    totalMentions: number;
    sessionCount: number;
  }>;
  gaps: GapMatch[];
}

// ---- small components -------------------------------------------------------

function StatCard({ icon: Icon, label, value, sub, color }: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string | number;
  sub?: string;
  color?: string;
}) {
  return (
    <Card>
      <CardContent className="pt-4 pb-3">
        <div className="flex items-start gap-3">
          <div className={`rounded-lg p-2 ${color || "bg-primary/10"}`}>
            <Icon className="h-4 w-4 text-primary" />
          </div>
          <div className="min-w-0">
            <p className="text-2xl font-bold tabular-nums">{value}</p>
            <p className="text-xs text-muted-foreground">{label}</p>
            {sub && <p className="text-[10px] text-muted-foreground mt-0.5">{sub}</p>}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ---- query error helper -----------------------------------------------------

function QueryError({ error, height = 64 }: { error: Error; height?: number }) {
  return (
    <div
      className="flex flex-col items-center justify-center gap-1.5 rounded-md border border-destructive/20 bg-destructive/5 text-center px-4"
      style={{ height }}
    >
      <AlertCircle className="h-4 w-4 text-destructive/70 shrink-0" />
      <p className="text-xs font-medium text-destructive/80">Failed to load data</p>
      <p className="text-[11px] text-muted-foreground max-w-xs">
        {error.message.startsWith("500")
          ? "The server returned an error. Try restarting the app or check the server logs."
          : error.message}
      </p>
    </div>
  );
}

// ---- main page --------------------------------------------------------------

export default function AnalyticsPage() {
  const [dateRange, setDateRange] = useState<DateRange>("90d");
  const [industry, setIndustry] = useState<string>("all");

  const { from, to } = toFromTo(dateRange);
  const params = new URLSearchParams();
  if (from) params.set("from", String(from));
  if (to) params.set("to", String(to));
  if (industry && industry !== "all") params.set("industry", industry);

  const qs = params.toString() ? `?${params.toString()}` : "";
  const qs2 = from ? `?from=${from}${to ? `&to=${to}` : ""}` : "";

  const fetchJson = async (url: string) => {
    const r = await fetch(url);
    if (!r.ok) throw new Error(`${r.status}: ${r.statusText}`);
    return r.json();
  };

  const { data: freqData, isLoading: freqLoading, error: freqError } = useQuery<TopicFrequency[]>({
    queryKey: ["/api/analytics/topic-frequency", dateRange, industry],
    queryFn: () => fetchJson(`/api/analytics/topic-frequency${qs}&limit=20`),
  });

  const { data: trendsData, isLoading: trendsLoading, error: trendsError } = useQuery<TopicTrendRow[]>({
    queryKey: ["/api/analytics/topic-trends", dateRange],
    queryFn: () => fetchJson(`/api/analytics/topic-trends${qs2}`),
  });

  const { data: nvo, isLoading: nvoLoading, error: nvoError } = useQuery<NeedsVsOfferings>({
    queryKey: ["/api/analytics/needs-vs-offerings"],
  });

  const { data: industries } = useQuery<string[]>({
    queryKey: ["/api/analytics/industries"],
  });

  // Pivot trends data: [{week, products, concepts, industry, general}]
  const pivotedTrends = useMemo(() => {
    if (!trendsData) return [];
    const map = new Map<string, Record<string, number>>();
    for (const row of trendsData) {
      const entry = map.get(row.week) || {};
      entry[row.category] = (entry[row.category] || 0) + row.totalMentions;
      map.set(row.week, entry);
    }
    return [...map.entries()]
      .map(([week, cats]) => ({ week, ...cats }))
      .sort((a, b) => a.week.localeCompare(b.week));
  }, [trendsData]);

  const trendCategories = useMemo(() => {
    if (!trendsData) return [];
    return [...new Set(trendsData.map((r) => r.category))];
  }, [trendsData]);

  // Summary stats
  const totalMentions = freqData?.reduce((s, r) => s + r.totalMentions, 0) ?? 0;
  const gapCount = nvo?.gaps.length ?? 0;
  const matchedCount = nvo?.matched.length ?? 0;
  const highConfidenceGaps = nvo?.gaps.filter((g) => g.bestMatch && g.bestMatch.confidence >= 0.6).length ?? 0;

  // Gap scatter data
  const gapScatterData = useMemo(() => {
    if (!nvo?.gaps) return [];
    return nvo.gaps.map((g) => ({
      x: g.sessionCount,
      y: g.totalMentions,
      z: g.bestMatch ? Math.round(g.bestMatch.confidence * 100) : 0,
      term: g.topicTerm,
      match: g.bestMatch?.name || "No match",
      confidence: g.bestMatch?.confidence ?? 0,
    }));
  }, [nvo?.gaps]);

  return (
    <div className="h-full overflow-y-auto bg-background">
      <div className="max-w-7xl mx-auto p-4 space-y-5">

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
          <div>
            <h1 className="text-xl font-bold flex items-center gap-2">
              <BarChart2 className="h-5 w-5 text-primary" />
              Intelligence Dashboard
            </h1>
            <p className="text-sm text-muted-foreground">Trends, needs, and offering gaps across all calls</p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Select value={dateRange} onValueChange={(v) => setDateRange(v as DateRange)}>
              <SelectTrigger className="w-36 h-8 text-xs" data-testid="select-date-range">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="30d">Last 30 days</SelectItem>
                <SelectItem value="90d">Last 90 days</SelectItem>
                <SelectItem value="365d">Last 12 months</SelectItem>
                <SelectItem value="all">All time</SelectItem>
              </SelectContent>
            </Select>
            {industries && industries.length > 0 && (
              <Select value={industry} onValueChange={setIndustry}>
                <SelectTrigger className="w-40 h-8 text-xs" data-testid="select-industry">
                  <SelectValue placeholder="All industries" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All industries</SelectItem>
                  {industries.map((ind) => (
                    <SelectItem key={ind} value={ind}>{ind}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
        </div>

        {/* Summary cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatCard icon={TrendingUp} label="Total mentions" value={totalMentions} />
          <StatCard icon={CheckCircle} label="Matched topics" value={matchedCount} sub="in-house or partner" />
          <StatCard icon={AlertCircle} label="Offering gaps" value={gapCount} sub="no capability match" />
          <StatCard icon={Target} label="Matchable gaps" value={highConfidenceGaps} sub="≥60% confidence" />
        </div>

        {/* Row 1: frequency + trends */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

          {/* Topic Frequency */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <BarChart2 className="h-4 w-4" /> Top Topics by Mention
              </CardTitle>
              <CardDescription className="text-xs">Colored by capability coverage</CardDescription>
            </CardHeader>
            <CardContent>
              {freqLoading ? (
                <Skeleton className="h-64 w-full" />
              ) : freqError ? (
                <QueryError error={freqError as Error} height={256} />
              ) : !freqData?.length ? (
                <div className="h-64 flex items-center justify-center text-sm text-muted-foreground">No data for this period</div>
              ) : (
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={freqData} layout="vertical" margin={{ left: 8, right: 16, top: 4, bottom: 4 }}>
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                    <XAxis type="number" tick={{ fontSize: 10 }} />
                    <YAxis type="category" dataKey="term" tick={{ fontSize: 10 }} width={110} />
                    <RechartTooltip
                      contentStyle={{ fontSize: 11 }}
                      formatter={(val, _, props) => [
                        `${val} mentions (${props.payload.sessionCount} sessions)`,
                        CAP_LABELS[props.payload.capabilitySource] || props.payload.capabilitySource,
                      ]}
                    />
                    <Bar dataKey="totalMentions" radius={[0, 3, 3, 0]}>
                      {freqData.map((entry, i) => (
                        <Cell key={i} fill={CAP_COLORS[entry.capabilitySource] || "#94a3b8"} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
              <div className="flex items-center gap-3 mt-2 flex-wrap">
                {Object.entries(CAP_LABELS).map(([k, v]) => (
                  <span key={k} className="flex items-center gap-1 text-[10px]">
                    <span className="w-2 h-2 rounded-full" style={{ background: CAP_COLORS[k] }} />
                    {v}
                  </span>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Topic Trends */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <TrendingUp className="h-4 w-4" /> Topic Trends Over Time
              </CardTitle>
              <CardDescription className="text-xs">Weekly mention counts by category</CardDescription>
            </CardHeader>
            <CardContent>
              {trendsLoading ? (
                <Skeleton className="h-64 w-full" />
              ) : trendsError ? (
                <QueryError error={trendsError as Error} height={256} />
              ) : !pivotedTrends.length ? (
                <div className="h-64 flex items-center justify-center text-sm text-muted-foreground">No data for this period</div>
              ) : (
                <ResponsiveContainer width="100%" height={280}>
                  <LineChart data={pivotedTrends} margin={{ left: 0, right: 8, top: 4, bottom: 4 }}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="week" tick={{ fontSize: 9 }} tickFormatter={(d) => d.slice(5)} />
                    <YAxis tick={{ fontSize: 10 }} />
                    <RechartTooltip contentStyle={{ fontSize: 11 }} />
                    <Legend wrapperStyle={{ fontSize: 10 }} />
                    {trendCategories.map((cat) => (
                      <Line
                        key={cat}
                        type="monotone"
                        dataKey={cat}
                        stroke={CATEGORY_COLORS[cat] || "#94a3b8"}
                        dot={false}
                        strokeWidth={2}
                      />
                    ))}
                  </LineChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Row 2: Needs vs Offerings */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Target className="h-4 w-4" /> Needs vs. Offerings
            </CardTitle>
            <CardDescription className="text-xs">
              Client asks mapped to your catalog — gaps auto-matched with confidence scoring
            </CardDescription>
          </CardHeader>
          <CardContent>
            {nvoLoading ? (
              <Skeleton className="h-48 w-full" />
            ) : nvoError ? (
              <QueryError error={nvoError as Error} height={192} />
            ) : (
              <Tabs defaultValue="gaps">
                <TabsList className="h-7 text-xs mb-3">
                  <TabsTrigger value="gaps" className="text-xs" data-testid="tab-gaps">
                    Gaps ({nvo?.gaps.length ?? 0})
                  </TabsTrigger>
                  <TabsTrigger value="matched" className="text-xs" data-testid="tab-matched">
                    Matched ({nvo?.matched.length ?? 0})
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="gaps">
                  {!nvo?.gaps.length ? (
                    <p className="text-sm text-muted-foreground py-4 text-center">No gaps found — all topics are covered!</p>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="border-b text-muted-foreground">
                            <th className="text-left py-1.5 pr-3 font-medium">Client Ask</th>
                            <th className="text-left py-1.5 pr-3 font-medium">Category</th>
                            <th className="text-right py-1.5 pr-3 font-medium">Mentions</th>
                            <th className="text-right py-1.5 pr-3 font-medium">Sessions</th>
                            <th className="text-left py-1.5 pr-3 font-medium">Closest Offering</th>
                            <th className="text-right py-1.5 font-medium">Confidence</th>
                          </tr>
                        </thead>
                        <tbody>
                          {nvo.gaps.map((gap, i) => (
                            <tr key={i} className="border-b last:border-0 hover:bg-muted/30" data-testid={`row-gap-${i}`}>
                              <td className="py-1.5 pr-3">
                                <span className="font-medium">{gap.topicTerm}</span>
                                {gap.aliases?.length > 0 && (
                                  <p className="text-[10px] text-muted-foreground mt-0.5 leading-tight">
                                    also: {gap.aliases.join(", ")}
                                  </p>
                                )}
                              </td>
                              <td className="py-1.5 pr-3 text-muted-foreground capitalize">{gap.category}</td>
                              <td className="py-1.5 pr-3 text-right tabular-nums">{gap.totalMentions}</td>
                              <td className="py-1.5 pr-3 text-right tabular-nums">{gap.sessionCount}</td>
                              <td className="py-1.5 pr-3">
                                {gap.bestMatch ? (
                                  <span className="flex items-center gap-1">
                                    {gap.bestMatch.source === "partner" ? (
                                      <Building2 className="h-3 w-3 text-blue-500" />
                                    ) : (
                                      <Users className="h-3 w-3 text-green-500" />
                                    )}
                                    {gap.bestMatch.name}
                                    {gap.bestMatch.partnerName && (
                                      <span className="text-muted-foreground">({gap.bestMatch.partnerName})</span>
                                    )}
                                  </span>
                                ) : (
                                  <span className="text-muted-foreground italic">No match found</span>
                                )}
                              </td>
                              <td className="py-1.5 text-right">
                                {gap.bestMatch ? (
                                  <Badge
                                    variant="outline"
                                    className="text-[10px] px-1.5"
                                    style={{ borderColor: CONFIDENCE_COLOR(gap.bestMatch.confidence), color: CONFIDENCE_COLOR(gap.bestMatch.confidence) }}
                                  >
                                    {Math.round(gap.bestMatch.confidence * 100)}%
                                  </Badge>
                                ) : (
                                  <span className="text-muted-foreground">—</span>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </TabsContent>

                <TabsContent value="matched">
                  {!nvo?.matched.length ? (
                    <p className="text-sm text-muted-foreground py-4 text-center">No matched topics yet</p>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="border-b text-muted-foreground">
                            <th className="text-left py-1.5 pr-3 font-medium">Topic</th>
                            <th className="text-left py-1.5 pr-3 font-medium">Category</th>
                            <th className="text-left py-1.5 pr-3 font-medium">Coverage</th>
                            <th className="text-right py-1.5 pr-3 font-medium">Mentions</th>
                            <th className="text-right py-1.5 font-medium">Sessions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {nvo.matched.map((m, i) => (
                            <tr key={i} className="border-b last:border-0 hover:bg-muted/30" data-testid={`row-matched-${i}`}>
                              <td className="py-1.5 pr-3">
                                <span className="font-medium">{m.topicTerm}</span>
                                {m.aliases?.length > 0 && (
                                  <p className="text-[10px] text-muted-foreground mt-0.5 leading-tight">
                                    also: {m.aliases.join(", ")}
                                  </p>
                                )}
                              </td>
                              <td className="py-1.5 pr-3 text-muted-foreground capitalize">{m.category}</td>
                              <td className="py-1.5 pr-3">
                                <Badge
                                  variant="outline"
                                  className="text-[10px]"
                                  style={{ borderColor: CAP_COLORS[m.capabilitySource], color: CAP_COLORS[m.capabilitySource] }}
                                >
                                  {CAP_LABELS[m.capabilitySource]}
                                  {m.partnerName && ` · ${m.partnerName}`}
                                </Badge>
                              </td>
                              <td className="py-1.5 pr-3 text-right tabular-nums">{m.totalMentions}</td>
                              <td className="py-1.5 text-right tabular-nums">{m.sessionCount}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </TabsContent>
              </Tabs>
            )}
          </CardContent>
        </Card>

        {/* Row 3: Gap Radar */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <AlertCircle className="h-4 w-4" /> Gap Radar
            </CardTitle>
            <CardDescription className="text-xs">
              Unmatched client asks plotted by frequency and breadth — bubble color = match confidence
            </CardDescription>
          </CardHeader>
          <CardContent>
            {nvoLoading ? (
              <Skeleton className="h-64 w-full" />
            ) : nvoError ? (
              <QueryError error={nvoError as Error} height={192} />
            ) : !gapScatterData.length ? (
              <div className="h-48 flex items-center justify-center text-sm text-muted-foreground">
                No offering gaps detected
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <ScatterChart margin={{ left: 16, right: 24, top: 12, bottom: 24 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis
                    type="number"
                    dataKey="x"
                    name="Sessions"
                    label={{ value: "# Sessions", position: "insideBottom", offset: -10, fontSize: 10 }}
                    tick={{ fontSize: 10 }}
                  />
                  <YAxis
                    type="number"
                    dataKey="y"
                    name="Mentions"
                    label={{ value: "Mentions", angle: -90, position: "insideLeft", fontSize: 10 }}
                    tick={{ fontSize: 10 }}
                  />
                  <ZAxis type="number" dataKey="z" range={[40, 200]} name="Confidence" />
                  <RechartTooltip
                    contentStyle={{ fontSize: 11 }}
                    content={({ payload }) => {
                      if (!payload?.length) return null;
                      const d = payload[0].payload;
                      return (
                        <div className="bg-popover border rounded-lg p-2 shadow-md text-xs space-y-0.5">
                          <p className="font-semibold">{d.term}</p>
                          <p className="text-muted-foreground">{d.y} mentions across {d.x} sessions</p>
                          {d.match !== "No match" && (
                            <p>Best match: <span className="font-medium">{d.match}</span></p>
                          )}
                          {d.confidence > 0 && (
                            <p>Confidence: <span style={{ color: CONFIDENCE_COLOR(d.confidence) }}>{Math.round(d.confidence * 100)}%</span></p>
                          )}
                        </div>
                      );
                    }}
                  />
                  <Scatter data={gapScatterData} name="Gaps">
                    {gapScatterData.map((entry, i) => (
                      <Cell key={i} fill={CONFIDENCE_COLOR(entry.confidence)} opacity={0.8} />
                    ))}
                  </Scatter>
                </ScatterChart>
              </ResponsiveContainer>
            )}
            <div className="flex items-center gap-4 mt-1 flex-wrap">
              <span className="text-[10px] text-muted-foreground">Bubble size = match confidence strength</span>
              <span className="flex items-center gap-1 text-[10px]"><span className="w-2 h-2 rounded-full bg-green-500" /> ≥75% confident</span>
              <span className="flex items-center gap-1 text-[10px]"><span className="w-2 h-2 rounded-full bg-amber-500" /> 50–74%</span>
              <span className="flex items-center gap-1 text-[10px]"><span className="w-2 h-2 rounded-full bg-red-500" /> &lt;50% / no match</span>
            </div>
          </CardContent>
        </Card>

      </div>
    </div>
  );
}
