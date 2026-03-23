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
import { ArrowLeft, Clock, Tag, BookOpen, FileText, ClipboardList, HelpCircle, Building2, Sparkles, Loader2, Wrench, Lightbulb, Factory, Download, Users, FolderOpen, BarChart3, Mic, ChevronDown, Network } from "lucide-react";
import { getSpeakerColorByIndex } from "@/lib/speaker-colors";
import { exportSessionPdf } from "@/lib/export-pdf";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useSession } from "@/hooks/use-sessions";
import type { Session, Topic, SentimentEntry, ActionItem, FollowUpQuestion, SpeakerEntry } from "@shared/schema";
import { consolidateSimilarProjects } from "@shared/schema";
import { formatDate, formatDuration } from "@/lib/date";

type SessionWithTopics = Session & { topics: Topic[] };

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
        <p className="text-muted-foreground">Episode not found</p>
        <Link href="/sessions">
          <Button variant="ghost" className="mt-4" data-testid="button-back-to-episodes">Back to Episodes</Button>
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
              <Button
                size="sm"
                variant="outline"
                onClick={() => exportSessionPdf(session)}
                data-testid="button-export-pdf"
              >
                <Download className="h-3.5 w-3.5 mr-1.5" />
                Export PDF
              </Button>
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
                            ? "Show notes will be generated when the episode wraps up."
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
                  <HighlightedTranscript text={session.transcript} topics={session.topics} sessionStart={session.createdAt} sessionEnd={session.endedAt} />
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
                                return (
                                  <Card key={originalIndex} className="p-3 border-primary/20" data-testid={`speaker-entry-${originalIndex}`}>
                                    <div className="flex items-baseline gap-2">
                                      <span className={`text-sm font-medium ${color.text}`} data-testid={`speaker-name-${originalIndex}`}>{s.name}</span>
                                      {s.title && (
                                        <span className="text-xs text-muted-foreground" data-testid={`speaker-title-${originalIndex}`}>{s.title}</span>
                                      )}
                                      <Badge variant="outline" className="text-[8px] h-3.5 px-1 border-primary/40 text-primary ml-auto">Host</Badge>
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
                                return (
                                  <Card key={originalIndex} className="p-3" data-testid={`speaker-entry-${originalIndex}`}>
                                    <div className="flex items-baseline gap-2">
                                      <span className={`text-sm font-medium ${color.text}`} data-testid={`speaker-name-${originalIndex}`}>{s.name}</span>
                                      {s.title && (
                                        <span className="text-xs text-muted-foreground" data-testid={`speaker-title-${originalIndex}`}>{s.title}</span>
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
                    sessionStart={session.createdAt}
                    sessionEnd={session.endedAt}
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
        </Tabs>
      </div>
    </div>
  );
}
