import { useMemo, useState } from "react";
import { useParams, Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  Handle,
  Position,
  type Node,
  type Edge,
  type NodeProps,
  ReactFlowProvider,
  MarkerType,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ArrowLeft,
  Mic2,
  Lightbulb,
  CheckSquare,
  Radio,
  AlertCircle,
  Layers,
  Network,
} from "lucide-react";

// ---- types ------------------------------------------------------------------

interface GraphNode {
  id: string;
  nodeType: "session" | "speaker" | "topic" | "action";
  label: string;
  meta: Record<string, string | number | boolean | null | undefined>;
}

interface GraphEdge {
  id: string;
  source: string;
  target: string;
  label?: string;
}

// ---- colour helpers ---------------------------------------------------------

const CAP_COLORS: Record<string, { bg: string; border: string; text: string; dot: string }> = {
  "in-house": {
    bg: "bg-green-500/10",
    border: "border-green-500",
    text: "text-green-700 dark:text-green-400",
    dot: "bg-green-500",
  },
  partner: {
    bg: "bg-blue-500/10",
    border: "border-blue-500",
    text: "text-blue-700 dark:text-blue-400",
    dot: "bg-blue-500",
  },
  unknown: {
    bg: "bg-amber-500/10",
    border: "border-amber-500",
    text: "text-amber-700 dark:text-amber-400",
    dot: "bg-amber-500",
  },
};

const CAP_LABELS: Record<string, string> = {
  "in-house": "In-House",
  partner: "Partner",
  unknown: "Gap",
};

const PRIORITY_COLORS: Record<string, string> = {
  high: "border-red-500 bg-red-500/10",
  medium: "border-amber-500 bg-amber-500/10",
  low: "border-slate-400 bg-slate-400/10",
};

// ---- bubble view ------------------------------------------------------------

function bubbleSize(mentions: number): number {
  return Math.max(44, Math.min(84, 44 + Math.sqrt(Math.max(0, mentions - 1)) * 10));
}

