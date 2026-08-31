import { useEffect, useRef, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useParams, Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { TopicCard } from "@/components/topic-card";
import { HighlightedTranscript } from "@/components/highlighted-transcript";
import { SentimentBadge } from "@/components/sentiment-indicator";
import { SentimentEqualizerFull } from "@/components/sentiment-equalizer";
import { ActionItemsPanel } from "@/components/action-items-panel";
import { FollowUpQuestionsPanel } from "@/components/follow-up-questions-panel";
import { ArrowLeft, Clock, Tag, BookOpen, FileText, ClipboardList, HelpCircle, Building2, Sparkles, Loader2, Wrench, Lightbulb, Factory, Download, Users, FolderOpen, BarChart3, Mic, ChevronDown, Network, Briefcase, DollarSign, UserCheck, Target, CheckCircle2, CloudUpload, FileJson, Pencil, Check, X, Workflow } from "lucide-react";
import { Input } from "@/components/ui/input";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { getSpeakerColorByIndex } from "@/lib/speaker-colors";
import { exportSessionPdf, exportSessionJson } from "@/lib/export-pdf";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useSession } from "@/hooks/use-sessions";
import type { Session, Topic, SentimentEntry, ActionItem, FollowUpQuestion, SpeakerEntry, BANTData, SIPOCData } from "@shared/schema";
import { consolidateSimilarProjects } from "@shared/schema";
import { formatDate, formatDuration } from "@/lib/date";

type SessionWithTopics = Session & { topics: Topic[] };

const SIPOC_COLUMNS = [
  { key: "suppliers" as keyof Omit<SIPOCData, "lastUpdated">, label: "Suppliers" },
  { key: "inputs" as keyof Omit<SIPOCData, "lastUpdated">, label: "Inputs" },
  { key: "process" as keyof Omit<SIPOCData, "lastUpdated">, label: "Process" },
  { key: "outputs" as keyof Omit<SIPOCData, "lastUpdated">, label: "Outputs" },
  { key: "customers" as keyof Omit<SIPOCData, "lastUpdated">, label: "Customers" },
];

function TopicGroups({ topics, sessionId, sessionStartTime }: { topics: Topic[]; sessionId: number; sessionStartTime?: string | Date }) {
  const tools = topics.filter(t => t.type === "tool");
  const concepts = topics.filter(t => t.type === "concept");
  const industryTerms = topics.filter(t => t.type === "industry");

  const groups = [
    { label: "Products & Brands", icon: <Wrench className="h-4.5 w-4.5 text-blue-500" />, items: tools },
    { label: "Key Concepts", icon: <Lightbulb className="h-4.5 w-4.5 text-amber-500" />, items: concepts },
    { label: "Industry Terms", icon: <Factory className="h-4.5 w-4.5 text-emerald-500" />, items: industryTerms },
  ].filter(g => g.items.length > 0);

  const [closedGroups, setClosedGroups] = useState<Set<string>>(new Set());

  const toggleGroup = (label: string) => {
    setClosedGroups(prev => {
      const next = new Set(prev);
      if (next.has(label)) next.delete(label); else next.add(label);
      return next;
    });
  };

  return (
    <div className="space-y-5">
      {groups.map(({ label, icon, items }) => {
        const isOpen = !closedGroups.has(label);
        return (
        <Collapsible key={label} open={isOpen} onOpenChange={() => toggleGroup(label)}>
          <CollapsibleTrigger className="w-full" data-testid={`toggle-group-${label.toLowerCase().replace(/\s+/g, "-")}`}>
            <div className="flex items-center gap-2 mb-2 cursor-pointer">
              {icon}
              <span className="text-sm font-bold text-foreground">{label}</span>
              <Badge variant="outline" className="text-[9px] h-4 px-1.5">{items.length}</Badge>
              <ChevronDown className={`h-4 w-4 text-muted-foreground ml-auto transition-transform duration-200 ${isOpen ? "rotate-0" : "-rotate-90"}`} />
            </div>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <div className="space-y-1.5">
              {items.map((topic) => (
                <TopicCard key={topic.id} topic={topic} editable sessionId={sessionId} sessionStartTime={sessionStartTime} />
              ))}
            </div>
          </CollapsibleContent>
        </Collapsible>
        );
      })}
    </div>
  );
}

