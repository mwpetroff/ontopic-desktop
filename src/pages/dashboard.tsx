import { useState, useCallback, useRef, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useReferenceProjects } from "@/hooks/use-reference-projects";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useTypewriter } from "@/hooks/use-typewriter";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { AudioVisualizer } from "@/components/audio-visualizer";
import { MicrophoneSelector } from "@/components/microphone-selector";
import { TopicCard } from "@/components/topic-card";
import { useAudioCapture } from "@/hooks/use-audio-capture";
import { useToast } from "@/hooks/use-toast";
import { HighlightedTranscript } from "@/components/highlighted-transcript";
import { SentimentEqualizer, SentimentEqualizerFull } from "@/components/sentiment-equalizer";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ActionItemsPanel } from "@/components/action-items-panel";
import { FollowUpQuestionsPanel } from "@/components/follow-up-questions-panel";
import { ReorderableColumns, type ColumnDef } from "@/components/reorderable-columns";
import {
  Radio, Square, Mic, MicOff, Loader2, AlertCircle, BookOpen,
  Play, ClipboardList, HelpCircle, Building2, Podcast,
  Wrench, Lightbulb, Factory, Users, BarChart3, FolderOpen, ExternalLink,
  DollarSign, UserCheck, Target, Clock, CheckCircle2, Circle, TrendingUp
} from "lucide-react";
import { getSpeakerColorByIndex } from "@/lib/speaker-colors";
import { matchSpeaker } from "@/lib/speaker-match";
import type { Session, Topic, VoiceProfile, SentimentEntry, ActionItem, FollowUpQuestion, SpeakerEntry, SimilarProjectMatch, ReferenceProject, BANTData, MethodologyProgress } from "@shared/schema";
import { consolidateSimilarProjects } from "@shared/schema";
import { useSettings } from "@/hooks/use-settings";

const DEMO_REFERENCE_PROJECTS = [
  {
    title: "Contoso Cloud Lift & Shift",
    description: "Migrated Contoso's on-prem VMware vSphere environment to Azure IaaS. Included VM assessment, Azure Migrate tooling, network redesign, and hybrid connectivity via ExpressRoute.",
    tags: ["Azure", "VMware", "Cloud Migration", "ExpressRoute"],
    industry: "Manufacturing",
    clientName: "Contoso Ltd",
    projectDate: "2025-11-15T00:00:00.000Z",
  },
  {
    title: "Fabrikam Zero Trust Rollout",
    description: "Implemented zero trust architecture for Fabrikam using CrowdStrike Falcon for EDR, Splunk SIEM for centralized monitoring, and Azure AD Conditional Access for identity-driven security.",
    tags: ["Zero Trust", "CrowdStrike", "Splunk", "Azure AD", "IAM"],
    industry: "Financial Services",
    clientName: "Fabrikam Inc",
    projectDate: "2026-01-20T00:00:00.000Z",
  },
  {
    title: "Northwind DevOps Modernization",
    description: "Replaced legacy Jenkins CI/CD with GitHub Actions, containerized microservices on AKS, and deployed Datadog for full-stack observability including APM, logs, and infrastructure monitoring.",
    tags: ["GitHub Actions", "Kubernetes", "AKS", "Datadog", "Jenkins", "CI/CD"],
    industry: "Retail",
    clientName: "Northwind Traders",
    projectDate: "2025-08-05T00:00:00.000Z",
  },
  {
    title: "Woodgrove Data Platform",
    description: "Built a modern cloud data warehouse on Snowflake with Databricks ETL pipelines, Terraform IaC provisioning, and Grafana dashboards for operational visibility.",
    tags: ["Snowflake", "Databricks", "Terraform", "Grafana", "Data Warehouse"],
    industry: "Healthcare",
    clientName: "Woodgrove Bank",
    projectDate: "2025-06-10T00:00:00.000Z",
  },
];

const DEMO_CHUNKS = [
  "Hi everyone, I'm Sarah Chen, the project lead. Let's kick off this cloud migration review. The first thing we need to address is our current on-prem infrastructure. We've been running VMware vSphere for virtualization, but the license costs are getting out of hand and it's really frustrating.",
  "Thanks Sarah. I'm Mark Rodriguez from infrastructure. I agree, the costs are unsustainable. We've been evaluating both AWS and Azure for the migration. Our CloudBridge Solutions team has done a proof of concept with Azure Kubernetes Service, and the results look very promising for containerizing our legacy workloads.",
  "Good points, Mark. This is Priya Patel from security. Before we go further on the cloud side, I want to flag some serious security concerns. Our CISO wants us to implement zero trust architecture across all services. That means we need to completely rethink how we handle identity and access management.",
  "I hear you, Priya. SecureOps Group recommended we deploy CrowdStrike for endpoint detection and response across the fleet, and integrate Splunk as our SIEM solution for centralized threat monitoring. I feel much more confident with those tools in place.",
  "Hey team, James Park here from DevOps. On the DevOps side, we're excited to replace our aging Jenkins pipelines with GitHub Actions. The team has already prototyped matrix builds that cut our CI/CD pipeline time from forty-five minutes down to twelve. That's a huge win!",
  "Great progress, James. Sarah again. We should also talk about observability. I think we need Datadog for APM and infrastructure monitoring, plus Grafana dashboards for the ops team. We can use Terraform to provision everything as infrastructure as code.",
  "This is Lisa Wang from the data team. For the database layer, we're pushing for Snowflake as our cloud data warehouse. DataFlow Analytics, our partner, has been building the ETL pipelines using Databricks and they're seeing great performance. Really excited about the possibilities.",
  "Last item from me — Sarah here. We need to set up proper incident management. I'm worried we don't have a good process right now. I'm thinking PagerDuty for alerting integrated with our Jira boards, and we should adopt the SRE model with defined SLOs and error budgets for each service.",
];

