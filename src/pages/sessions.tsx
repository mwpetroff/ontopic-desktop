import { useState, useMemo } from "react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { SentimentBadge } from "@/components/sentiment-indicator";
import { useSessions, useDeleteSession, useUpdateSession } from "@/hooks/use-sessions";
import { History, Trash2, ChevronRight, Clock, Tag, Building2, Factory, Pencil, Check, X, ChevronDown, Search } from "lucide-react";
import type { Session } from "@shared/schema";
import { formatDate, formatDuration } from "@/lib/date";

function SessionCard({ session, onDelete, showClient }: { session: Session; onDelete: (id: number) => void; showClient?: boolean }) {
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(session.title);
  const [editClient, setEditClient] = useState(session.clientName || "");

  const baseUpdateMutation = useUpdateSession();
  const updateMutation = {
    ...baseUpdateMutation,
    mutate: (data: { title?: string; clientName?: string }) => {
      baseUpdateMutation.mutate({ id: session.id, data }, {
        onSuccess: () => setIsEditing(false),
      });
    },
  };

  if (isEditing) {
    return (
      <Card className="p-4" data-testid={`card-session-${session.id}`}>
        <div className="space-y-2">
          <Input
            value={editTitle}
            onChange={(e) => setEditTitle(e.target.value)}
            placeholder="Session title"
            className="h-8 text-sm"
            data-testid={`input-edit-title-${session.id}`}
          />
          <div className="relative">
            <Building2 className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
            <Input
              value={editClient}
              onChange={(e) => setEditClient(e.target.value)}
              placeholder="Client name"
              className="h-8 text-sm pl-8"
              data-testid={`input-edit-client-${session.id}`}
            />
          </div>
          <div className="flex items-center gap-2 justify-end">
            <Button
              size="sm"
              variant="ghost"
              className="h-7 text-xs"
              onClick={() => {
                setEditTitle(session.title);
                setEditClient(session.clientName || "");
                setIsEditing(false);
              }}
              data-testid={`button-cancel-edit-${session.id}`}
            >
              <X className="h-3 w-3 mr-1" />
              Cancel
            </Button>
            <Button
              size="sm"
              className="h-7 text-xs"
              onClick={() => updateMutation.mutate({ title: editTitle, clientName: editClient })}
              disabled={updateMutation.isPending}
              data-testid={`button-save-edit-${session.id}`}
            >
              <Check className="h-3 w-3 mr-1" />
              Save
            </Button>
          </div>
        </div>
      </Card>
    );
  }

  return (
    <Link href={`/sessions/${session.id}`} data-testid={`link-session-${session.id}`}>
      <Card className="p-4 hover-elevate cursor-pointer transition-all">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-md bg-primary/10 shrink-0">
            <Tag className="h-5 w-5 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-semibold truncate">{session.title}</h3>
            <div className="flex items-center gap-3 mt-0.5 flex-wrap">
              {showClient && session.clientName && (
                <span className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Building2 className="h-3 w-3" />
                  {session.clientName}
                </span>
              )}
              {session.industry && (
                <Badge variant="outline" className="text-[10px] h-4 gap-0.5 px-1.5" data-testid={`badge-industry-${session.id}`}>
                  <Factory className="h-2.5 w-2.5" />
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
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {session.overallSentiment !== null && session.overallSentiment !== undefined && (
              <SentimentBadge score={session.overallSentiment} sessionId={session.id} />
            )}
            <Badge variant="secondary" className="text-xs">
              {session.totalTopics} topics
            </Badge>
            <Button
              size="icon"
              variant="ghost"
              className="h-7 w-7"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setIsEditing(true);
              }}
              data-testid={`button-edit-session-${session.id}`}
            >
              <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
            </Button>
            <Button
              size="icon"
              variant="ghost"
              className="h-7 w-7"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onDelete(session.id);
              }}
              data-testid={`button-delete-session-${session.id}`}
            >
              <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
            </Button>
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          </div>
        </div>
      </Card>
    </Link>
  );
}

interface ClientGroup {
  clientName: string;
  sessions: Session[];
}