const tabTriggerClass = "h-7 rounded-none border-b-2 border-transparent px-3 text-xs data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none";

export default function SessionDetail() {
  const params = useParams<{ id: string }>();
  const sessionId = parseInt(params.id || "0");
  const { toast } = useToast();

  const { data: session, isLoading } = useSession(sessionId) as { data: SessionWithTopics | undefined; isLoading: boolean };

  const generateSummaryMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/sessions/${sessionId}/generate-summary`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/sessions", sessionId] });
    },
  });

  const [editingSpeaker, setEditingSpeaker] = useState<{ index: number; name: string } | null>(null);

  const renameSpeakerMutation = useMutation({
    mutationFn: async (speakers: SpeakerEntry[]) => {
      const res = await apiRequest("PATCH", `/api/sessions/${sessionId}`, { speakers });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/sessions", sessionId] });
      setEditingSpeaker(null);
    },
  });

  function commitRename() {
    if (!editingSpeaker || !session) return;
    const name = editingSpeaker.name.trim();
    if (!name) { setEditingSpeaker(null); return; }
    const updated = (session.speakers as SpeakerEntry[] || []).map((s, i) =>
      i === editingSpeaker.index ? { ...s, name } : s
    );
    renameSpeakerMutation.mutate(updated);
  }

  const updateSipocMutation = useMutation({
    mutationFn: async (sipocData: SIPOCData) => {
      const res = await apiRequest("PATCH", `/api/sessions/${sessionId}`, { sipocData });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/sessions", sessionId] });
    },
  });

  function removeSipocItem(category: keyof Omit<SIPOCData, "lastUpdated">, index: number) {
    if (!session?.sipocData) return;
    const current = session.sipocData as SIPOCData;
    const updated: SIPOCData = {
      ...current,
      [category]: current[category].filter((_, i) => i !== index),
    };
    updateSipocMutation.mutate(updated);
  }

  const autoGenerateTriggered = useRef(false);
  useEffect(() => {
    if (
      session &&
      !session.summary &&
      session.transcript &&
      session.transcript.length > 50 &&
      session.status === "completed" &&
      !generateSummaryMutation.isPending &&
      !autoGenerateTriggered.current
    ) {
      autoGenerateTriggered.current = true;
      generateSummaryMutation.mutate();
    }
  }, [session, generateSummaryMutation]);

  if (isLoading) {
    return (
      <div className="flex flex-col h-full">
        <div className="border-b border-border p-4">
          <Skeleton className="h-6 w-48" />
        </div>
        <div className="p-4 space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-20 w-full rounded-md" />
          ))}
        </div>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="flex flex-col items-center justify-center h-full">
        <p className="text-muted-foreground">Session not found</p>
        <Link href="/sessions">
          <Button variant="ghost" className="mt-4" data-testid="button-back-to-episodes">Back to Sessions</Button>
        </Link>
      </div>
    );
  }

  const sentimentData = (session.sentimentData || []) as SentimentEntry[];
  const sessionActionItems = (session.actionItems || []) as ActionItem[];
  const sessionFollowUps = (session.followUpQuestions || []) as FollowUpQuestion[];
  const sessionSpeakers = (session.speakers || []) as SpeakerEntry[];
  const rawSimilarProjects = (session.similarProjectMatches || []) as Array<{ projectId: number; relevance: string; title?: string; industry?: string; clientName?: string; projectDate?: string }>;
  const sessionSimilarProjects = consolidateSimilarProjects(rawSimilarProjects);

  const hasActionItems = sessionActionItems.length > 0;
  const hasFollowUps = sessionFollowUps.length > 0;
  const hasSpeakers = sessionSpeakers.length > 0;
  const hasSimilarProjects = sessionSimilarProjects.length > 0;
  const hasSentiment = sentimentData.length > 0;
  const sessionSipoc = (session.sipocData || null) as SIPOCData | null;
  const hasSipoc = !!sessionSipoc && SIPOC_COLUMNS.some(c => sessionSipoc[c.key].length > 0);

  return (
    <div className="flex flex-col h-full">
      <div className="border-b border-border bg-background/80 backdrop-blur-sm shrink-0 z-10">
        <div className="px-4 py-3">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-2 min-w-0">
              <Link href="/sessions">
                <Button size="icon" variant="ghost" className="h-8 w-8 shrink-0" data-testid="button-back">
                  <ArrowLeft className="h-4 w-4" />
                </Button>
              </Link>
              <div className="min-w-0">
                <h1 className="text-base font-semibold truncate" data-testid="text-session-title">
                  {session.title}
                </h1>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <Link href={`/sessions/${session.id}/graph`}>
                <Button size="sm" variant="outline" className="h-8" data-testid="button-view-graph">
                  <Network className="h-3.5 w-3.5 mr-1.5" />
                  Session Map
                </Button>
              </Link>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button size="sm" variant="outline" className="h-8" data-testid="button-export">
                    <Download className="h-3.5 w-3.5 mr-1.5" />
                    Export
                    <ChevronDown className="h-3 w-3 ml-1" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => exportSessionPdf(session)} data-testid="button-export-pdf">
                    <FileText className="h-3.5 w-3.5 mr-2" />
                    Export PDF
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => exportSessionJson(session)} data-testid="button-export-json">
                    <FileJson className="h-3.5 w-3.5 mr-2" />
                    Export JSON
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>

          <div className="flex items-center gap-2 mt-2 ml-10 flex-wrap">
            {session.overallSentiment !== null && session.overallSentiment !== undefined && (
              <SentimentBadge score={session.overallSentiment} />
            )}
            {session.clientName && (
              <span className="flex items-center gap-1 text-xs text-primary font-medium" data-testid="text-client-name">
                <Building2 className="h-3 w-3" />
                {session.clientName}
              </span>
            )}
            {session.industry && (
              <Badge variant="outline" className="text-[11px] h-5 gap-1" data-testid="badge-industry">
                <Factory className="h-3 w-3" />
                {session.industry}
              </Badge>
            )}
            <span className="text-xs text-muted-foreground">
              {formatDate(session.createdAt)}
            </span>
            <span className="flex items-center gap-1 text-xs text-muted-foreground">
              <Clock className="h-3 w-3" />
              {formatDuration(session.createdAt, session.endedAt)}
            </span>
            <Badge variant="secondary" className="text-[11px] h-5 gap-1">
              <Tag className="h-3 w-3" />
              {session.totalTopics} topics
            </Badge>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-hidden flex flex-col">
        <Tabs defaultValue="show-notes" className="flex-1 flex flex-col overflow-hidden">
          <div className="border-b border-border px-4 pt-2 shrink-0">
            <TabsList className="h-8 w-full justify-start bg-transparent p-0 gap-0.5 overflow-x-auto flex-nowrap">
              <TabsTrigger value="show-notes" className={tabTriggerClass} data-testid="tab-show-notes">
                <Sparkles className="h-3 w-3 mr-1" />
                Show Notes
              </TabsTrigger>
              <TabsTrigger value="transcript" className={tabTriggerClass} data-testid="tab-transcript">
                <BookOpen className="h-3 w-3 mr-1" />
                Transcript
              </TabsTrigger>
              {hasSpeakers && (
                <TabsTrigger value="speakers" className={tabTriggerClass} data-testid="tab-speakers">
                  <Users className="h-3 w-3 mr-1" />
                  Host & Guests
                  <Badge variant="secondary" className="text-[9px] h-3.5 px-1 ml-1">{sessionSpeakers.length}</Badge>
                </TabsTrigger>
              )}
              <TabsTrigger value="key-terms" className={tabTriggerClass} data-testid="tab-key-terms">
                <FileText className="h-3 w-3 mr-1" />
                Key Terms
                {session.topics.length > 0 && (
                  <Badge variant="secondary" className="text-[9px] h-3.5 px-1 ml-1">{session.topics.length}</Badge>
                )}
              </TabsTrigger>
              {hasSentiment && (
                <TabsTrigger value="sentiment" className={tabTriggerClass} data-testid="tab-sentiment">
                  <BarChart3 className="h-3 w-3 mr-1" />
                  Sentiment
                </TabsTrigger>
              )}
              {hasActionItems && (
                <TabsTrigger value="action-items" className={tabTriggerClass} data-testid="tab-action-items">
                  <ClipboardList className="h-3 w-3 mr-1" />
                  Action Items
                  <Badge variant="secondary" className="text-[9px] h-3.5 px-1 ml-1">{sessionActionItems.length}</Badge>
                </TabsTrigger>
              )}
              {hasFollowUps && (
                <TabsTrigger value="follow-ups" className={tabTriggerClass} data-testid="tab-follow-ups">
                  <HelpCircle className="h-3 w-3 mr-1" />
                  Follow-Ups
                  <Badge variant="secondary" className="text-[9px] h-3.5 px-1 ml-1">{sessionFollowUps.length}</Badge>
                </TabsTrigger>
              )}
              {hasSimilarProjects && (
                <TabsTrigger value="similar-projects" className={tabTriggerClass} data-testid="tab-similar-projects">
                  <FolderOpen className="h-3 w-3 mr-1" />
                  Similar Projects
                  <Badge variant="secondary" className="text-[9px] h-3.5 px-1 ml-1">{sessionSimilarProjects.length}</Badge>
                </TabsTrigger>
              )}
              {hasSipoc && (
                <TabsTrigger value="sipoc" className={tabTriggerClass} data-testid="tab-sipoc">
                  <Workflow className="h-3 w-3 mr-1" />
                  SIPOC
                </TabsTrigger>
              )}
              <TabsTrigger value="salesforce" className={tabTriggerClass} data-testid="tab-salesforce">
                <Briefcase className="h-3 w-3 mr-1" />
                Salesforce Opp
              </TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="show-notes" className="flex-1 overflow-hidden mt-0">
            <ScrollArea className="h-full">
              <div className="p-4 space-y-4">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <Sparkles className="h-4 w-4 text-primary" />
                      <h3 className="text-sm font-semibold" data-testid="text-key-takeaway-heading">Key Takeaway</h3>
                    </div>
                    {session.summary && session.transcript && session.transcript.length > 50 && (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 text-xs"
                        onClick={() => {
                          autoGenerateTriggered.current = true;
                          generateSummaryMutation.mutate();
                        }}
                        disabled={generateSummaryMutation.isPending}
                        data-testid="button-regenerate-summary"
                      >
                        {generateSummaryMutation.isPending ? (
                          <Loader2 className="h-3 w-3 animate-spin mr-1" />
                        ) : (
                          <Sparkles className="h-3 w-3 mr-1" />
                        )}
                        Regenerate
                      </Button>
                    )}
                  </div>
                  <Card className="p-4">
                    {session.summary ? (
                      <div className="text-sm leading-relaxed text-foreground whitespace-pre-line" data-testid="text-summary">
                        {session.summary}
                      </div>
                    ) : generateSummaryMutation.isPending ? (
                      <div className="text-center py-6">
                        <Loader2 className="h-6 w-6 text-primary/40 mx-auto mb-2 animate-spin" />
                        <p className="text-xs text-muted-foreground" data-testid="text-generating-summary">
                          Generating show notes based on your role...
                        </p>
                      </div>
                    ) : (
                      <div className="text-center py-6">
                        <Sparkles className="h-6 w-6 text-muted-foreground/20 mx-auto mb-2" />
                        <p className="text-xs text-muted-foreground">
                          {session.status !== "completed"
                            ? "A summary will be generated when the session wraps up."
                            : "No transcript available to summarize."}
                        </p>
                      </div>
                    )}
                  </Card>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <Card className="p-3">
                    <div className="flex items-center gap-1.5 mb-2">
                      <Users className="h-3.5 w-3.5 text-muted-foreground" />
                      <span className="text-xs font-semibold">Host & Guests</span>
                      {hasSpeakers && <Badge variant="secondary" className="text-[9px] h-3.5 px-1 ml-auto">{sessionSpeakers.length}</Badge>}
                    </div>
                    {hasSpeakers ? (
                      <div className="space-y-1">
                        {[...sessionSpeakers.filter(s => s.role === "host"), ...sessionSpeakers.filter(s => s.role !== "host")].map((s) => {
                          const originalIndex = sessionSpeakers.indexOf(s);
                          const color = getSpeakerColorByIndex(originalIndex);
                          return (
                            <div key={originalIndex} className="flex items-baseline gap-1.5">
                              <span className={`text-xs font-medium ${color.text}`}>{s.name}</span>
                              {s.title && <span className="text-[10px] text-muted-foreground">{s.title}</span>}
                              {s.role === "host" && <Badge variant="outline" className="text-[7px] h-3 px-1 border-primary/40 text-primary">Host</Badge>}
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <p className="text-[10px] text-muted-foreground">No speakers detected.</p>
                    )}
                  </Card>

                  <Card className="p-3">
                    <div className="flex items-center gap-1.5 mb-2">
                      <Tag className="h-3.5 w-3.5 text-muted-foreground" />
                      <span className="text-xs font-semibold">Topics</span>
                      <Badge variant="secondary" className="text-[9px] h-3.5 px-1 ml-auto">{session.topics.length}</Badge>
                    </div>
                    {session.topics.length > 0 ? (
                      <div className="flex flex-wrap gap-1">
                        {session.topics.slice(0, 8).map((t) => (
                          <Badge key={t.id} variant="outline" className="text-[9px] h-4 px-1.5">{t.term}</Badge>
                        ))}
                        {session.topics.length > 8 && (
                          <Badge variant="secondary" className="text-[9px] h-4 px-1.5">+{session.topics.length - 8} more</Badge>
                        )}
                      </div>
                    ) : (
                      <p className="text-[10px] text-muted-foreground">No topics detected.</p>
                    )}
                  </Card>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  {hasSentiment && (
                    <Card className="p-3">
                      <div className="flex items-center gap-1.5 mb-2">
                        <BarChart3 className="h-3.5 w-3.5 text-muted-foreground" />
                        <span className="text-xs font-semibold">Sentiment</span>
                      </div>
                      <SentimentBadge score={session.overallSentiment ?? 0} />
                      <p className="text-[10px] text-muted-foreground mt-1">{sentimentData.length} data points</p>
                    </Card>
                  )}
                  <Card className="p-3">
                    <div className="flex items-center gap-1.5 mb-2">
                      <ClipboardList className="h-3.5 w-3.5 text-muted-foreground" />
                      <span className="text-xs font-semibold">Items</span>
                    </div>
                    <div className="space-y-1">
                      <p className="text-[10px] text-muted-foreground">{sessionActionItems.length} action items</p>
                      <p className="text-[10px] text-muted-foreground">{sessionFollowUps.length} follow-ups</p>
                      <p className="text-[10px] text-muted-foreground">{sessionSimilarProjects.length} similar projects</p>
                    </div>
                  </Card>
                </div>
              </div>
            </ScrollArea>
          </TabsContent>

          <TabsContent value="transcript" className="flex-1 overflow-hidden mt-0">
            <ScrollArea className="h-full">
              <div className="p-4">
                {session.transcript ? (
                  <HighlightedTranscript text={session.transcript} topics={session.topics} sessionStart={session.createdAt instanceof Date ? session.createdAt.toISOString() : session.createdAt} sessionEnd={session.endedAt instanceof Date ? session.endedAt.toISOString() : session.endedAt} />
                ) : (
                  <div className="flex flex-col items-center justify-center py-16 text-center">
                    <BookOpen className="h-6 w-6 text-muted-foreground/20 mb-2" />
                    <p className="text-xs text-muted-foreground italic">No transcript recorded.</p>
                  </div>
                )}
              </div>
            </ScrollArea>
          </TabsContent>

          {hasSpeakers && (
            <TabsContent value="speakers" className="flex-1 overflow-hidden mt-0">
              <ScrollArea className="h-full">
                <div className="p-4 space-y-4">
                  {(() => {
                    const hosts = sessionSpeakers.filter(s => s.role === "host");
                    const guests = sessionSpeakers.filter(s => s.role !== "host");
                    return (
                      <>
                        {hosts.length > 0 && (
                          <div>
                            <div className="flex items-center gap-1.5 mb-2">
                              <Mic className="h-3 w-3 text-primary" />
                              <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Host</span>
                            </div>
                            <div className="space-y-2">
                              {hosts.map((s) => {
                                const originalIndex = sessionSpeakers.indexOf(s);
                                const color = getSpeakerColorByIndex(originalIndex);
                                const isEditing = editingSpeaker?.index === originalIndex;
                                return (
                                  <Card key={originalIndex} className="p-3 border-primary/20 group" data-testid={`speaker-entry-${originalIndex}`}>
                                    <div className="flex items-center gap-2">
                                      {isEditing ? (
                                        <>
                                          <Input
                                            autoFocus
                                            className="h-7 text-sm"
                                            value={editingSpeaker.name}
                                            onChange={e => setEditingSpeaker({ index: originalIndex, name: e.target.value })}
                                            onKeyDown={e => { if (e.key === "Enter") commitRename(); if (e.key === "Escape") setEditingSpeaker(null); }}
                                            data-testid={`input-rename-speaker-${originalIndex}`}
                                          />
                                          <Button size="icon" variant="ghost" className="h-7 w-7 shrink-0" onClick={commitRename}><Check className="h-3.5 w-3.5 text-primary" /></Button>
                                          <Button size="icon" variant="ghost" className="h-7 w-7 shrink-0" onClick={() => setEditingSpeaker(null)}><X className="h-3.5 w-3.5 text-muted-foreground" /></Button>
                                        </>
                                      ) : (
                                        <>
                                          <span className={`text-sm font-medium ${color.text}`} data-testid={`speaker-name-${originalIndex}`}>{s.name}</span>
                                          {s.title && <span className="text-xs text-muted-foreground" data-testid={`speaker-title-${originalIndex}`}>{s.title}</span>}
                                          <Badge variant="outline" className="text-[8px] h-3.5 px-1 border-primary/40 text-primary ml-auto">Host</Badge>
                                          <Button size="icon" variant="ghost" className="h-6 w-6 opacity-0 group-hover:opacity-100 shrink-0" onClick={() => setEditingSpeaker({ index: originalIndex, name: s.name })} data-testid={`button-rename-speaker-${originalIndex}`}><Pencil className="h-3 w-3 text-muted-foreground" /></Button>
                                        </>
                                      )}
                                    </div>
                                  </Card>
                                );
                              })}
                            </div>
                          </div>
                        )}
                        {guests.length > 0 && (
                          <div>
                            <div className="flex items-center gap-1.5 mb-2">
                              <Users className="h-3 w-3 text-muted-foreground" />
                              <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">{hosts.length > 0 ? "Guests" : "Participants"}</span>
                            </div>
                            <div className="space-y-2">
                              {guests.map((s) => {
                                const originalIndex = sessionSpeakers.indexOf(s);
                                const color = getSpeakerColorByIndex(originalIndex);
                                const isEditing = editingSpeaker?.index === originalIndex;
                                return (
                                  <Card key={originalIndex} className="p-3 group" data-testid={`speaker-entry-${originalIndex}`}>
                                    <div className="flex items-center gap-2">
                                      {isEditing ? (
                                        <>
                                          <Input
                                            autoFocus
                                            className="h-7 text-sm"
                                            value={editingSpeaker.name}
                                            onChange={e => setEditingSpeaker({ index: originalIndex, name: e.target.value })}
                                            onKeyDown={e => { if (e.key === "Enter") commitRename(); if (e.key === "Escape") setEditingSpeaker(null); }}
                                            data-testid={`input-rename-speaker-${originalIndex}`}
                                          />
                                          <Button size="icon" variant="ghost" className="h-7 w-7 shrink-0" onClick={commitRename}><Check className="h-3.5 w-3.5 text-primary" /></Button>
                                          <Button size="icon" variant="ghost" className="h-7 w-7 shrink-0" onClick={() => setEditingSpeaker(null)}><X className="h-3.5 w-3.5 text-muted-foreground" /></Button>
                                        </>
                                      ) : (
                                        <>
                                          <span className={`text-sm font-medium ${color.text}`} data-testid={`speaker-name-${originalIndex}`}>{s.name}</span>
                                          {s.title && <span className="text-xs text-muted-foreground" data-testid={`speaker-title-${originalIndex}`}>{s.title}</span>}
                                          <Button size="icon" variant="ghost" className="h-6 w-6 opacity-0 group-hover:opacity-100 ml-auto shrink-0" onClick={() => setEditingSpeaker({ index: originalIndex, name: s.name })} data-testid={`button-rename-speaker-${originalIndex}`}><Pencil className="h-3 w-3 text-muted-foreground" /></Button>
                                        </>
                                      )}
                                    </div>
                                  </Card>
                                );
                              })}
                            </div>
                          </div>
                        )}
                      </>
                    );
                  })()}
                </div>
              </ScrollArea>
            </TabsContent>
          )}

          <TabsContent value="key-terms" className="flex-1 overflow-hidden mt-0">
            <ScrollArea className="h-full">
              <div className="p-4">
                {session.topics.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-16 text-center">
                    <Tag className="h-6 w-6 text-muted-foreground/20 mb-2" />
                    <p className="text-xs text-muted-foreground">No topics detected.</p>
                  </div>
                ) : (
                  <TopicGroups topics={session.topics} sessionId={session.id} sessionStartTime={session.createdAt} />
                )}
              </div>
            </ScrollArea>
          </TabsContent>

          {hasSentiment && (
            <TabsContent value="sentiment" className="flex-1 overflow-hidden mt-0">
              <ScrollArea className="h-full">
                <div className="p-4">
                  <SentimentEqualizerFull
                    sentimentData={sentimentData}
                    overallSentiment={session.overallSentiment}
                    sessionStart={session.createdAt instanceof Date ? session.createdAt.toISOString() : session.createdAt}
                    sessionEnd={session.endedAt instanceof Date ? session.endedAt?.toISOString() : session.endedAt}
                  />
                </div>
              </ScrollArea>
            </TabsContent>
          )}

          {hasActionItems && (
            <TabsContent value="action-items" className="flex-1 overflow-hidden mt-0">
              <ScrollArea className="h-full">
                <div className="p-4">
                  <ActionItemsPanel items={sessionActionItems} />
                </div>
              </ScrollArea>
            </TabsContent>
          )}

          {hasFollowUps && (
            <TabsContent value="follow-ups" className="flex-1 overflow-hidden mt-0">
              <ScrollArea className="h-full">
                <div className="p-4">
                  <FollowUpQuestionsPanel questions={sessionFollowUps} />
                </div>
              </ScrollArea>
            </TabsContent>
          )}

          {hasSimilarProjects && (
            <TabsContent value="similar-projects" className="flex-1 overflow-hidden mt-0">
              <ScrollArea className="h-full">
                <div className="p-4 space-y-2">
                  {sessionSimilarProjects.map((match, i) => (
                    <Card key={match.projectId || i} className="p-3" data-testid={`card-similar-project-${match.projectId}`}>
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <span className="text-sm font-semibold" data-testid={`text-similar-title-${match.projectId}`}>{match.title || `Project #${match.projectId}`}</span>
                          <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                            {match.industry && (
                              <Badge variant="outline" className="text-[9px] h-3.5 gap-0.5">
                                <Building2 className="h-2.5 w-2.5" />
                                {match.industry}
                              </Badge>
                            )}
                            {match.clientName && (
                              <Badge variant="secondary" className="text-[9px] h-3.5">{match.clientName}</Badge>
                            )}
                            {match.projectDate && (
                              <span className="text-[10px] text-muted-foreground">{new Date(match.projectDate).toLocaleDateString("en-US", { year: "numeric", month: "short" })}</span>
                            )}
                          </div>
                          <p className="text-xs text-emerald-600 dark:text-emerald-400 mt-1 italic" data-testid={`text-similar-relevance-${match.projectId}`}>{match.relevance}</p>
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>
              </ScrollArea>
            </TabsContent>
          )}

          {hasSipoc && sessionSipoc && (
            <TabsContent value="sipoc" className="flex-1 overflow-hidden mt-0">
              <ScrollArea className="h-full">
                <div className="p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
                  {SIPOC_COLUMNS.map(col => (
                    <Card key={col.key} className="p-3 min-w-0" data-testid={`card-sipoc-${col.key}`}>
                      <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{col.label}</span>
                      {sessionSipoc[col.key].length > 0 ? (
                        <ul className="mt-2 space-y-1.5">
                          {sessionSipoc[col.key].map((item, i) => (
                            <li key={i} className="flex items-start justify-between gap-1.5 group">
                              <span className="text-xs leading-snug text-foreground/90">{item.text}</span>
                              <button
                                onClick={() => removeSipocItem(col.key, i)}
                                className="shrink-0 text-muted-foreground/0 group-hover:text-muted-foreground/60 hover:!text-destructive transition-colors"
                                data-testid={`button-remove-sipoc-${col.key}-${i}`}
                                aria-label={`Remove ${col.label.slice(0, -1)}`}
                              >
                                <X className="h-3 w-3" />
                              </button>
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className="text-xs text-muted-foreground/50 mt-2">Not identified in this session.</p>
                      )}
                    </Card>
                  ))}
                </div>
              </ScrollArea>
            </TabsContent>
          )}

          <TabsContent value="salesforce" className="flex-1 overflow-hidden mt-0">
              <ScrollArea className="h-full">
                <div className="p-4 space-y-4">
                  {/* Header + Push button */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Briefcase className="h-4 w-4 text-[#00A1E0]" />
                      <h3 className="text-sm font-semibold">Salesforce Opportunity</h3>
                    </div>
                    <Button
                      size="sm"
                      className="h-8 gap-1.5 bg-[#00A1E0] hover:bg-[#0087be] text-white"
                      onClick={() => toast({ title: "Salesforce integration coming soon", description: "Push-to-Salesforce will be available in a future release." })}
                      data-testid="button-push-to-salesforce"
                    >
                      <CloudUpload className="h-3.5 w-3.5" />
                      Push to Salesforce
                    </Button>
                  </div>

                  {/* Opportunity fields */}
                  <Card className="p-0 divide-y divide-border overflow-hidden">
                    {(() => {
                      const bantData = (session as any).bantData as BANTData | null;
                      const speakers = (session.speakers || []) as SpeakerEntry[];
                      const primaryContact = speakers.find(s => s.role !== "host");
                      const fields: Array<{ label: string; value: string | null; icon: React.ReactNode; filled: boolean }> = [
                        { label: "Opportunity Name", value: session.title || null, icon: <Briefcase className="h-3.5 w-3.5 text-[#00A1E0]" />, filled: !!session.title },
                        { label: "Account", value: session.clientName || null, icon: <Building2 className="h-3.5 w-3.5 text-muted-foreground" />, filled: !!session.clientName },
                        { label: "Stage", value: session.status === "completed" ? "Discovery" : null, icon: <Target className="h-3.5 w-3.5 text-muted-foreground" />, filled: session.status === "completed" },
                        { label: "Amount", value: bantData?.budget?.value || null, icon: <DollarSign className="h-3.5 w-3.5 text-emerald-500" />, filled: !!bantData?.budget?.value },
                        { label: "Close Date", value: bantData?.timeline?.value || null, icon: <Clock className="h-3.5 w-3.5 text-purple-500" />, filled: !!bantData?.timeline?.value },
                        { label: "Primary Contact", value: primaryContact?.name || null, icon: <Users className="h-3.5 w-3.5 text-muted-foreground" />, filled: !!primaryContact },
                        { label: "Decision Maker", value: bantData?.authority?.value || null, icon: <UserCheck className="h-3.5 w-3.5 text-blue-500" />, filled: !!bantData?.authority?.value },
                        { label: "Pain Points", value: bantData?.needs?.value || null, icon: <Target className="h-3.5 w-3.5 text-amber-500" />, filled: !!bantData?.needs?.value },
                        { label: "Industry", value: session.industry || null, icon: <Factory className="h-3.5 w-3.5 text-muted-foreground" />, filled: !!session.industry },
                      ];
                      return fields.map(({ label, value, icon, filled }) => (
                        <div key={label} className="flex items-start gap-3 px-4 py-3">
                          <div className="mt-0.5 shrink-0">{icon}</div>
                          <div className="flex-1 min-w-0">
                            <p className="text-[10px] text-muted-foreground uppercase tracking-wide font-medium mb-0.5">{label}</p>
                            {filled && value ? (
                              <p className="text-sm font-medium leading-snug">{value}</p>
                            ) : (
                              <p className="text-sm text-muted-foreground/40 italic">Not captured</p>
                            )}
                          </div>
                          {filled && <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0 mt-1" />}
                        </div>
                      ));
                    })()}
                  </Card>

                  {/* Next steps from action items */}
                  {sessionActionItems.length > 0 && (
                    <div>
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Next Steps</p>
                      <Card className="p-0 divide-y divide-border overflow-hidden">
                        {sessionActionItems.slice(0, 5).map((item, i) => (
                          <div key={i} className="px-4 py-2.5 flex items-start gap-2">
                            <CheckCircle2 className="h-3.5 w-3.5 text-muted-foreground/40 shrink-0 mt-0.5" />
                            <p className="text-sm leading-snug">{item.text}</p>
                          </div>
                        ))}
                      </Card>
                    </div>
                  )}
                </div>
              </ScrollArea>
            </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