const AE_DEMO_CHUNKS = [
  "Hi, thanks for joining. I'm Jennifer Walsh, CTO at Meridian Financial. We're a mid-size wealth management and lending firm, about eighteen hundred employees across twelve offices. I'll be honest — the reason I reached out is that our on-premises data infrastructure is becoming a serious liability. We're running a fifteen-year-old Oracle data warehouse on aging HPE hardware, and we're at a point where the maintenance cost and the risk of failure outweigh any benefit of staying on-prem.",
  "Thanks for the context, Jennifer. When you say liability — is the primary driver the operational risk of hardware failure, or is it more the cost side, or are there regulatory pressures coming into play as well? And are there specific business capabilities you're missing today because of the current architecture?",
  "It's all three, honestly. From a regulatory standpoint we're under increased OCC and SEC scrutiny and our current environment makes audit trails incredibly painful to produce — our compliance team spends weeks pulling data manually for each examination. On the capability side, our risk and analytics teams desperately want real-time portfolio exposure dashboards and we simply cannot build those on the current stack. And the hardware — we had an unplanned outage in January that took our reporting environment down for six hours. That is not acceptable for a financial services firm.",
  "That January outage and the compliance exposure are exactly the kind of triggers that tend to create urgency. Jennifer, on the decision and investment side — who else is at the table for a project of this scope? And do you have a sense yet of what the board has approved or what funding envelope you're working within?",
  "The board approved a digital infrastructure modernization budget in January right after that outage. I own the technology roadmap and the vendor selection decision — that's fully within my remit. We've earmarked six hundred thousand dollars for the platform migration and implementation in this fiscal year, with a follow-on phase two budget of similar size for the analytics layer. Our CISO Raj Patel has final sign-off on any cloud architecture from a security and compliance standpoint, and he's already reviewed Azure and AWS from a FedRAMP and SOC 2 perspective. Both are acceptable to him.",
  "Six hundred K for phase one with a clear phase two path — that's a well-structured investment. Let me ask about timeline, because I want to understand what success looks like and when. You mentioned OCC and SEC examinations — are there specific audit windows or regulatory deadlines that are anchoring your go-live target?",
  "Yes. We have an OCC examination scheduled for September and I need the new environment to be fully operational and auditable before that — which means we need to be live no later than end of July to give our compliance team at least six weeks to run parallel reporting and validate data lineage. That means a signed engagement agreement by end of May at the absolute latest. We've done preliminary conversations with two other consulting firms, but neither of them had deep financial services regulatory experience combined with Azure data engineering capability, which is what brought us to you specifically.",
  "Jennifer, let me play back what I've heard to make sure I've got it right. Meridian has a critical dependency on aging Oracle infrastructure that creates both operational risk — as the January outage showed — and regulatory exposure with your OCC and SEC audit obligations. You need a cloud-native data platform on Azure that delivers real-time portfolio analytics and a defensible audit trail. You have six hundred K approved for phase one, the decision is yours with Raj's security sign-off, and you need to be fully live by end of July ahead of your September examination. If I've captured that correctly, I'd like to propose a four-week architecture assessment that maps your current Oracle schema to a Azure Synapse and Azure Purview target state, with a data lineage and compliance framework baked in from day one. That gives you something concrete to take back to the board and to Raj before we scope the full engagement.",
];

const METHODOLOGY_LABELS: Record<string, string> = {
  sandler: "Sandler Selling",
  meddic: "MEDDIC",
  spin: "SPIN Selling",
  challenger: "Challenger Sale",
};

const BANT_KEYS = [
  { key: "budget" as keyof BANTData, label: "Budget", icon: DollarSign, color: "text-emerald-500" },
  { key: "authority" as keyof BANTData, label: "Authority", icon: UserCheck, color: "text-blue-500" },
  { key: "needs" as keyof BANTData, label: "Needs", icon: Target, color: "text-amber-500" },
  { key: "timeline" as keyof BANTData, label: "Timeline", icon: Clock, color: "text-purple-500" },
];

type SentimentPoint = SentimentEntry;

function DashboardTopicGroups({
  toolTopics, conceptTopics, industryTopics, newTopicIds, sessionId
}: {
  toolTopics: Topic[];
  conceptTopics: Topic[];
  industryTopics: Topic[];
  newTopicIds: Set<number>;
  sessionId?: number;
}) {
  const groups = [
    { label: "Products & Brands", icon: <Wrench className="h-3 w-3 text-blue-500" />, items: toolTopics },
    { label: "Key Concepts", icon: <Lightbulb className="h-3 w-3 text-amber-500" />, items: conceptTopics },
    { label: "Industry Terms", icon: <Factory className="h-3 w-3 text-emerald-500" />, items: industryTopics },
  ].filter(g => g.items.length > 0);

  return (
    <>
      {groups.map(({ label, icon, items }) => (
        <div key={label} className="mb-3">
          <div className="flex items-center gap-1.5 mb-1 px-1">
            {icon}
            <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">{label}</span>
            <Badge variant="outline" className="text-[9px] h-3.5 px-1 ml-auto">{items.length}</Badge>
          </div>
          {items.map((topic) => (
            <TopicCard key={topic.id} topic={topic} isNew={newTopicIds.has(topic.id)} editable sessionId={sessionId} />
          ))}
        </div>
      ))}
    </>
  );
}