function ClientGroupSection({ group, onDelete }: { group: ClientGroup; onDelete: (id: number) => void }) {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div data-testid={`group-client-${group.clientName}`}>
      <button
        className="flex items-center gap-2 w-full px-1 py-2 text-left group"
        onClick={() => setCollapsed(!collapsed)}
        data-testid={`button-toggle-group-${group.clientName}`}
      >
        <ChevronDown className={`h-3.5 w-3.5 text-muted-foreground transition-transform ${collapsed ? "-rotate-90" : ""}`} />
        <Building2 className="h-3.5 w-3.5 text-primary" />
        <span className="text-sm font-semibold" data-testid={`text-group-name-${group.clientName}`}>{group.clientName}</span>
        <Badge variant="secondary" className="text-[10px] h-4 px-1.5">{group.sessions.length}</Badge>
      </button>
      {!collapsed && (
        <div className="space-y-2 ml-5">
          {group.sessions.map((session) => (
            <SessionCard
              key={session.id}
              session={session}
              onDelete={onDelete}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default function Sessions() {
  const [searchQuery, setSearchQuery] = useState("");
  const { data: sessions = [], isLoading } = useSessions();
  const deleteMutation = useDeleteSession();

  const completedSessions = useMemo(() => {
    const completed = sessions.filter(s => s.status === "completed");
    if (!searchQuery.trim()) return completed;
    const q = searchQuery.toLowerCase().trim();
    return completed.filter(s =>
      s.title.toLowerCase().includes(q) ||
      (s.clientName && s.clientName.toLowerCase().includes(q)) ||
      (s.industry && s.industry.toLowerCase().includes(q))
    );
  }, [sessions, searchQuery]);

  type ListItem = { type: "group"; group: ClientGroup } | { type: "session"; session: Session };

  const listItems = useMemo<ListItem[]>(() => {
    const clientCounts = new Map<string, number>();
    for (const s of completedSessions) {
      if (s.clientName) {
        clientCounts.set(s.clientName, (clientCounts.get(s.clientName) || 0) + 1);
      }
    }

    const groupMap = new Map<string, Session[]>();
    const ungroupedList: Session[] = [];

    for (const s of completedSessions) {
      if (s.clientName && clientCounts.get(s.clientName)! > 1) {
        if (!groupMap.has(s.clientName)) {
          groupMap.set(s.clientName, []);
        }
        groupMap.get(s.clientName)!.push(s);
      } else {
        ungroupedList.push(s);
      }
    }

    for (const [, sessions] of groupMap) {
      sessions.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    }

    const items: (ListItem & { sortKey: number })[] = [];

    for (const [clientName, sessions] of groupMap) {
      items.push({
        type: "group",
        group: { clientName, sessions },
        sortKey: new Date(sessions[0].createdAt).getTime(),
      });
    }

    for (const s of ungroupedList) {
      items.push({
        type: "session",
        session: s,
        sortKey: new Date(s.createdAt).getTime(),
      });
    }

    items.sort((a, b) => b.sortKey - a.sortKey);
    return items;
  }, [completedSessions]);

  return (
    <div className="flex flex-col h-full">
      <div className="border-b border-border bg-background/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="flex items-center justify-between gap-3 p-4">
          <div className="flex items-center gap-3">
            <History className="h-5 w-5 text-muted-foreground" />
            <h1 className="text-lg font-semibold" data-testid="text-page-title">Sessions</h1>
          </div>
          <Badge variant="secondary">{completedSessions.length} sessions</Badge>
        </div>
        {!isLoading && sessions.filter(s => s.status === "completed").length > 0 && (
          <div className="px-4 pb-3">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                placeholder="Search by title, client, or industry..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-8 text-sm pl-8"
                data-testid="input-search-episodes"
              />
            </div>
          </div>
        )}
      </div>

      <ScrollArea className="flex-1">
        <div className="p-4 space-y-3">
          {isLoading ? (
            Array.from({ length: 3 }).map((_, i) => (
              <Card key={i} className="p-4">
                <div className="flex items-center gap-3">
                  <Skeleton className="h-10 w-10 rounded-md" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-48" />
                    <Skeleton className="h-3 w-32" />
                  </div>
                </div>
              </Card>
            ))
          ) : completedSessions.length === 0 && !searchQuery.trim() ? (
            <div className="flex flex-col items-center justify-center py-24 text-center">
              <History className="h-12 w-12 text-muted-foreground/20 mb-4" />
              <h2 className="text-lg font-semibold mb-1">No Sessions Yet</h2>
              <p className="text-sm text-muted-foreground max-w-xs">
                Start a session from the Live Session page to capture your first meeting.
              </p>
            </div>
          ) : completedSessions.length === 0 && searchQuery.trim() ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <Search className="h-10 w-10 text-muted-foreground/20 mb-3" />
              <h2 className="text-sm font-semibold mb-1">No matches</h2>
              <p className="text-xs text-muted-foreground max-w-xs">
                No sessions match "{searchQuery.trim()}"
              </p>
            </div>
          ) : (
            <>
              {listItems.map((item) =>
                item.type === "group" ? (
                  <ClientGroupSection
                    key={`group-${item.group.clientName}`}
                    group={item.group}
                    onDelete={(id) => deleteMutation.mutate(id)}
                  />
                ) : (
                  <SessionCard
                    key={item.session.id}
                    session={item.session}
                    onDelete={(id) => deleteMutation.mutate(id)}
                    showClient
                  />
                )
              )}
            </>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