function BubbleView({ data }: { data: { nodes: GraphNode[]; edges: GraphEdge[] } }) {
  const [hovered, setHovered] = useState<string | null>(null);

  const topicNodes = data.nodes.filter((n) => n.nodeType === "topic");
  const speakerNodes = data.nodes.filter((n) => n.nodeType === "speaker");
  const actionNodes = data.nodes.filter((n) => n.nodeType === "action");

  // Build speaker→topic attribution from edges
  const speakerTopics = useMemo(() => {
    const map = new Map<string, Set<string>>(); // topicId → Set<speakerLabel>
    for (const e of data.edges) {
      if (e.source.startsWith("speaker-") && e.target.startsWith("topic-")) {
        const label = e.source.replace("speaker-", "");
        if (!map.has(e.target)) map.set(e.target, new Set());
        map.get(e.target)!.add(label);
      }
    }
    return map;
  }, [data.edges]);

  // Group topics by category, sorted by total mentions desc
  const categories = useMemo(() => {
    const byCategory = new Map<string, GraphNode[]>();
    for (const t of topicNodes) {
      const cat = (t.meta.category as string) || "other";
      if (!byCategory.has(cat)) byCategory.set(cat, []);
      byCategory.get(cat)!.push(t);
    }
    return [...byCategory.entries()]
      .map(([cat, nodes]) => ({
        cat,
        nodes: [...nodes].sort(
          (a, b) => ((b.meta.mentionCount as number) || 0) - ((a.meta.mentionCount as number) || 0)
        ),
        total: nodes.reduce((s, n) => s + ((n.meta.mentionCount as number) || 1), 0),
      }))
      .sort((a, b) => b.total - a.total);
  }, [topicNodes]);

  if (topicNodes.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3 text-muted-foreground">
        <Lightbulb className="h-8 w-8" />
        <p className="text-sm">No topics found for this session</p>
      </div>
    );
  }

  return (
    <div className="h-full overflow-auto p-4 space-y-4">

      {/* Speaker strip */}
      {speakerNodes.length > 0 && (
        <div className="flex flex-wrap gap-2 items-center">
          <span className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wide mr-1">Speakers</span>
          {speakerNodes.map((sp) => (
            <div
              key={sp.id}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-medium ${
                sp.meta.role === "host"
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border bg-muted/40 text-muted-foreground"
              }`}
            >
              <Mic2 className="h-2.5 w-2.5 shrink-0" />
              {sp.label}
              {sp.meta.role && (
                <span className="text-[9px] uppercase font-bold opacity-60">{sp.meta.role}</span>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Category pods */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3">
        {categories.map(({ cat, nodes, total }) => (
          <div
            key={cat}
            className="rounded-xl border border-border bg-muted/20 p-3 flex flex-col gap-2"
          >
            {/* Category header */}
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground capitalize">
                {cat}
              </span>
              <span className="text-[9px] text-muted-foreground">{total} mentions</span>
            </div>

            {/* Bubbles */}
            <div className="flex flex-wrap gap-2 items-end justify-center min-h-[60px]">
              {nodes.map((node) => {
                const mentions = (node.meta.mentionCount as number) || 1;
                const size = bubbleSize(mentions);
                const cap = (node.meta.capabilitySource as string) || "unknown";
                const colors = CAP_COLORS[cap] || CAP_COLORS["unknown"];
                const aliases = node.meta.aliases as string | undefined;
                const aliasArr = aliases ? aliases.split(", ").filter(Boolean) : [];
                const speakers = speakerTopics.get(node.id);
                const isHovered = hovered === node.id;

                return (
                  <div key={node.id} className="relative flex flex-col items-center gap-1">
                    {/* Tooltip */}
                    {isHovered && (
                      <div className="absolute bottom-full mb-1.5 left-1/2 -translate-x-1/2 z-10 w-max max-w-[200px] rounded-lg border border-border bg-popover text-popover-foreground shadow-lg px-3 py-2 pointer-events-none">
                        <p className="text-xs font-semibold leading-snug">{node.label}</p>
                        {aliasArr.length > 0 && (
                          <p className="text-[10px] text-muted-foreground mt-0.5">
                            also: {aliasArr.join(", ")}
                          </p>
                        )}
                        <div className="flex items-center gap-2 mt-1.5">
                          <span className={`text-[10px] font-bold ${colors.text}`}>
                            {CAP_LABELS[cap]}
                          </span>
                          <span className="text-[10px] text-muted-foreground">
                            ×{mentions} mention{mentions !== 1 ? "s" : ""}
                          </span>
                        </div>
                        {speakers && speakers.size > 0 && (
                          <p className="text-[10px] text-muted-foreground mt-0.5">
                            by: {[...speakers].join(", ")}
                          </p>
                        )}
                      </div>
                    )}

                    {/* Circle */}
                    <div
                      onMouseEnter={() => setHovered(node.id)}
                      onMouseLeave={() => setHovered(null)}
                      style={{ width: size, height: size }}
                      className={`rounded-full flex items-center justify-center text-center cursor-default select-none border-2 transition-all duration-150 ${colors.bg} ${colors.border} ${
                        isHovered ? "scale-110 shadow-md" : ""
                      }`}
                    >
                      <span
                        className={`text-[8px] leading-tight font-semibold px-1 ${colors.text}`}
                        style={{ fontSize: Math.max(7, Math.min(10, size / 7)) }}
                      >
                        {node.label.length > 14 ? node.label.slice(0, 13) + "…" : node.label}
                      </span>
                    </div>

                    {/* Mention count dot for largest bubbles */}
                    {mentions > 2 && (
                      <span className="text-[8px] text-muted-foreground tabular-nums">×{mentions}</span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Action items */}
      {actionNodes.length > 0 && (
        <div>
          <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-2">
            Action Items
          </p>
          <div className="flex flex-wrap gap-2">
            {actionNodes.map((ac) => {
              const priority = (ac.meta.priority as string || "").toLowerCase();
              const pClass = PRIORITY_COLORS[priority] || PRIORITY_COLORS.low;
              return (
                <div
                  key={ac.id}
                  className={`rounded-lg border px-2.5 py-1.5 text-xs max-w-[280px] ${pClass}`}
                >
                  <div className="flex items-start gap-1.5">
                    <CheckSquare className="h-3 w-3 mt-0.5 text-muted-foreground shrink-0" />
                    <span className="leading-snug">{ac.label}</span>
                  </div>
                  {ac.meta.assignee && (
                    <p className="text-[10px] text-muted-foreground mt-0.5 pl-4">→ {ac.meta.assignee}</p>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ---- network graph node components ------------------------------------------

function SessionNode({ data }: NodeProps) {
  const d = data as { label: string; clientName?: string; industry?: string; totalTopics?: number };
  return (
    <div className="rounded-xl border-2 border-primary bg-primary/10 px-4 py-2.5 shadow-md min-w-[160px] text-center">
      <Handle type="source" position={Position.Bottom} className="!bg-primary" />
      <div className="flex items-center gap-1.5 justify-center mb-0.5">
        <Radio className="h-3.5 w-3.5 text-primary" />
        <span className="text-xs font-bold text-primary truncate max-w-[160px]">{d.label}</span>
      </div>
      {d.clientName && <p className="text-[9px] text-muted-foreground">{d.clientName}</p>}
      {d.industry && <p className="text-[9px] text-muted-foreground">{d.industry}</p>}
      {d.totalTopics !== undefined && (
        <p className="text-[9px] text-muted-foreground mt-0.5">{d.totalTopics} topics</p>
      )}
    </div>
  );
}

function SpeakerNode({ data }: NodeProps) {
  const d = data as { label: string; title?: string; role?: string };
  return (
    <div className={`rounded-lg border-2 px-3 py-2 shadow-sm min-w-[120px] text-center ${
      d.role === "host" ? "border-primary bg-primary/5" : "border-border bg-muted/30"
    }`}>
      <Handle type="target" position={Position.Top} />
      <Handle type="source" position={Position.Bottom} />
      <Handle type="source" position={Position.Right} id="right" />
      <div className="flex items-center gap-1 justify-center">
        <Mic2 className="h-3 w-3 text-muted-foreground shrink-0" />
        <span className="text-[11px] font-semibold truncate max-w-[120px]">{d.label}</span>
      </div>
      {d.title && <p className="text-[9px] text-muted-foreground mt-0.5 truncate max-w-[120px]">{d.title}</p>}
      {d.role && (
        <span className={`inline-block text-[8px] font-bold uppercase tracking-wide mt-0.5 px-1.5 py-0.5 rounded ${
          d.role === "host" ? "bg-primary/20 text-primary" : "bg-muted text-muted-foreground"
        }`}>{d.role}</span>
      )}
    </div>
  );
}

function TopicNode({ data }: NodeProps) {
  const d = data as { label: string; category?: string; capabilitySource?: string; mentionCount?: number; aliases?: string };
  const cap = d.capabilitySource || "unknown";
  const colors = CAP_COLORS[cap] || CAP_COLORS["unknown"];
  const aliasArr = d.aliases ? d.aliases.split(", ").filter(Boolean) : [];
  return (
    <div className={`rounded-md border px-2.5 py-1.5 shadow-sm max-w-[180px] text-center ${colors.bg} ${colors.border}`}>
      <Handle type="target" position={Position.Left} />
      <div className="flex items-center gap-1 justify-center">
        <Lightbulb className={`h-3 w-3 shrink-0 ${colors.text}`} />
        <span className="text-[10px] font-medium leading-tight">{d.label}</span>
      </div>
      {aliasArr.length > 0 && (
        <p className="text-[7px] text-muted-foreground mt-0.5 leading-tight italic line-clamp-1">
          {aliasArr.join(" · ")}
        </p>
      )}
      <div className="flex items-center gap-1 justify-center mt-0.5 flex-wrap">
        {d.capabilitySource && (
          <span className={`text-[8px] font-bold ${colors.text}`}>{CAP_LABELS[cap]}</span>
        )}
        {d.mentionCount !== undefined && d.mentionCount > 1 && (
          <span className="text-[8px] text-muted-foreground">×{d.mentionCount}</span>
        )}
      </div>
    </div>
  );
}

function ActionNode({ data }: NodeProps) {
  const d = data as { label: string; assignee?: string; priority?: string };
  const pClass = PRIORITY_COLORS[d.priority?.toLowerCase() || ""] || PRIORITY_COLORS.low;
  return (
    <div className={`rounded-md border px-2.5 py-1.5 shadow-sm max-w-[180px] ${pClass}`}>
      <Handle type="target" position={Position.Left} />
      <div className="flex items-start gap-1">
        <CheckSquare className="h-3 w-3 mt-0.5 text-muted-foreground shrink-0" />
        <span className="text-[10px] leading-tight line-clamp-3">{d.label}</span>
      </div>
      {d.assignee && (
        <p className="text-[8px] text-muted-foreground mt-0.5 truncate">→ {d.assignee}</p>
      )}
      {d.priority && (
        <span className="text-[8px] uppercase font-bold text-muted-foreground">{d.priority}</span>
      )}
    </div>
  );
}

const nodeTypes = {
  session: SessionNode,
  speaker: SpeakerNode,
  topic: TopicNode,
  action: ActionNode,
};

// ---- layout engine ----------------------------------------------------------

const NODE_WIDTH = 160;
const NODE_HEIGHT = 60;
const H_GAP = 40;
const V_GAP = 50;

function buildLayout(
  rawNodes: GraphNode[],
  rawEdges: GraphEdge[]
): { nodes: Node[]; edges: Edge[] } {
  const positioned: Node[] = [];
  const CANVAS_CENTER_X = 600;

  const sessionNode = rawNodes.find((n) => n.nodeType === "session");
  const speakers = rawNodes.filter((n) => n.nodeType === "speaker");
  const topicsAll = rawNodes.filter((n) => n.nodeType === "topic");
  const actions = rawNodes.filter((n) => n.nodeType === "action");

  const topicsInHouse = topicsAll.filter((n) => n.meta.capabilitySource === "in-house");
  const topicsPartner = topicsAll.filter((n) => n.meta.capabilitySource === "partner");
  const topicsUnknown = topicsAll.filter((n) => n.meta.capabilitySource === "unknown");

  // Session node
  if (sessionNode) {
    positioned.push({
      id: sessionNode.id,
      type: "session",
      position: { x: CANVAS_CENTER_X - NODE_WIDTH / 2, y: 0 },
      data: { label: sessionNode.label, ...sessionNode.meta },
    });
  }

  // Speaker nodes
  const speakerY = NODE_HEIGHT + V_GAP;
  const speakerTotalW = speakers.length * NODE_WIDTH + (speakers.length - 1) * H_GAP;
  const speakerStartX = CANVAS_CENTER_X - speakerTotalW / 2;
  speakers.forEach((sp, i) => {
    positioned.push({
      id: sp.id,
      type: "speaker",
      position: { x: speakerStartX + i * (NODE_WIDTH + H_GAP), y: speakerY },
      data: { label: sp.label, ...sp.meta },
    });
  });

  // Topic columns
  const topicStartY = speakerY + NODE_HEIGHT + V_GAP + 20;
  const COL_W = NODE_WIDTH + H_GAP;

  function layoutColumn(nodes: GraphNode[], colX: number, startY: number) {
    nodes.forEach((n, i) => {
      positioned.push({
        id: n.id,
        type: "topic",
        position: { x: colX, y: startY + i * (NODE_HEIGHT + V_GAP / 2) },
        data: { label: n.label, ...n.meta },
      });
    });
    return startY + nodes.length * (NODE_HEIGHT + V_GAP / 2);
  }

  const colCount = [topicsInHouse, topicsPartner, topicsUnknown].filter((c) => c.length).length || 1;
  const topicsBlock = colCount * COL_W + (colCount - 1) * H_GAP;
  let topicBlockX = CANVAS_CENTER_X - topicsBlock / 2;

  let maxTopicY = topicStartY;
  if (topicsInHouse.length) {
    const endY = layoutColumn(topicsInHouse, topicBlockX, topicStartY);
    maxTopicY = Math.max(maxTopicY, endY);
    topicBlockX += COL_W + H_GAP;
  }
  if (topicsPartner.length) {
    const endY = layoutColumn(topicsPartner, topicBlockX, topicStartY);
    maxTopicY = Math.max(maxTopicY, endY);
    topicBlockX += COL_W + H_GAP;
  }
  if (topicsUnknown.length) {
    const endY = layoutColumn(topicsUnknown, topicBlockX, topicStartY);
    maxTopicY = Math.max(maxTopicY, endY);
  }

  if (!topicsInHouse.length && !topicsPartner.length && !topicsUnknown.length && topicsAll.length) {
    const COLS = 4;
    topicsAll.forEach((n, i) => {
      positioned.push({
        id: n.id,
        type: "topic",
        position: {
          x: CANVAS_CENTER_X - (COLS / 2) * COL_W + (i % COLS) * COL_W,
          y: topicStartY + Math.floor(i / COLS) * (NODE_HEIGHT + V_GAP / 2),
        },
        data: { label: n.label, ...n.meta },
      });
    });
  }

  // Action items row at bottom
  const actionY = maxTopicY + V_GAP;
  const actionTotalW = actions.length * NODE_WIDTH + (actions.length - 1) * H_GAP;
  const actionStartX = CANVAS_CENTER_X - actionTotalW / 2;
  actions.forEach((ac, i) => {
    positioned.push({
      id: ac.id,
      type: "action",
      position: { x: actionStartX + i * (NODE_WIDTH + H_GAP), y: actionY },
      data: { label: ac.label, ...ac.meta },
    });
  });

  const edges: Edge[] = rawEdges.map((e) => ({
    id: e.id,
    source: e.source,
    target: e.target,
    label: e.label,
    type: "smoothstep",
    animated: e.label === "assigned",
    markerEnd: { type: MarkerType.ArrowClosed, width: 10, height: 10 },
    style: { strokeWidth: 1.5, opacity: 0.6 },
    labelStyle: { fontSize: 9, fill: "currentColor" },
  }));

  return { nodes: positioned, edges };
}

// ---- inner view (data-aware) ------------------------------------------------

function SessionGraphInner({ sessionId }: { sessionId: number }) {
  const [view, setView] = useState<"bubble" | "network">("bubble");

  const { data, isLoading, isError } = useQuery<{ nodes: GraphNode[]; edges: GraphEdge[] }>({
    queryKey: ["/api/sessions", sessionId, "graph"],
    queryFn: () => fetch(`/api/sessions/${sessionId}/graph`).then((r) => r.json()),
  });

  const { nodes, edges } = useMemo(() => {
    if (!data?.nodes?.length || view !== "network") return { nodes: [], edges: [] };
    return buildLayout(data.nodes, data.edges);
  }, [data, view]);

  if (isLoading) {
    return (
      <div className="flex flex-col h-full">
        <div className="p-4 flex gap-2">
          <Skeleton className="h-7 w-24 rounded-lg" />
          <Skeleton className="h-7 w-24 rounded-lg" />
        </div>
        <div className="flex-1 p-4 grid grid-cols-3 gap-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-40 rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3 text-muted-foreground">
        <AlertCircle className="h-8 w-8" />
        <p className="text-sm">Failed to load session data</p>
      </div>
    );
  }

  if (!data?.nodes?.length) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3 text-muted-foreground">
        <Lightbulb className="h-8 w-8" />
        <p className="text-sm">No data available for this session</p>
        <p className="text-xs">Session must have transcript and topics</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* View toggle */}
      <div className="flex items-center gap-2 px-4 py-2 border-b border-border shrink-0">
        <button
          onClick={() => setView("bubble")}
          className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-medium transition-colors ${
            view === "bubble"
              ? "bg-primary text-primary-foreground"
              : "text-muted-foreground hover:bg-muted"
          }`}
          data-testid="button-view-bubble"
        >
          <Layers className="h-3.5 w-3.5" />
          Bubble View
        </button>
        <button
          onClick={() => setView("network")}
          className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-medium transition-colors ${
            view === "network"
              ? "bg-primary text-primary-foreground"
              : "text-muted-foreground hover:bg-muted"
          }`}
          data-testid="button-view-network"
        >
          <Network className="h-3.5 w-3.5" />
          Network Graph
        </button>

        {/* Legend (bubble view only) */}
        {view === "bubble" && (
          <div className="ml-auto flex items-center gap-3 flex-wrap">
            {[
              { dot: "bg-green-500", label: "In-House" },
              { dot: "bg-blue-500", label: "Partner" },
              { dot: "bg-amber-500", label: "Gap" },
            ].map((item) => (
              <span key={item.label} className="flex items-center gap-1 text-[10px] text-muted-foreground">
                <span className={`w-2 h-2 rounded-full ${item.dot}`} />
                {item.label}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 min-h-0">
        {view === "bubble" ? (
          <BubbleView data={data} />
        ) : (
          <ReactFlow
            nodes={nodes}
            edges={edges}
            nodeTypes={nodeTypes}
            fitView
            fitViewOptions={{ padding: 0.2 }}
            minZoom={0.2}
            maxZoom={2}
            proOptions={{ hideAttribution: true }}
            data-testid="session-graph-canvas"
          >
            <Background gap={20} size={1} />
            <Controls position="bottom-right" />
            <MiniMap
              position="bottom-left"
              nodeColor={(n) => {
                if (n.type === "session") return "#8b5cf6";
                if (n.type === "speaker") return "#64748b";
                if (n.type === "action") return "#f97316";
                const cap = (n.data as Record<string, unknown>).capabilitySource as string;
                return cap === "in-house" ? "#22c55e" : cap === "partner" ? "#3b82f6" : "#f59e0b";
              }}
              style={{ height: 80 }}
            />
          </ReactFlow>
        )}
      </div>
    </div>
  );
}

// ---- page wrapper -----------------------------------------------------------

export default function SessionGraphPage() {
  const params = useParams<{ id: string }>();
  const sessionId = parseInt(params.id || "", 10);

  const { data: sessionInfo } = useQuery<{ id: number; title: string; clientName?: string }>({
    queryKey: ["/api/sessions", sessionId],
    queryFn: () => fetch(`/api/sessions/${sessionId}`).then((r) => r.json()),
    enabled: !isNaN(sessionId),
  });

  return (
    <div className="h-full flex flex-col bg-background">
      {/* Header bar */}
      <div className="flex items-center gap-3 px-4 py-2.5 border-b border-border shrink-0">
        <Link href={`/sessions/${sessionId}`}>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 gap-1.5 text-xs"
            data-testid="button-back-to-session"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back
          </Button>
        </Link>
        <div className="h-4 border-l border-border" />
        <div className="min-w-0">
          <h1 className="text-sm font-semibold truncate">
            {sessionInfo?.title ?? `Session #${sessionId}`} — Session Map
          </h1>
          {sessionInfo?.clientName && (
            <p className="text-xs text-muted-foreground">{sessionInfo.clientName}</p>
          )}
        </div>
      </div>

      {/* Inner content with view toggle */}
      <div className="flex-1 min-h-0">
        {isNaN(sessionId) ? (
          <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
            Invalid session ID
          </div>
        ) : (
          <ReactFlowProvider>
            <SessionGraphInner sessionId={sessionId} />
          </ReactFlowProvider>
        )}
      </div>
    </div>
  );
}