export default function Dashboard() {
  const [, navigate] = useLocation();
  const [activeSession, setActiveSession] = useState<Session | null>(null);
  const [sessionTitle, setSessionTitle] = useState("New Episode");
  const [clientName, setClientName] = useState("");
  const [industry, setIndustry] = useState("");
  const [isListening, setIsListening] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [newTopicIds, setNewTopicIds] = useState<Set<number>>(new Set());
  const [isProcessing, setIsProcessing] = useState(false);
  const [isDemoRunning, setIsDemoRunning] = useState(false);
  const [demoChunkIndex, setDemoChunkIndex] = useState(0);
  const [demoAudioLevel, setDemoAudioLevel] = useState(0);
  const [sentimentData, setSentimentData] = useState<SentimentPoint[]>([]);
  const [overallSentiment, setOverallSentiment] = useState<number>(0);
  const [enableActionItems, setEnableActionItems] = useState(true);
  const [enableFollowUpQuestions, setEnableFollowUpQuestions] = useState(true);
  const [selectedMicId, setSelectedMicId] = useState("");
  const [actionItems, setActionItems] = useState<ActionItem[]>([]);
  const [followUpQuestions, setFollowUpQuestions] = useState<FollowUpQuestion[]>([]);
  const [liveSpeakers, setLiveSpeakers] = useState<SpeakerEntry[]>([]);
  const [similarProjects, setSimilarProjects] = useState<SimilarProjectMatch[]>([]);
  const [bantData, setBantData] = useState<BANTData | null>(null);
  const [methodologyProgress, setMethodologyProgress] = useState<MethodologyProgress | null>(null);
  const { toast } = useToast();
  const processingRef = useRef(false);
  const activeSessionRef = useRef<Session | null>(null);
  const demoTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const demoAnimationRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const demoProjectIdsRef = useRef<number[]>([]);
  const demoChunksRef = useRef<string[]>(DEMO_CHUNKS);
  const isDemoRunningRef = useRef(false);
  const transcriptEndRef = useRef<HTMLDivElement>(null);
  const chunkSnapshotsRef = useRef<number[][]>([]);

  const { data: settings } = useSettings();
  const isAEMode = settings?.hostRole === "account-executive";

  useEffect(() => {
    activeSessionRef.current = activeSession;
  }, [activeSession]);

  useEffect(() => {
    isDemoRunningRef.current = isDemoRunning;
  }, [isDemoRunning]);

  const { data: topics = [], refetch: refetchTopics } = useQuery<Topic[]>({
    queryKey: [`/api/sessions/${activeSession?.id}/topics`],
    enabled: !!activeSession,
  });

  const { data: voiceProfiles = [] } = useQuery<VoiceProfile[]>({
    queryKey: ["/api/voice-profiles"],
  });
  const { data: referenceProjectsList = [] } = useReferenceProjects();
  const voiceProfilesRef = useRef<VoiceProfile[]>([]);
  useEffect(() => {
    voiceProfilesRef.current = voiceProfiles;
  }, [voiceProfiles]);

  const onLiveFrequencyData = useCallback((data: Float32Array) => {
    const snapshot = Array.from(data.slice(0, 128));
    chunkSnapshotsRef.current.push(snapshot);
    if (chunkSnapshotsRef.current.length > 60) {
      chunkSnapshotsRef.current = chunkSnapshotsRef.current.slice(-30);
    }
  }, []);

  const displayedTranscript = useTypewriter(transcript, 3, 16);

  const createSessionMutation = useMutation({
    mutationFn: async (data: { title: string; clientName?: string }) => {
      const res = await apiRequest("POST", "/api/sessions", data);
      return res.json();
    },
    onSuccess: (session: Session) => {
      setActiveSession(session);
      queryClient.invalidateQueries({ queryKey: ["/api/sessions"] });
    },
  });

  const endSessionMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest("PATCH", `/api/sessions/${id}/end`);
      return res.json();
    },
    onSuccess: (_data, id) => {
      setActiveSession(null);
      setTranscript("");
      setNewTopicIds(new Set());
      setSentimentData([]);
      setBantData(null);
      setMethodologyProgress(null);
      setOverallSentiment(0);
      setActionItems([]);
      setFollowUpQuestions([]);
      setLiveSpeakers([]);
      setSimilarProjects([]);
      queryClient.invalidateQueries({ queryKey: ["/api/sessions"] });
      navigate(`/sessions/${id}`);
    },
  });

  const handleAnalysisResponse = useCallback(async (data: any) => {
    if (data.transcript) {
      setTranscript(prev => prev ? prev + "\n\n" + data.transcript : data.transcript);
    }

    const applyAiUpdates = async () => {
      if (data.sentiment) {
        setSentimentData(prev => [...prev, {
          chunkIndex: prev.length,
          score: data.sentiment.score,
          label: data.sentiment.label,
          speaker: data.speaker || undefined,
        }]);
        if (data.overallSentiment !== undefined) {
          setOverallSentiment(data.overallSentiment);
        }
      }

      if (data.actionItems && data.actionItems.length > 0) {
        setActionItems(prev => [...prev, ...data.actionItems]);
      }

      if (data.followUpQuestions && data.followUpQuestions.length > 0) {
        setFollowUpQuestions(data.followUpQuestions);
      }

      if (data.speakers) {
        setLiveSpeakers(data.speakers);
      }

      if (data.similarProjects && data.similarProjects.length > 0) {
        setSimilarProjects(prev => {
          const existingIds = new Set(prev.map(p => p.projectId));
          const newMatches = data.similarProjects.filter(
            (p: SimilarProjectMatch) => !existingIds.has(p.projectId)
          );
          return [...prev, ...newMatches];
        });
      }

      if (data.bantData) {
        setBantData(data.bantData);
      }

      if (data.methodologyProgress) {
        setMethodologyProgress(data.methodologyProgress);
      }

      if (data.newTopics && data.newTopics.length > 0) {
        await refetchTopics();
        const newIds = new Set(
          data.allTopics
            ?.filter((t: Topic) => data.newTopics.some((nt: { term: string }) => nt.term === t.term))
            .map((t: Topic) => t.id) || []
        );
        setNewTopicIds(prev => new Set([...prev, ...newIds]));

        setTimeout(() => {
          setNewTopicIds(prev => {
            const next = new Set(prev);
            newIds.forEach((id: number) => next.delete(id));
            return next;
          });
        }, 4000);
      } else if (data.updatedTopics && data.updatedTopics.length > 0) {
        await refetchTopics();
      }
    };

    if (isDemoRunningRef.current) {
      setTimeout(() => {
        if (isDemoRunningRef.current || activeSessionRef.current) {
          applyAiUpdates();
        }
      }, 4000);
    } else {
      await applyAiUpdates();
    }
  }, [refetchTopics]);

  const isMutedRef = useRef(false);
  useEffect(() => {
    isMutedRef.current = isMuted;
  }, [isMuted]);

  const enableActionItemsRef = useRef(enableActionItems);
  useEffect(() => {
    enableActionItemsRef.current = enableActionItems;
  }, [enableActionItems]);

  const enableFollowUpQuestionsRef = useRef(enableFollowUpQuestions);
  useEffect(() => {
    enableFollowUpQuestionsRef.current = enableFollowUpQuestions;
  }, [enableFollowUpQuestions]);

  const handleAnalysisResponseRef = useRef(handleAnalysisResponse);
  useEffect(() => {
    handleAnalysisResponseRef.current = handleAnalysisResponse;
  }, [handleAnalysisResponse]);

  const sendAudioChunk = useCallback(async (blob: Blob) => {
    const session = activeSessionRef.current;
    if (!session || isMutedRef.current || processingRef.current) return;

    processingRef.current = true;
    setIsProcessing(true);

    const snapshots = [...chunkSnapshotsRef.current];
    chunkSnapshotsRef.current = [];

    const speakerHint = matchSpeaker(snapshots, voiceProfilesRef.current);

    try {
      const base64 = await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onload = () => {
          const result = reader.result as string;
          resolve(result.split(",")[1]);
        };
        reader.readAsDataURL(blob);
      });

      const res = await apiRequest("POST", `/api/sessions/${session.id}/analyze`, {
        audio: base64,
        features: {
          actionItems: enableActionItemsRef.current,
          followUpQuestions: enableFollowUpQuestionsRef.current,
          similarProjects: true,
        },
        ...(speakerHint ? {
          voiceMatch: {
            name: speakerHint.profileName,
            title: speakerHint.profileTitle,
            confidence: speakerHint.confidence,
          },
        } : {}),
      });

      const data = await res.json();
      await handleAnalysisResponseRef.current(data);
    } catch (error) {
      console.error("Failed to analyze audio:", error);
      toast({
        title: "Analysis failed",
        description: "Could not process audio. Will retry on next chunk.",
        variant: "destructive",
      });
    } finally {
      processingRef.current = false;
      setIsProcessing(false);
    }
  }, [toast]);

  const audioCapture = useAudioCapture({ intervalMs: 6000, deviceId: selectedMicId || undefined, onFrequencyData: onLiveFrequencyData });

  const cleanupDemoProjectsRef = useRef<() => Promise<void>>(() => Promise.resolve());

  const processDemoChunk = useCallback(async (session: Session, chunkIdx: number) => {
    const chunks = demoChunksRef.current;
    if (chunkIdx >= chunks.length) {
      setIsDemoRunning(false);
      setIsProcessing(false);
      if (demoAnimationRef.current) {
        clearInterval(demoAnimationRef.current);
        demoAnimationRef.current = null;
      }
      setDemoAudioLevel(0);
      toast({ title: "Demo complete", description: "All meeting dialogue has been processed." });
      return;
    }

    const chunk = chunks[chunkIdx];
    setIsProcessing(true);

    try {
      const res = await apiRequest("POST", `/api/sessions/${session.id}/demo-analyze`, {
        text: chunk,
        features: {
          actionItems: enableActionItems,
          followUpQuestions: enableFollowUpQuestions,
          similarProjects: true,
        },
      });

      const data = await res.json();
      await handleAnalysisResponse(data);

      setIsProcessing(false);
      const nextIdx = chunkIdx + 1;
      setDemoChunkIndex(nextIdx);

      if (nextIdx < demoChunksRef.current.length) {
        demoTimerRef.current = setTimeout(() => {
          processDemoChunk(session, nextIdx);
        }, 2000);
      } else {
        setIsDemoRunning(false);
        if (demoAnimationRef.current) {
          clearInterval(demoAnimationRef.current);
          demoAnimationRef.current = null;
        }
        setDemoAudioLevel(0);
        toast({ title: "Demo complete", description: "All meeting dialogue has been processed." });
      }
    } catch (error) {
      console.error("Demo chunk failed:", error);
      setIsProcessing(false);
      const nextIdx = chunkIdx + 1;
      setDemoChunkIndex(nextIdx);
      demoTimerRef.current = setTimeout(() => {
        processDemoChunk(session, nextIdx);
      }, 2000);
    }
  }, [handleAnalysisResponse, toast, enableActionItems, enableFollowUpQuestions]);

  const handleStartSession = async () => {
    try {
      const session = await createSessionMutation.mutateAsync({
        title: sessionTitle,
        clientName: clientName || undefined,
        industry: industry || undefined,
      });
      await audioCapture.startCapture(sendAudioChunk);
      setIsListening(true);
    } catch (error) {
      toast({
        title: "Failed to start session",
        description: "Please make sure your microphone is accessible.",
        variant: "destructive",
      });
    }
  };

  const cleanupDemoProjects = useCallback(async () => {
    for (const id of demoProjectIdsRef.current) {
      try {
        await apiRequest("DELETE", `/api/reference-projects/${id}`);
      } catch {}
    }
    demoProjectIdsRef.current = [];
    queryClient.invalidateQueries({ queryKey: ["/api/reference-projects"] });
  }, []);

  useEffect(() => {
    cleanupDemoProjectsRef.current = cleanupDemoProjects;
  }, [cleanupDemoProjects]);

  const handleStartDemo = async () => {
    try {
      const isAE = settings?.hostRole === "account-executive";

      if (isAE) {
        demoChunksRef.current = AE_DEMO_CHUNKS;
        demoProjectIdsRef.current = [];
      } else {
        demoChunksRef.current = DEMO_CHUNKS;
        const createdIds: number[] = [];
        for (const project of DEMO_REFERENCE_PROJECTS) {
          try {
            const res = await apiRequest("POST", "/api/reference-projects", project);
            const created = await res.json();
            createdIds.push(created.id);
          } catch {}
        }
        demoProjectIdsRef.current = createdIds;
        queryClient.invalidateQueries({ queryKey: ["/api/reference-projects"] });
      }

      const session = await createSessionMutation.mutateAsync(
        isAE
          ? { title: "Demo: Sales Discovery — Meridian Financial", clientName: "Meridian Financial", industry: "Financial Services" }
          : { title: "Demo: Cloud Migration Review", clientName: "Contoso Ltd" }
      );
      setIsListening(true);
      setIsDemoRunning(true);
      setDemoChunkIndex(0);
      setTranscript("");
      setSentimentData([]);
      setOverallSentiment(0);
      setActionItems([]);
      setFollowUpQuestions([]);
      setSimilarProjects([]);
      setBantData(null);
      setMethodologyProgress(null);

      demoAnimationRef.current = setInterval(() => {
        setDemoAudioLevel(Math.random() * 0.6 + 0.2);
      }, 150);

      setTimeout(() => {
        processDemoChunk(session, 0);
      }, 1000);
    } catch (error) {
      toast({
        title: "Failed to start demo",
        description: "Could not create demo session.",
        variant: "destructive",
      });
    }
  };

  const handleStopSession = () => {
    const wasDemo = isDemoRunning;
    if (isDemoRunning) {
      if (demoTimerRef.current) {
        clearTimeout(demoTimerRef.current);
        demoTimerRef.current = null;
      }
      if (demoAnimationRef.current) {
        clearInterval(demoAnimationRef.current);
        demoAnimationRef.current = null;
      }
      setIsDemoRunning(false);
      setDemoAudioLevel(0);
      setDemoChunkIndex(0);
    } else {
      audioCapture.stopCapture();
    }
    setIsListening(false);
    if (activeSession) {
      endSessionMutation.mutate(activeSession.id, {
        onSettled: () => {
          if (wasDemo) {
            cleanupDemoProjects();
          }
        }
      });
    } else if (wasDemo) {
      cleanupDemoProjects();
    }
  };

  useEffect(() => {
    return () => {
      audioCapture.stopCapture();
      if (demoTimerRef.current) clearTimeout(demoTimerRef.current);
      if (demoAnimationRef.current) clearInterval(demoAnimationRef.current);
      cleanupDemoProjectsRef.current();
    };
  }, []);

  useEffect(() => {
    transcriptEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [displayedTranscript]);

  const consolidatedProjects = consolidateSimilarProjects(similarProjects);
  const toolCount = topics.filter(t => t.type === "tool").length;
  const conceptCount = topics.filter(t => t.type === "concept").length;
  const industryCount = topics.filter(t => t.type === "industry").length;

  const toolTopics = topics.filter(t => t.type === "tool");
  const conceptTopics = topics.filter(t => t.type === "concept");
  const industryTopics = topics.filter(t => t.type === "industry");

  if (!activeSession) {
    return (
      <div className="flex flex-col h-full">
        <div className="border-b border-border bg-background/80 backdrop-blur-sm sticky top-0 z-10">
          <div className="flex items-center gap-3 p-4">
            <Podcast className="h-5 w-5 text-primary" />
            <h1 className="text-lg font-semibold" data-testid="text-page-title">New Episode</h1>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
        <div className="flex flex-col items-center justify-center gap-6 p-8 min-h-full">
          <AudioVisualizer level={0} isActive={false} size={120} />
          <div className="text-center max-w-md">
            <h2 className="text-xl font-semibold mb-2">Ready to Record</h2>
            <p className="text-sm text-muted-foreground">
              Go live to capture key IT terms and insights in real-time during your meetings.
            </p>
          </div>

          <div className="w-full max-w-sm space-y-3">
            <Input
              placeholder="Episode title..."
              value={sessionTitle}
              onChange={(e) => setSessionTitle(e.target.value)}
              onFocus={() => { if (sessionTitle === "New Episode") setSessionTitle(""); }}
              onBlur={() => { if (!sessionTitle.trim()) setSessionTitle("New Episode"); }}
              data-testid="input-session-title"
            />
            <div className="relative">
              <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                placeholder="Guest / client name (optional)"
                value={clientName}
                onChange={(e) => setClientName(e.target.value)}
                className="pl-9"
                data-testid="input-client-name"
              />
            </div>

            <Select value={industry} onValueChange={setIndustry}>
              <SelectTrigger className="h-9 text-sm" data-testid="select-industry">
                <SelectValue placeholder="Industry (optional)" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="healthcare">Healthcare</SelectItem>
                <SelectItem value="finance">Finance / Banking</SelectItem>
                <SelectItem value="retail">Retail / E-Commerce</SelectItem>
                <SelectItem value="manufacturing">Manufacturing</SelectItem>
                <SelectItem value="technology">Technology</SelectItem>
                <SelectItem value="telecom">Telecom</SelectItem>
                <SelectItem value="government">Government</SelectItem>
                <SelectItem value="education">Education</SelectItem>
                <SelectItem value="energy">Energy / Utilities</SelectItem>
                <SelectItem value="media">Media / Entertainment</SelectItem>
                <SelectItem value="other">Other</SelectItem>
              </SelectContent>
            </Select>

            <MicrophoneSelector
              selectedDeviceId={selectedMicId}
              onDeviceChange={setSelectedMicId}
            />

            <Card className="p-3">
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">Show Features</p>
              <div className="flex items-center gap-4">
                <label className="flex items-center gap-2 cursor-pointer flex-1">
                  <Switch
                    checked={enableActionItems}
                    onCheckedChange={setEnableActionItems}
                    data-testid="toggle-action-items"
                  />
                  <span className="text-xs">Action Items</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer flex-1">
                  <Switch
                    checked={enableFollowUpQuestions}
                    onCheckedChange={setEnableFollowUpQuestions}
                    data-testid="toggle-follow-up-questions"
                  />
                  <span className="text-xs">Follow-Ups</span>
                </label>
              </div>
            </Card>

            <Button
              onClick={handleStartSession}
              disabled={createSessionMutation.isPending}
              className="w-full"
              data-testid="button-start-session"
            >
              {createSessionMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Radio className="h-4 w-4 mr-2" />
              )}
              Go Live
            </Button>

            <div className="relative flex items-center gap-3">
              <div className="flex-1 h-px bg-border" />
              <span className="text-xs text-muted-foreground">or</span>
              <div className="flex-1 h-px bg-border" />
            </div>

            <Button
              variant="outline"
              onClick={handleStartDemo}
              disabled={createSessionMutation.isPending}
              className="w-full"
              data-testid="button-start-demo"
            >
              <Play className="h-4 w-4 mr-2" />
              Demo Tape
            </Button>
            <p className="text-[10px] text-muted-foreground text-center leading-relaxed">
              Plays a sample episode of a cloud migration meeting with AI-powered analysis. No mic needed.
            </p>
          </div>
        </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div className="border-b border-border bg-background/80 backdrop-blur-sm shrink-0 z-10">
        <div className="px-4 py-3">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <AudioVisualizer
                level={isDemoRunning ? demoAudioLevel : (isMuted ? 0 : audioCapture.audioLevel)}
                isActive={isListening && (!isMuted || isDemoRunning)}
                size={36}
              />
              <div className="min-w-0">
                <h1 className="text-base font-semibold truncate" data-testid="text-page-title">
                  {activeSession.title}
                </h1>
              </div>
              {isDemoRunning && (
                <Badge variant="secondary" className="text-[10px] bg-amber-500/10 text-amber-600 dark:text-amber-400 shrink-0">
                  DEMO
                </Badge>
              )}
            </div>

            <div className="flex items-center gap-2 shrink-0">
              {isProcessing && (
                <Badge variant="secondary" className="gap-1 text-[10px]">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  Analyzing
                </Badge>
              )}
              {isDemoRunning && (
                <Badge variant="secondary" className="text-[10px] tabular-nums">
                  {demoChunkIndex}/{demoChunksRef.current.length}
                </Badge>
              )}
              {isListening && !isDemoRunning && (
                <Button
                  size="sm"
                  variant={isMuted ? "destructive" : "ghost"}
                  onClick={() => setIsMuted(!isMuted)}
                  className="h-7 text-xs"
                  data-testid="button-mute-toggle"
                >
                  {isMuted ? <MicOff className="h-3.5 w-3.5 mr-1" /> : <Mic className="h-3.5 w-3.5 mr-1" />}
                  {isMuted ? "Muted" : "On Air"}
                </Button>
              )}
              <Button
                variant="destructive"
                size="sm"
                onClick={handleStopSession}
                className="h-7 text-xs"
                data-testid="button-stop-session"
              >
                <Square className="h-3 w-3 mr-1" />
                Wrap Up
              </Button>
            </div>
          </div>

          <div className="flex items-center gap-2 mt-2 ml-12 flex-wrap">
            {sentimentData.length > 0 && (
              <div className="hidden md:block">
                <SentimentEqualizer
                  sentimentData={sentimentData}
                  overallSentiment={overallSentiment}
                  sessionStart={activeSession.createdAt}
                />
              </div>
            )}
            {activeSession.clientName && (
              <span className="flex items-center gap-1 text-xs text-primary font-medium">
                <Building2 className="h-3 w-3" />
                {activeSession.clientName}
              </span>
            )}
            {activeSession.industry && (
              <Badge variant="outline" className="text-[11px] h-5 gap-1">
                <Factory className="h-3 w-3" />
                {activeSession.industry}
              </Badge>
            )}
            {liveSpeakers.length > 0 && (() => {
              const hosts = liveSpeakers.filter(s => s.role === "host");
              const guests = liveSpeakers.filter(s => s.role !== "host");
              const orderedSpeakers = [...hosts, ...guests];
              return (
              <span className="flex items-center gap-1.5 text-xs text-muted-foreground" data-testid="text-live-speakers">
                <Users className="h-3 w-3" />
                {orderedSpeakers.map((s, i) => {
                  const originalIndex = liveSpeakers.indexOf(s);
                  const color = getSpeakerColorByIndex(originalIndex);
                  return (
                    <span key={originalIndex}>
                      {i > 0 && <span className="mx-0.5">·</span>}
                      <span className={`font-medium ${color.text}`}>{s.name}</span>
                      {s.title && <span className="text-muted-foreground/70 ml-0.5">({s.title})</span>}
                      {s.role === "host" && <Badge variant="outline" className="text-[8px] h-3 px-1 ml-0.5 border-primary/40 text-primary">Host</Badge>}
                    </span>
                  );
                })}
              </span>
              );
            })()}
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-hidden flex flex-col">

        {/* AE-mode pinned top row: Sales Questions | BANT | Sales Methodology */}
        {isAEMode && (
          <div className="shrink-0 grid grid-cols-3 border-b border-border">

            {/* Sales Questions */}
            <div className="flex flex-col border-r border-border overflow-hidden" data-testid="column-followups-ae">
              <div className="px-3 py-2 border-b border-border flex items-center gap-2 bg-card/50 shrink-0">
                <HelpCircle className="h-3.5 w-3.5 text-amber-500" />
                <span className="text-xs font-semibold">Sales Questions</span>
                {settings?.salesMethodology && (
                  <Badge variant="outline" className="text-[9px] h-4 px-1.5 border-primary/40 text-primary font-medium">
                    {METHODOLOGY_LABELS[settings.salesMethodology as string] ?? settings.salesMethodology}
                  </Badge>
                )}
                <Switch
                  checked={enableFollowUpQuestions}
                  onCheckedChange={setEnableFollowUpQuestions}
                  className="scale-[0.6] ml-auto"
                  onClick={(e: React.MouseEvent) => e.stopPropagation()}
                  onPointerDown={(e: React.PointerEvent) => e.stopPropagation()}
                  data-testid="toggle-follow-up-inline"
                />
              </div>
              <div className="overflow-y-auto">
                <div className="p-2">
                  {enableFollowUpQuestions ? (
                    followUpQuestions.length > 0 ? (
                      <FollowUpQuestionsPanel questions={followUpQuestions} />
                    ) : (
                      <div className="flex flex-col items-center justify-center py-8 text-center px-3">
                        <HelpCircle className="h-5 w-5 text-muted-foreground/20 mb-2" />
                        <p className="text-xs text-muted-foreground">Sales questions will appear as the call progresses.</p>
                      </div>
                    )
                  ) : (
                    <div className="flex flex-col items-center justify-center py-8 text-center px-3">
                      <HelpCircle className="h-5 w-5 text-muted-foreground/10 mb-2" />
                      <p className="text-xs text-muted-foreground">Follow-up questions are disabled. Toggle on above.</p>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* BANT Qualification */}
            <div className="flex flex-col border-r border-border" data-testid="column-bant-ae">
              <div className="px-3 py-2 border-b border-border flex items-center gap-2 bg-card/50 shrink-0">
                <Target className="h-3.5 w-3.5 text-primary" />
                <span className="text-xs font-semibold">BANT Qualification</span>
                <Badge variant="secondary" className="text-[10px] h-4 px-1.5">
                  {bantData ? Object.values(bantData).filter(Boolean).length : 0}/4
                </Badge>
              </div>
              <div className="p-2 space-y-1.5">
                <div className="flex items-center gap-2 mb-1">
                  <div className="flex gap-0.5 flex-1">
                    {BANT_KEYS.map(({ key }) => (
                      <div key={key} className={`h-1.5 flex-1 rounded-full transition-colors duration-500 ${bantData?.[key] ? "bg-emerald-500" : "bg-muted"}`} />
                    ))}
                  </div>
                  <span className="text-[10px] text-muted-foreground tabular-nums">
                    {bantData ? Object.values(bantData).filter(Boolean).length : 0}/4
                  </span>
                </div>
                {BANT_KEYS.map(({ key, label, icon: Icon, color }) => {
                  const field = bantData?.[key];
                  return (
                    <div
                      key={key}
                      data-testid={`card-bant-${key}`}
                      className={`rounded-md border p-2 transition-all duration-500 ${field ? "border-emerald-200 bg-emerald-50/60 dark:border-emerald-800 dark:bg-emerald-950/20" : "border-border bg-muted/10"}`}
                    >
                      <div className="flex items-center gap-1.5 mb-0.5">
                        <Icon className={`h-3 w-3 shrink-0 ${field ? color : "text-muted-foreground/30"}`} />
                        <span className={`text-[10px] font-semibold ${field ? "text-foreground" : "text-muted-foreground/50"}`}>{label}</span>
                        {field && <CheckCircle2 className="h-2.5 w-2.5 text-emerald-500 ml-auto shrink-0" />}
                      </div>
                      {field ? (
                        <>
                          <p className="text-[10px] font-medium text-foreground leading-tight" data-testid={`text-bant-${key}-value`}>{field.value}</p>
                          {field.evidence && (
                            <p className="text-[9px] text-muted-foreground italic mt-0.5 leading-tight">"{field.evidence}"</p>
                          )}
                          {field.history.length > 0 && (
                            <p className="text-[9px] text-muted-foreground/40 mt-0.5">Was: {field.history[0].value}</p>
                          )}
                        </>
                      ) : (
                        <p className="text-[9px] text-muted-foreground/35 leading-tight">Listening for signal...</p>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Sales Methodology */}
            <div className="flex flex-col" data-testid="column-methodology-ae">
              <div className="px-3 py-2 border-b border-border flex items-center gap-2 bg-card/50 shrink-0">
                <TrendingUp className="h-3.5 w-3.5 text-primary" />
                <span className="text-xs font-semibold">Sales Methodology</span>
                {(methodologyProgress || settings?.salesMethodology) && (
                  <span className="text-[10px] text-muted-foreground ml-auto truncate max-w-[80px]">
                    {METHODOLOGY_LABELS[(methodologyProgress?.methodology ?? settings?.salesMethodology) as string] ?? ""}
                  </span>
                )}
              </div>
              <div className="p-2">
                {(methodologyProgress || settings?.salesMethodology) ? (
                  methodologyProgress ? (
                    <div className="space-y-1">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                          {METHODOLOGY_LABELS[methodologyProgress.methodology] ?? methodologyProgress.methodology}
                        </span>
                        <span className="text-[10px] text-muted-foreground tabular-nums" data-testid="text-methodology-progress">
                          {methodologyProgress.stages.filter(s => s.completed).length}/{methodologyProgress.stages.length}
                        </span>
                      </div>
                      {methodologyProgress.stages.map(stage => (
                        <div
                          key={stage.id}
                          className={`flex items-center gap-1.5 transition-all duration-300 ${stage.completed ? "opacity-100" : "opacity-40"}`}
                          data-testid={`stage-${stage.id}`}
                        >
                          {stage.completed
                            ? <CheckCircle2 className="h-3 w-3 text-emerald-500 shrink-0" />
                            : <Circle className="h-3 w-3 text-muted-foreground shrink-0" />}
                          <span className={`text-[10px] ${stage.completed ? "font-medium text-foreground" : "text-muted-foreground"}`}>
                            {stage.name}
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div>
                      <p className="text-[10px] font-semibold text-foreground mb-1">
                        {METHODOLOGY_LABELS[settings?.salesMethodology as string] ?? settings?.salesMethodology}
                      </p>
                      <p className="text-[9px] text-muted-foreground/50">Stages will appear as analysis progresses.</p>
                    </div>
                  )
                ) : (
                  <div className="flex flex-col items-center justify-center py-6 text-center px-3">
                    <TrendingUp className="h-5 w-5 text-muted-foreground/20 mb-2" />
                    <p className="text-xs text-muted-foreground">No methodology selected.</p>
                    <p className="text-[10px] text-muted-foreground/60 mt-0.5">Configure in Studio Settings.</p>
                  </div>
                )}
              </div>
            </div>

          </div>
        )}

        <ReorderableColumns
          storageKey={isAEMode ? "dashboard-grid-ae" : "dashboard-grid"}
          rows={2}
          columns={[
            {
              id: "transcript",
              header: (
                <>
                  <BookOpen className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="text-xs font-semibold">Transcript</span>
                </>
              ),
              content: (
                <ScrollArea className="flex-1">
                  <div className="p-3">
                    {displayedTranscript ? (
                      <div>
                        <HighlightedTranscript text={displayedTranscript} topics={topics} />
                        <div ref={transcriptEndRef} />
                      </div>
                    ) : (
                      <div className="flex flex-col items-center justify-center py-16 text-center">
                        {isDemoRunning ? (
                          <>
                            <Loader2 className="h-6 w-6 text-muted-foreground/30 mb-2 animate-spin" />
                            <p className="text-xs text-muted-foreground">Starting demo...</p>
                          </>
                        ) : (
                          <>
                            <Mic className="h-6 w-6 text-muted-foreground/20 mb-2" />
                            <p className="text-xs text-muted-foreground">
                              {isMuted ? "Microphone muted" : "Listening..."}
                            </p>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                </ScrollArea>
              ),
            },
            {
              id: "topics",
              header: (
                <>
                  <AlertCircle className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="text-xs font-semibold">Topics</span>
                  {topics.length > 0 && (
                    <Badge variant="secondary" className="text-[10px] h-4 px-1.5">{topics.length}</Badge>
                  )}
                  {topics.length > 0 && (
                    <span className="text-[9px] text-muted-foreground ml-auto">
                      {toolCount}T {conceptCount}C{industryCount > 0 ? ` ${industryCount}I` : ""}
                    </span>
                  )}
                </>
              ),
              content: (
                <ScrollArea className="flex-1">
                  <div className="p-2 space-y-1.5">
                    {topics.length === 0 ? (
                      <div className="flex flex-col items-center justify-center py-16 text-center px-3">
                        <AlertCircle className="h-6 w-6 text-muted-foreground/20 mb-2" />
                        <p className="text-xs text-muted-foreground">
                          {isDemoRunning
                            ? "Terms appear as the conversation plays..."
                            : "IT terms will appear here as detected."}
                        </p>
                      </div>
                    ) : (
                      <DashboardTopicGroups
                        toolTopics={toolTopics}
                        conceptTopics={conceptTopics}
                        industryTopics={industryTopics}
                        newTopicIds={newTopicIds}
                        sessionId={activeSession?.id}
                      />
                    )}
                  </div>
                </ScrollArea>
              ),
            },
            {
              id: "followups",
              header: (
                <>
                  <HelpCircle className="h-3.5 w-3.5 text-amber-500" />
                  <span className="text-xs font-semibold">{isAEMode ? "Sales Questions" : "Follow-Up Questions"}</span>
                  {isAEMode && settings?.salesMethodology && (
                    <Badge variant="outline" className="text-[9px] h-4 px-1.5 border-primary/40 text-primary font-medium">
                      {METHODOLOGY_LABELS[settings.salesMethodology as string] ?? settings.salesMethodology}
                    </Badge>
                  )}
                  <Switch
                    checked={enableFollowUpQuestions}
                    onCheckedChange={setEnableFollowUpQuestions}
                    className="scale-[0.6] ml-auto"
                    onClick={(e: React.MouseEvent) => e.stopPropagation()}
                    onPointerDown={(e: React.PointerEvent) => e.stopPropagation()}
                    data-testid="toggle-follow-up-inline"
                  />
                </>
              ),
              content: (
                <ScrollArea className="flex-1">
                  <div className="p-2">
                    {enableFollowUpQuestions ? (
                      followUpQuestions.length > 0 ? (
                        <FollowUpQuestionsPanel questions={followUpQuestions} />
                      ) : (
                        <div className="flex flex-col items-center justify-center py-16 text-center px-3">
                          <HelpCircle className="h-6 w-6 text-muted-foreground/20 mb-2" />
                          <p className="text-xs text-muted-foreground">
                            PreSales questions will appear here based on the conversation.
                          </p>
                        </div>
                      )
                    ) : (
                      <div className="flex flex-col items-center justify-center py-16 text-center px-3">
                        <HelpCircle className="h-6 w-6 text-muted-foreground/10 mb-2" />
                        <p className="text-xs text-muted-foreground">
                          Follow-up questions are disabled. Toggle on above.
                        </p>
                      </div>
                    )}
                  </div>
                </ScrollArea>
              ),
            },
            {
              id: "sentiment",
              header: (
                <>
                  <BarChart3 className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="text-xs font-semibold">Sentiment</span>
                  {sentimentData.length > 0 && (
                    <Badge variant="secondary" className="text-[10px] h-4 px-1.5">{sentimentData.length}</Badge>
                  )}
                </>
              ),
              content: (
                <ScrollArea className="flex-1">
                  <div className="p-2">
                    {sentimentData.length > 0 ? (
                      <SentimentEqualizerFull
                        sentimentData={sentimentData}
                        overallSentiment={overallSentiment}
                        sessionStart={activeSession.createdAt}
                      />
                    ) : (
                      <div className="flex flex-col items-center justify-center py-16 text-center px-3">
                        <BarChart3 className="h-6 w-6 text-muted-foreground/20 mb-2" />
                        <p className="text-xs text-muted-foreground">
                          Sentiment analysis will appear here as the conversation progresses.
                        </p>
                      </div>
                    )}
                  </div>
                </ScrollArea>
              ),
            },
            {
              id: "actionitems",
              header: (
                <>
                  <ClipboardList className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="text-xs font-semibold">Action Items</span>
                  {actionItems.length > 0 && (
                    <Badge variant="secondary" className="text-[10px] h-4 px-1.5">{actionItems.length}</Badge>
                  )}
                  <Switch
                    checked={enableActionItems}
                    onCheckedChange={setEnableActionItems}
                    className="scale-[0.6] ml-auto"
                    onClick={(e: React.MouseEvent) => e.stopPropagation()}
                    onPointerDown={(e: React.PointerEvent) => e.stopPropagation()}
                    data-testid="toggle-action-items-inline"
                  />
                </>
              ),
              content: (
                <ScrollArea className="flex-1">
                  <div className="p-2">
                    {enableActionItems ? (
                      actionItems.length > 0 ? (
                        <ActionItemsPanel items={actionItems} compact />
                      ) : (
                        <div className="flex flex-col items-center justify-center py-16 text-center px-3">
                          <ClipboardList className="h-6 w-6 text-muted-foreground/20 mb-2" />
                          <p className="text-xs text-muted-foreground">
                            Action items will appear here as they're detected in the conversation.
                          </p>
                        </div>
                      )
                    ) : (
                      <div className="flex flex-col items-center justify-center py-16 text-center px-3">
                        <ClipboardList className="h-6 w-6 text-muted-foreground/10 mb-2" />
                        <p className="text-xs text-muted-foreground">
                          Action items are disabled. Toggle on above.
                        </p>
                      </div>
                    )}
                  </div>
                </ScrollArea>
              ),
            },
            {
              id: "similarprojects",
              header: (
                <>
                  <FolderOpen className="h-3.5 w-3.5 text-emerald-500" />
                  <span className="text-xs font-semibold">Similar Projects</span>
                  {consolidatedProjects.length > 0 && (
                    <Badge variant="secondary" className="text-[10px] h-4 px-1.5">{consolidatedProjects.length}</Badge>
                  )}
                </>
              ),
              content: (
                <ScrollArea className="flex-1">
                  <div className="p-2 space-y-2">
                    {consolidatedProjects.length > 0 ? (
                      consolidatedProjects.map((match) => {
                        const project = referenceProjectsList.find(p => p.id === match.projectId);
                        const title = match.title || project?.title || `Project #${match.projectId}`;
                        const industry = match.industry || project?.industry;
                        const clientName = match.clientName || project?.clientName;
                        const projectDate = match.projectDate || project?.projectDate;
                        const url = project?.url;
                        const tags = project?.tags;
                        return (
                          <div key={match.projectId} className="rounded-md border border-border bg-background p-2" data-testid={`card-similar-project-${match.projectId}`}>
                            <div className="flex items-start justify-between gap-2">
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-1.5">
                                  <span className="text-xs font-semibold truncate" data-testid={`text-project-title-${match.projectId}`}>{title}</span>
                                  {url && (
                                    <a href={url} target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-foreground shrink-0" data-testid={`link-project-${match.projectId}`}>
                                      <ExternalLink className="h-3 w-3" />
                                    </a>
                                  )}
                                </div>
                                <span className="text-[10px] text-muted-foreground">
                                  {industry && <>{industry}{clientName ? ` · ${clientName}` : ""}</>}
                                  {projectDate && (
                                    <>{industry ? " · " : ""}{new Date(projectDate).toLocaleDateString("en-US", { year: "numeric", month: "short" })}</>
                                  )}
                                </span>
                                <p className="text-[10px] text-emerald-600 dark:text-emerald-400 mt-0.5 italic" data-testid={`text-project-relevance-${match.projectId}`}>{match.relevance}</p>
                              </div>
                            </div>
                            {tags && tags.length > 0 && (
                              <div className="flex flex-wrap gap-1 mt-1">
                                {tags.slice(0, 5).map((tag) => (
                                  <Badge key={tag} variant="outline" className="text-[9px] h-3.5 px-1">{tag}</Badge>
                                ))}
                              </div>
                            )}
                          </div>
                        );
                      })
                    ) : (
                      <div className="flex flex-col items-center justify-center py-16 text-center px-3">
                        <FolderOpen className="h-6 w-6 text-muted-foreground/20 mb-2" />
                        <p className="text-xs text-muted-foreground">
                          Similar projects from your reference library will appear here as topics are detected.
                        </p>
                      </div>
                    )}
                  </div>
                </ScrollArea>
              ),
            },
          ].filter(col => !isAEMode || col.id !== "followups")
           .sort((a, b) => {
            if (!isAEMode) return 0;
            const aeOrder = ["similarprojects", "transcript", "sentiment", "actionitems", "topics"];
            return aeOrder.indexOf(a.id) - aeOrder.indexOf(b.id);
          })}
        />
      </div>
    </div>
  );
}
