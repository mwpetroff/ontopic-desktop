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
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AudioVisualizer } from "@/components/audio-visualizer";
import { MicrophoneSelector } from "@/components/microphone-selector";
import { TopicCard } from "@/components/topic-card";
import { useAudioCapture } from "@/hooks/use-audio-capture";
import { useToast } from "@/hooks/use-toast";
import { HighlightedTranscript } from "@/components/highlighted-transcript";
import { SentimentEqualizer, SentimentEqualizerFull } from "@/components/sentiment-equalizer";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { ActionItemsPanel } from "@/components/action-items-panel";
import { FollowUpQuestionsPanel } from "@/components/follow-up-questions-panel";
import { SipocBoard } from "@/components/sipoc-board";
import {
  Activity, Square, Mic, MicOff, Loader2, AlertCircle, BookOpen,
  Play, ClipboardList, HelpCircle, Building2,
  Wrench, Lightbulb, Factory, Users, BarChart3, FolderOpen, ExternalLink,
  DollarSign, UserCheck, Target, Clock, CheckCircle2, Circle, TrendingUp,
  Key, Speaker, X, Briefcase, ShieldAlert, CalendarClock, AlertTriangle,
  ListChecks, Siren, Layers, Database, Server, Lock, Plug, Cpu, FileText
} from "lucide-react";
import { getSpeakerColorByIndex } from "@/lib/speaker-colors";
import { matchSpeaker } from "@/lib/speaker-match";
import type { Session, Topic, VoiceProfile, SentimentEntry, ActionItem, FollowUpQuestion, SpeakerEntry, SimilarProjectMatch, ReferenceProject, BANTData, MethodologyProgress, CompetitorMention, TimelineSignal, RiskFlag, Requirement, PainPoint, SIPOCData } from "@shared/schema";
import { consolidateSimilarProjects } from "@shared/schema";
import { METHODOLOGY_LABELS } from "@shared/methodologies";
import { useSettings } from "@/hooks/use-settings";

async function pollAnalysisJob(sessionId: number, jobId: string): Promise<unknown> {
  // 100 ms is safe for a loopback server (Electron or localhost dev).
  // The job store is in-memory so reads are near-instant — the only real
  // latency is OpenAI round-trip time, which we can't speed up.
  for (;;) {
    await new Promise(r => setTimeout(r, 100));
    const res = await apiRequest("GET", `/api/sessions/${sessionId}/jobs/${jobId}`);
    const job = await res.json() as { status: string; result?: unknown; error?: string };
    if (job.status === "done") return job.result;
    if (job.status === "error") throw new Error(job.error || "Analysis failed");
  }
}

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
  "Good morning Jennifer, Raj — thank you both for making the time today. I'm Alex Park, PreSales Architect at NRI North America. Before we dive in, I want to let my colleague introduce himself, and then we'd love to hear from your side as well. Our plan for today is introductions, then we'll spend most of our time understanding Meridian's current landscape and where you're looking to go. Does that agenda work for everyone?",
  "Thanks Alex. Hi everyone, I'm David Chen, Account Executive at NRI. I cover financial services clients across the Northeast, and I've been looking forward to this conversation. We've done quite a bit of work in the wealth management and banking space, so I'm genuinely excited to learn more about what Meridian is working through.",
  "Thank you both. Jennifer Walsh, CTO at Meridian Financial. We're a mid-size wealth management and lending firm — around eighteen hundred employees across twelve offices. I'll let Raj introduce himself as well, and then I'll walk you through why we reached out.",
  "Raj Patel, CISO at Meridian. I'm joining primarily from a security and compliance angle. Any cloud migration we undertake has to meet our FedRAMP and SOC 2 obligations, so I'll be involved in evaluating any vendor or architecture decisions we move forward with.",
  "So — the reason we reached out is that our on-premises data infrastructure has become a serious liability. We're running a fifteen-year-old Oracle data warehouse on aging HPE hardware, and the maintenance cost and risk of failure have honestly reached a tipping point. We had an unplanned outage in January that took our entire reporting environment down for six hours. For a financial services firm, that is simply not acceptable. On top of that, we're under increasing OCC and SEC scrutiny, and our current environment makes producing audit trails incredibly painful — our compliance team spends weeks manually pulling data for each examination.",
  "Jennifer, that context is really helpful. The January outage and the compliance exposure sound like the key drivers here. I want to make sure we understand the decision and investment landscape correctly — who else is at the table for a project of this scope? And has the board given any direction on budget or appetite for this kind of migration? One more thing before we get into numbers — when we're successful here a year from now, what does that actually look like? Is there a specific metric the board will be measuring this against?",
  "The board approved a digital infrastructure modernization budget right after the January outage. I own the technology roadmap and the vendor selection — that's within my remit. We've earmarked six hundred thousand dollars for the platform migration in this fiscal year, with a phase two budget of similar size for the analytics layer. Raj has final sign-off on any cloud architecture from a security standpoint. On timeline — we have an OCC examination scheduled for September, which means we need to be fully operational and auditable by end of July. That means a signed engagement by end of May at the absolute latest. As for what success looks like — the board wants two numbers by next year's review: audit preparation time down from weeks to under forty-eight hours, and ninety-nine point nine percent uptime on the reporting environment. Those are the figures I'll be held to.",
  "Sorry to jump in here — I'm joining from the finance team. I just want to flag that any spend above five hundred thousand typically goes through an additional board approval cycle, so the six hundred K figure may need to be structured carefully across fiscal quarters to stay within delegated authority limits.",
  "That's a really important point, and I appreciate you flagging it. We can absolutely work with you on phasing the engagement to fit within those approval thresholds — that's something we've navigated before with other clients in regulated industries. Jennifer, Raj — given the hard July deadline, I'd like to propose a four-week architecture assessment as a concrete first step. It gives us something to bring back to the board, with compliance and data lineage baked in from day one. Before we close out today, are there any other stakeholders we should loop in for the assessment kickoff?",
  "Before we go any further on document sharing — and I appreciate the offer of the architecture documentation — I need to flag that any exchange of sensitive infrastructure details, including our Oracle schema or the OCC exam report, will require a mutual NDA to be in place first. That is a hard requirement from our legal team. I don't want it to slow things down, but it can't be an afterthought either.",
  "Raj, completely understood, and we wouldn't have it any other way. Let's make getting the mutual NDA signed action item number one. David will reach out to your legal contact by end of this week to get that process started. We've done this with other regulated clients and we can typically turn it around within a few business days. Once it's signed we are ready to move immediately on the architecture documentation.",
  "Perfect. So our action items: number one, mutual NDA — David and Raj's legal team to coordinate by end of week. Number two, Raj sends the security questionnaire once the NDA is in place. Number three, I'll share the architecture documentation and the OCC exam report. Number four, Alex delivers a brief scope document for the four-week assessment. On my end, I'll personally walk this through our technology steering committee next week so the phase-two budget is already teed up by the time your assessment wraps — I don't want funding to be the thing that slows us down. Let's reconnect next Thursday to confirm everything is in motion before end of month. Thanks everyone — this was a productive first conversation.",
];

// Parallel voice arrays — index matches the corresponding chunk array
const DEMO_VOICES = ["nova", "onyx", "shimmer", "fable", "echo", "nova", "alloy", "nova"];
// Alex Park=onyx, David Chen=echo, Jennifer Walsh=nova, Raj Patel=fable, Speaker 1=alloy
const AE_DEMO_VOICES = ["onyx", "echo", "nova", "fable", "nova", "onyx", "nova", "alloy", "onyx", "fable", "onyx", "nova"];

// Explicit speaker names per chunk — bypasses AI speaker detection in the demo
const DEMO_SPEAKERS = [
  "Sarah Chen", "Mark Rodriguez", "Priya Patel", "Mark Rodriguez",
  "James Park", "Sarah Chen", "Lisa Wang", "Sarah Chen",
];
const AE_DEMO_SPEAKERS = [
  "Alex Park", "David Chen", "Jennifer Walsh", "Raj Patel",
  "Jennifer Walsh", "Alex Park", "Jennifer Walsh", "Speaker 1",
  "Alex Park", "Raj Patel", "Alex Park", "Jennifer Walsh",
];

// ── BA (Business Analyst) demo — requirements gathering meeting ──────────────
const BA_DEMO_CHUNKS = [
  "Good morning everyone. I'm Rachel Torres, lead business analyst on this project. Today's goal is to document what the new procurement system needs to do. Our current process is creating real operational problems and we need to capture all requirements carefully before we begin vendor evaluation.",
  "Hi Rachel. I'm Pat Singh from procurement operations. The biggest pain for our team right now is that we manually re-enter supplier invoices into two separate systems every single day. It takes about fifteen hours per person per week and we're getting data entry errors that delay supplier payments by up to ten days. It's costing us vendor goodwill.",
  "This is Keiko Nakamura from legal and compliance. I need to flag a critical requirement: we failed an internal audit last quarter because we couldn't produce contract approval records on time. Any new system must maintain a full, immutable audit trail for every purchase order over five thousand dollars. That is a non-negotiable compliance requirement.",
  "Rachel here. Adding to that — we need role-based approval workflows. Right now anyone in the department can approve any purchase regardless of amount. We need tiered approvals: purchases above twenty-five thousand require VP sign-off, and purchases above one hundred thousand require CFO approval. The system must enforce this automatically.",
  "I'm David Okafor from IT. A hard integration requirement: the new system must connect bidirectionally and in real-time with our existing SAP S/4HANA ERP. We cannot afford a manual reconciliation step between procurement and finance. The system also needs to support at least two hundred concurrent users with sub-two-second response times for any search or lookup.",
  "Pat again. I also need to stress the supplier onboarding problem. Onboarding a new supplier today takes an average of three weeks because everything is done via email and spreadsheets. We're losing potential vendors because of how painful our process is. The new system should support a self-service supplier portal that cuts onboarding to under five business days.",
  "Wrapping up from Rachel. Final requirements: mobile approval capability for department heads who travel, automatic multi-currency conversion for our seven-country operation — manual currency conversion is costing us about forty hours per month — and a reporting dashboard that gives procurement leadership real-time spend visibility by category, supplier, and region.",
];
const BA_DEMO_SPEAKERS = [
  "Rachel Torres", "Pat Singh", "Keiko Nakamura", "Rachel Torres",
  "David Okafor", "Pat Singh", "Rachel Torres",
];

// ── SA (Solutions Architect / host) demo — vendor evaluation with competitor mentions ──
const SA_DEMO_CHUNKS = [
  "Thanks for making time today. I'm Chris Wagner, IT Director at Vantage Analytics. We're going through a formal vendor evaluation to replace our infrastructure monitoring platform. I want to walk you through where we are in the process and what we're looking for.",
  "Right now we're running Nagios as our primary infrastructure monitoring system and it's become a serious liability. Every configuration change requires a full service restart, and the polling interval means we have a minimum four-minute blind spot on any issue. We had three major production incidents this year that Nagios either missed entirely or caught too late to prevent customer impact.",
  "We ran a three-week proof of concept with Datadog earlier this year. The auto-discovery was genuinely impressive and the dashboards are the best I've seen. But the pricing at our scale is a real concern — at our current node count of about eight hundred hosts, we'd be looking at roughly one hundred eighty thousand dollars annually, which is considerably above our approved budget ceiling.",
  "New Relic was also on our evaluation list. Their APM capabilities for application performance are solid. But they struggled with our on-premise VMware monitoring — their sales engineer acknowledged the platform is primarily designed for cloud-native environments. Since forty percent of our infrastructure is still on-premises, that's a dealbreaker for us.",
  "Our engineering team internally proposed Prometheus and Grafana as a self-managed open source option. Two engineers built a proof of concept in about two weeks and technically it performs well. But the operational overhead of running it ourselves is significant — we'd need to hire at least one dedicated SRE just to own the stack, which we don't have budget for.",
  "Dynatrace is our most serious contender right now. The demo we saw last month was impressive, particularly their AI-driven root cause analysis and automatic baselining. The main concern is implementation complexity — their professional services team estimated six to eight months for full deployment, which feels long given our timeline constraints.",
  "So to summarize what we need: a solution that replaces Nagios within ninety days, covers both our on-premise VMware infrastructure and our AWS workloads without requiring a large internal team to maintain it, and fits within an annual budget of one hundred fifty thousand dollars. We need a recommendation within the next thirty days.",
];
const SA_DEMO_SPEAKERS = [
  "Chris Wagner", "Chris Wagner", "Chris Wagner", "Chris Wagner",
  "Chris Wagner", "Chris Wagner", "Chris Wagner",
];
const SA_DEMO_REFERENCE_PROJECTS = [
  {
    title: "Horizon Tech Observability Modernization",
    description: "Replaced Nagios with Dynatrace across 2,200 hybrid hosts (VMware + AWS). Delivered AI-driven root cause analysis, auto-discovery, and custom SLO dashboards. Full deployment completed in eleven weeks.",
    tags: ["Dynatrace", "Nagios", "Observability", "APM", "VMware", "AWS"],
    industry: "Technology",
    clientName: "Horizon Technology",
    projectDate: "2025-09-12T00:00:00.000Z",
  },
  {
    title: "Apex Finance Datadog Full-Stack Rollout",
    description: "Deployed Datadog across hybrid AWS and on-premise infrastructure covering APM, log management, infrastructure monitoring, and custom anomaly detection. Replaced aging Nagios and Splunk deployments.",
    tags: ["Datadog", "AWS", "APM", "Log Management", "Infrastructure Monitoring", "Nagios"],
    industry: "Financial Services",
    clientName: "Apex Finance",
    projectDate: "2025-07-22T00:00:00.000Z",
  },
];

// ── AE (Account Executive) demo reference projects — financial services Oracle migration ──
const AE_DEMO_REFERENCE_PROJECTS = [
  {
    title: "FortifyBank Oracle Data Warehouse Migration",
    description: "Migrated FortifyBank's 12-year-old Oracle data warehouse to Snowflake on Azure. Delivered FedRAMP-compliant architecture, automated OCC audit-ready reporting, and a 60% reduction in manual compliance exam preparation. Full engagement completed in six months.",
    tags: ["Oracle", "Snowflake", "Azure", "FedRAMP", "SOC 2", "Data Warehouse", "Compliance", "Financial Services"],
    industry: "Financial Services",
    clientName: "FortifyBank",
    projectDate: "2025-10-15T00:00:00.000Z",
  },
  {
    title: "Crestview Wealth Management Data Platform",
    description: "Replaced aging on-premise reporting infrastructure for a wealth management firm with a cloud-native data lake meeting SEC and FINRA compliance requirements. Automated audit trail generation cut compliance examination prep from four weeks to under forty-eight hours.",
    tags: ["Cloud Migration", "Compliance", "SEC", "FINRA", "Data Lake", "Wealth Management", "Audit", "Oracle"],
    industry: "Financial Services",
    clientName: "Crestview Wealth",
    projectDate: "2025-07-22T00:00:00.000Z",
  },
];

// ── BA (Business Analyst) demo reference projects — procurement transformation ──
const BA_DEMO_REFERENCE_PROJECTS = [
  {
    title: "Northgate Procurement System Transformation",
    description: "Business analysis and requirements documentation for a multi-country procurement platform replacement. Delivered 120 functional requirements covering supplier onboarding, multi-currency workflows, SAP S/4HANA integration, role-based approval chains, and compliance audit trail requirements.",
    tags: ["Procurement", "Business Analysis", "SAP S/4HANA", "ERP Integration", "Compliance", "Multi-Currency", "Supplier Portal", "Retail"],
    industry: "Retail",
    clientName: "Northgate Group",
    projectDate: "2025-09-05T00:00:00.000Z",
  },
  {
    title: "Allied Healthcare Procurement Analytics",
    description: "Requirements gathering and process redesign for a healthcare procurement platform serving 200+ concurrent users. Captured requirements across purchasing workflows, vendor management, compliance reporting, PCI-DSS obligations, and finance system integration.",
    tags: ["Procurement", "Healthcare", "Requirements Analysis", "PCI DSS", "Process Design", "Finance Integration", "Compliance"],
    industry: "Healthcare",
    clientName: "Allied Healthcare",
    projectDate: "2025-06-18T00:00:00.000Z",
  },
];

// ── PM (Project Manager / producer) demo reference projects — ERP migration ──
const PM_DEMO_REFERENCE_PROJECTS = [
  {
    title: "Westfield Group Global ERP Consolidation",
    description: "Program management for a seven-month ERP consolidation across five countries, migrating from legacy Oracle to SAP S/4HANA Cloud. Managed critical-path data migration, HRIS integration dependencies, phased hardware procurement, and a four-week parallel UAT program. Delivered on schedule.",
    tags: ["ERP", "SAP S/4HANA", "Oracle", "Data Migration", "Program Management", "Global Rollout", "Risk Management"],
    industry: "Retail",
    clientName: "Westfield Group",
    projectDate: "2025-08-20T00:00:00.000Z",
  },
  {
    title: "Cascade Manufacturing ERP Modernization",
    description: "Led program delivery for a nine-month Oracle-to-Microsoft Dynamics 365 migration for a manufacturing client. Coordinated hardware procurement timeline, vendor API dependencies, QA resource planning across parallel workstreams, and board-level steering committee reporting.",
    tags: ["ERP", "Microsoft Dynamics 365", "Oracle", "Manufacturing", "Program Management", "Vendor Management", "Hardware Procurement"],
    industry: "Manufacturing",
    clientName: "Cascade Manufacturing",
    projectDate: "2026-01-30T00:00:00.000Z",
  },
];

// ── PM (Project Manager / producer) demo — project kickoff with dates and risks ──
const PM_DEMO_CHUNKS = [
  "Good afternoon everyone. I'm Janelle Brooks, program manager for the ERP migration program. Today's kickoff sets the foundation for the next seven months. I want everyone to leave today clear on key milestones, critical path dependencies, and where I need escalations.",
  "Let me start with the hard dates. The board has approved October thirty-first as our go-live target. But finance needs the system operational by October first for the start of our new fiscal year — which means UAT sign-off needs to happen by September fifteenth. That is our real internal deadline and there is no flexibility on it.",
  "The critical path bottleneck is data migration. We have eleven years of transactional data in the legacy Oracle system that needs to be cleansed, transformed, and loaded. The data team estimates eight weeks minimum for cleansing alone. Any slip in that stream cascades through every downstream phase. I need daily status reports from the data migration lead starting Monday.",
  "I need to flag an immediate procurement risk. The hardware for the new environment must be ordered by end of this month to hit our supplier lead time. Finance approval for the purchase has been pending for three weeks. If that approval does not come through by this Friday, we miss the delivery window and the project slips by six weeks minimum. I need someone to escalate that today.",
  "From the integration side — this is Marcus Chen — we have a hard dependency on our HRIS vendor completing their API update before we can migrate employee records. They committed to May first. But they already slipped once from their original March delivery. We need a contingency plan for that dependency that does not block the ERP go-live.",
  "The testing phase is also at risk. We have four weeks allocated for regression and UAT starting September first. But our QA team is already committed to three other active projects in that same window. We are not adequately resourced to run parallel testing. I need to escalate this resource conflict to VP level this week before those commitments get further locked in.",
  "Wrap-up and action items: hardware purchase escalation to finance by end of today. HRIS contingency plan from Marcus by next Friday. QA resource conflict escalation to VP by Thursday. Daily migration status starting Monday. If we lose more than two weeks on the critical path before August first, I will be requesting an emergency steering committee review.",
];
const PM_DEMO_SPEAKERS = [
  "Janelle Brooks", "Janelle Brooks", "Janelle Brooks", "Janelle Brooks",
  "Marcus Chen", "Janelle Brooks", "Janelle Brooks",
];

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
  const [sessionTitle, setSessionTitle] = useState("New Session");
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
  const [selectedMicId, setSelectedMicId] = useState("");
  const [actionItems, setActionItems] = useState<ActionItem[]>([]);
  const [followUpQuestions, setFollowUpQuestions] = useState<FollowUpQuestion[]>([]);
  const [liveSpeakers, setLiveSpeakers] = useState<SpeakerEntry[]>([]);
  const [similarProjects, setSimilarProjects] = useState<SimilarProjectMatch[]>([]);
  const [bantData, setBantData] = useState<BANTData | null>(null);
  const [methodologyProgress, setMethodologyProgress] = useState<MethodologyProgress | null>(null);
  const [competitorMentions, setCompetitorMentions] = useState<CompetitorMention[]>([]);
  const [timelineSignals, setTimelineSignals] = useState<TimelineSignal[]>([]);
  const [riskFlags, setRiskFlags] = useState<RiskFlag[]>([]);
  const [requirements, setRequirements] = useState<Requirement[]>([]);
  const [painPoints, setPainPoints] = useState<PainPoint[]>([]);
  const [sipocData, setSipocData] = useState<SIPOCData | null>(null);
  const [apiKeyMissing, setApiKeyMissing] = useState(false);
  const [showLowAudioWarning, setShowLowAudioWarning] = useState(false);
  const lowAudioTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sessionStartTimeRef = useRef<number | null>(null);
  const { toast } = useToast();
  const processingRef = useRef(false);
  const activeSessionRef = useRef<Session | null>(null);
  const demoTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const demoAnimationRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const demoProjectIdsRef = useRef<number[]>([]);
  const demoChunksRef = useRef<string[]>(DEMO_CHUNKS);
  const demoAudioRef = useRef<HTMLAudioElement | null>(null);
  const demoAudioPrefixRef = useRef<string>("demo");
  const demoSpeakersRef = useRef<string[]>(DEMO_SPEAKERS);
  const demoWordTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isDemoRunningRef = useRef(false);
  const transcriptEndRef = useRef<HTMLDivElement>(null);
  const chunkSnapshotsRef = useRef<number[][]>([]);

  const { data: settings } = useSettings();
  const hostRole = settings?.hostRole ?? "host";
  const isAEMode = hostRole === "account-executive";

  // Returns true if an API key is configured (Electron IPC or server API).
  async function checkApiKeyConfigured(): Promise<boolean> {
    if (window.electronAudio) {
      const key = await window.electronAudio.getApiKey();
      return !!key && key.trim().length > 0;
    }
    try {
      const res = await fetch("/api/settings/api-key");
      const data = await res.json();
      return !!data.configured;
    } catch {
      return false;
    }
  }

  // Check whether an OpenAI API key has been configured
  useEffect(() => {
    checkApiKeyConfigured().then((configured) => setApiKeyMissing(!configured));
  }, []);

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
    mutationFn: async (data: { title: string; clientName?: string; industry?: string }) => {
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
      setCompetitorMentions([]);
      setTimelineSignals([]);
      setRiskFlags([]);
      setRequirements([]);
      setPainPoints([]);
      setSipocData(null);
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

      if (data.allActionItems) {
        setActionItems(data.allActionItems);
      } else if (data.actionItems && data.actionItems.length > 0) {
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

      if (data.allCompetitorMentions) setCompetitorMentions(data.allCompetitorMentions);
      else if (data.competitorMentions?.length) setCompetitorMentions(prev => [...prev, ...data.competitorMentions]);
      if (data.allTimelineSignals) setTimelineSignals(data.allTimelineSignals);
      else if (data.timelineSignals?.length) setTimelineSignals(prev => [...prev, ...data.timelineSignals]);
      if (data.allRiskFlags) setRiskFlags(data.allRiskFlags);
      else if (data.riskFlags?.length) setRiskFlags(prev => [...prev, ...data.riskFlags]);
      if (data.allRequirements) setRequirements(data.allRequirements);
      else if (data.requirements?.length) setRequirements(prev => [...prev, ...data.requirements]);
      if (data.allPainPoints) setPainPoints(data.allPainPoints);
      else if (data.painPoints?.length) setPainPoints(prev => [...prev, ...data.painPoints]);
      if (data.sipocData) setSipocData(data.sipocData);

      if (data.newTopics && data.newTopics.length > 0) {
        await refetchTopics();
        const newIds = new Set<number>(
          data.allTopics
            ?.filter((t: Topic) => data.newTopics.some((nt: { term: string }) => nt.term === t.term))
            .map((t: Topic) => t.id) || []
        );
        setNewTopicIds(prev => new Set<number>([...prev, ...newIds]));

        setTimeout(() => {
          setNewTopicIds(prev => {
            const next = new Set<number>(prev);
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
        features: { actionItems: true, followUpQuestions: true, similarProjects: true },
        ...(speakerHint ? {
          voiceMatch: {
            name: speakerHint.profileName,
            title: speakerHint.profileTitle,
            confidence: speakerHint.confidence,
          },
        } : {}),
      });

      const { jobId } = await res.json() as { jobId: string };
      const data = await pollAnalysisJob(session.id, jobId);
      await handleAnalysisResponseRef.current(data as any);
    } catch (error) {
      console.error("Failed to analyze audio:", error);
      const rawMsg = error instanceof Error ? error.message : String(error);
      // Extract server-sent error detail from e.g. "401: {"error":"...","detail":"..."}"
      let displayMsg = "Could not process audio. Will retry on next chunk.";
      const jsonMatch = rawMsg.match(/^\d+: (\{.*\})$/s);
      if (jsonMatch) {
        try {
          const body = JSON.parse(jsonMatch[1]);
          if (body.error) displayMsg = body.error;
        } catch {}
      }
      toast({
        title: "Analysis failed",
        description: displayMsg,
        variant: "destructive",
      });
    } finally {
      processingRef.current = false;
      setIsProcessing(false);
    }
  }, [toast]);

  const audioCapture = useAudioCapture({ intervalMs: 6000, onFrequencyData: onLiveFrequencyData });
  const { captureErrors, dismissCaptureError } = audioCapture;
  const speakerError = captureErrors.find((e) => e.source === "speaker");
  const micError = captureErrors.find((e) => e.source === "mic");

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
    const speaker = demoSpeakersRef.current[chunkIdx];
    setIsProcessing(true);

    // Load audio and get its duration before playing so we can pace word streaming
    const audioSrc = `/demo-audio/${demoAudioPrefixRef.current}-${chunkIdx}.mp3`;
    const audio = new Audio(audioSrc);
    demoAudioRef.current = audio;

    const audioDuration = await new Promise<number>(resolve => {
      audio.addEventListener("loadedmetadata", () => resolve(audio.duration), { once: true });
      audio.addEventListener("error", () => resolve(0), { once: true });
      setTimeout(() => resolve(0), 2000);
      audio.load();
    });

    const audioEnded = new Promise<void>(resolve => {
      if (audioDuration === 0) { resolve(); return; }
      audio.addEventListener("ended", () => resolve(), { once: true });
      audio.addEventListener("error", () => resolve(), { once: true });
      setTimeout(() => resolve(), 90_000);
    });

    audio.playbackRate = 1.12;
    audio.play().catch(() => {});

    // Stream transcript words in sync with audio. When no audio file is available
    // (sa-demo-*, ba-demo-*, pm-demo-* not yet shipped), fall back to ~100 ms/word
    // so the transcript still streams visibly instead of appearing frozen.
    const words = chunk.split(/\s+/);
    const chunkPrefix = `[${speaker}] `;
    const hasAudio = audioDuration > 0;
    const msPerWord = hasAudio
      ? (audioDuration * 1000) / (words.length * 1.12)
      : Math.max(60, 2200 / Math.max(1, words.length)); // pace to ~match GPT latency

    {
      let streamIdx = 0;
      const streamWord = () => {
        if (!isDemoRunningRef.current) return;
        streamIdx = Math.min(words.length, streamIdx + 1);
        const displayed = chunkPrefix + words.slice(0, streamIdx).join(" ");
        setTranscript(prev => {
          if (!prev) return displayed;
          const sep = "\n\n";
          const lastSepIdx = prev.lastIndexOf(sep);
          const lastEntry = lastSepIdx >= 0 ? prev.slice(lastSepIdx + sep.length) : prev;
          if (lastEntry.startsWith(chunkPrefix)) {
            return prev.slice(0, lastSepIdx >= 0 ? lastSepIdx + sep.length : 0) + displayed;
          }
          return prev + sep + displayed;
        });
        if (streamIdx < words.length) {
          demoWordTimerRef.current = setTimeout(streamWord, msPerWord);
        }
      };
      // With audio: start words 0.5 s after audio begins (voice is "ahead").
      // Without audio: start words immediately.
      demoWordTimerRef.current = setTimeout(streamWord, hasAudio ? 500 : 0);
    }

    // Wait before firing analysis: with audio, give it 1.5 s head-start so the
    // voice is ahead of the AI. Without audio there is nothing to sync to.
    await new Promise(resolve => setTimeout(resolve, hasAudio ? 1500 : 200));

    if (!isDemoRunningRef.current) return;

    try {
      const [{ jobId }] = await Promise.all([
        apiRequest("POST", `/api/sessions/${session.id}/demo-analyze`, {
          text: chunk,
          speaker,
          features: { actionItems: true, followUpQuestions: true, similarProjects: true },
        }).then(r => r.json() as Promise<{ jobId: string }>),
        audioEnded,
      ]);

      if (!isDemoRunningRef.current) return;

      const data = await pollAnalysisJob(session.id, jobId);
      // Always suppress transcript from the API response — it's streamed word-by-word above
      // (either synced to audio or at a fixed fallback rate when audio files are absent).
      await handleAnalysisResponse({ ...(data as any), transcript: undefined });

      setIsProcessing(false);
      const nextIdx = chunkIdx + 1;
      setDemoChunkIndex(nextIdx);

      if (nextIdx < demoChunksRef.current.length) {
        demoTimerRef.current = setTimeout(() => {
          processDemoChunk(session, nextIdx);
        }, 300); // brief pause between speakers
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
      const rawMsg = error instanceof Error ? error.message : String(error);
      const isAuthError = rawMsg.startsWith("401:");
      if (isAuthError) {
        // Stop the demo and surface a clear error rather than silently skipping all chunks.
        setIsDemoRunning(false);
        setIsProcessing(false);
        if (demoAnimationRef.current) {
          clearInterval(demoAnimationRef.current);
          demoAnimationRef.current = null;
        }
        setDemoAudioLevel(0);
        toast({
          title: "OpenAI API key required",
          description: "Please add your API key in Studio Settings, then try the demo again.",
          variant: "destructive",
        });
        return;
      }
      setIsProcessing(false);
      const nextIdx = chunkIdx + 1;
      setDemoChunkIndex(nextIdx);
      demoTimerRef.current = setTimeout(() => {
        processDemoChunk(session, nextIdx);
      }, 2000);
    }
  }, [handleAnalysisResponse, toast]);

  const handleStartSession = async () => {
    const liveKeyMissing = !(await checkApiKeyConfigured());
    if (liveKeyMissing) {
      setApiKeyMissing(true);
      toast({
        title: "OpenAI API key required",
        description: "Please add your API key in Studio Settings before starting a session.",
        variant: "destructive",
      });
      return;
    }
    try {
      const session = await createSessionMutation.mutateAsync({
        title: sessionTitle,
        clientName: clientName || undefined,
        industry: industry || undefined,
      });
      await audioCapture.startCapture(sendAudioChunk);
      sessionStartTimeRef.current = Date.now();
      setIsListening(true);
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      console.error("[handleStartSession] failed:", msg, error);
      toast({
        title: "Failed to start session",
        description: msg.startsWith("500") ? "Server error — check the console for details." : msg,
        variant: "destructive",
      });
    }
  };

  // ── Low-audio detection ─────────────────────────────────────────────────────
  useEffect(() => {
    const level = audioCapture.audioLevel;
    // Only run during a live (non-demo) session, after a 15-second grace period
    if (!isListening || isDemoRunning || isMuted || !sessionStartTimeRef.current) return;
    if (Date.now() - sessionStartTimeRef.current < 15_000) return;

    const LOW_THRESHOLD = 0.01; // RMS below this = effectively silent
    if (level < LOW_THRESHOLD) {
      if (!lowAudioTimerRef.current) {
        lowAudioTimerRef.current = setTimeout(() => {
          setShowLowAudioWarning(true);
        }, 10_000); // 10 seconds of sustained silence → show warning
      }
    } else {
      if (lowAudioTimerRef.current) {
        clearTimeout(lowAudioTimerRef.current);
        lowAudioTimerRef.current = null;
      }
      setShowLowAudioWarning(false);
    }
  }, [audioCapture.audioLevel, isListening, isDemoRunning, isMuted]);

  // Clear timer on unmount / session end
  useEffect(() => {
    if (!isListening) {
      if (lowAudioTimerRef.current) {
        clearTimeout(lowAudioTimerRef.current);
        lowAudioTimerRef.current = null;
      }
      setShowLowAudioWarning(false);
      sessionStartTimeRef.current = null;
    }
  }, [isListening]);

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
      // Always check the current key state rather than relying on mount-time snapshot.
      const liveKeyMissing = !(await checkApiKeyConfigured());
      if (liveKeyMissing) {
        setApiKeyMissing(true);
        toast({
          title: "OpenAI API key required",
          description: "Please add your API key in Studio Settings before running the demo.",
          variant: "destructive",
        });
        return;
      }
      // Key is present — clear any stale banner.
      setApiKeyMissing(false);
      const role = settings?.hostRole ?? "host";

      // Select role-specific demo content
      let demoChunks: string[];
      let demoSpeakers: string[];
      let demoAudioPrefix: string;
      let demoSessionTitle: string;
      let demoClientName: string;
      let demoIndustry: string | undefined;
      let demoRefProjects: Array<{ title: string; description: string; tags: string[]; industry?: string; clientName?: string; projectDate?: string }> = [];

      if (role === "account-executive") {
        demoChunks = AE_DEMO_CHUNKS; demoSpeakers = AE_DEMO_SPEAKERS; demoAudioPrefix = "ae-demo";
        demoSessionTitle = "Demo: Sales Discovery — Meridian Financial";
        demoClientName = "Meridian Financial"; demoIndustry = "Financial Services";
        demoRefProjects = AE_DEMO_REFERENCE_PROJECTS;
        // Methodology tracking only activates once a methodology is selected in
        // Settings. Fresh installs default to MEDDIC (server/storage.ts), but an
        // existing install that predates that default may still have it unset —
        // set it here so the AE demo reliably shows the methodology tracker.
        if (!settings?.salesMethodology) {
          try {
            await apiRequest("PATCH", "/api/settings", { salesMethodology: "meddic" });
            queryClient.invalidateQueries({ queryKey: ["/api/settings"] });
          } catch {}
        }
      } else if (role === "correspondent") {
        demoChunks = BA_DEMO_CHUNKS; demoSpeakers = BA_DEMO_SPEAKERS; demoAudioPrefix = "ba-demo";
        demoSessionTitle = "Demo: Procurement Requirements Workshop";
        demoClientName = "Northgate Group"; demoIndustry = "Retail";
        demoRefProjects = BA_DEMO_REFERENCE_PROJECTS;
      } else if (role === "producer") {
        demoChunks = PM_DEMO_CHUNKS; demoSpeakers = PM_DEMO_SPEAKERS; demoAudioPrefix = "pm-demo";
        demoSessionTitle = "Demo: ERP Migration Project Kickoff";
        demoClientName = "Eastbridge Corp"; demoIndustry = "Manufacturing";
        demoRefProjects = PM_DEMO_REFERENCE_PROJECTS;
      } else if (role === "host") {
        demoChunks = SA_DEMO_CHUNKS; demoSpeakers = SA_DEMO_SPEAKERS; demoAudioPrefix = "sa-demo";
        demoSessionTitle = "Demo: Observability Platform Evaluation";
        demoClientName = "Vantage Analytics"; demoIndustry = "Technology";
        demoRefProjects = SA_DEMO_REFERENCE_PROJECTS;
      } else {
        // engineer — cloud migration demo with audio
        demoChunks = DEMO_CHUNKS; demoSpeakers = DEMO_SPEAKERS; demoAudioPrefix = "demo";
        demoSessionTitle = "Demo: Cloud Migration Review";
        demoClientName = "Contoso Ltd";
        demoRefProjects = DEMO_REFERENCE_PROJECTS;
      }

      demoChunksRef.current = demoChunks;
      demoAudioPrefixRef.current = demoAudioPrefix;
      demoSpeakersRef.current = demoSpeakers;

      // Create reference projects in parallel — no ordering dependency.
      const createdIds = (await Promise.all(
        demoRefProjects.map(async (project) => {
          try {
            const res = await apiRequest("POST", "/api/reference-projects", project);
            const created = await res.json();
            return created.id as number;
          } catch { return null; }
        })
      )).filter((id): id is number => id !== null);

      demoProjectIdsRef.current = createdIds;
      if (createdIds.length > 0) {
        queryClient.invalidateQueries({ queryKey: ["/api/reference-projects"] });
      }

      const session = await createSessionMutation.mutateAsync({
        title: demoSessionTitle,
        clientName: demoClientName,
        ...(demoIndustry ? { industry: demoIndustry } : {}),
      });
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
      setCompetitorMentions([]);
      setTimelineSignals([]);
      setRiskFlags([]);
      setRequirements([]);
      setPainPoints([]);
      setSipocData(null);

      demoAnimationRef.current = setInterval(() => {
        setDemoAudioLevel(Math.random() * 0.6 + 0.2);
      }, 150);

      setTimeout(() => {
        processDemoChunk(session, 0);
      }, 300);
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
      if (demoWordTimerRef.current) {
        clearTimeout(demoWordTimerRef.current);
        demoWordTimerRef.current = null;
      }
      if (demoAudioRef.current) {
        demoAudioRef.current.pause();
        demoAudioRef.current.src = "";
        demoAudioRef.current = null;
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
      if (demoWordTimerRef.current) clearTimeout(demoWordTimerRef.current);
      if (demoAnimationRef.current) clearInterval(demoAnimationRef.current);
      if (demoAudioRef.current) {
        demoAudioRef.current.pause();
        demoAudioRef.current.src = "";
      }
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
            <Activity className="h-5 w-5 text-primary" />
            <h1 className="text-lg font-semibold" data-testid="text-page-title">New Session</h1>
          </div>
        </div>

        {/* ── Setup warnings ─────────────────────────────────────── */}
        {apiKeyMissing && (
          <div className="px-4 pt-4">
            <Alert variant="destructive">
              <Key className="h-4 w-4" />
              <AlertTitle>OpenAI API key not configured</AlertTitle>
              <AlertDescription className="text-xs">
                You won&apos;t be able to transcribe or analyze audio without an API key.{" "}
                <button
                  className="underline font-medium"
                  onClick={() => navigate("/studio-settings")}
                >
                  Go to Settings
                </button>{" "}
                to add your key, then come back to start a session.
              </AlertDescription>
            </Alert>
          </div>
        )}
        {speakerError && (
          <div className="px-4 pt-3">
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <div className="flex items-start justify-between gap-2">
                <div>
                  <AlertTitle>Speaker capture unavailable</AlertTitle>
                  <AlertDescription className="text-xs">
                    Remote participant audio won&apos;t be captured. To enable it on Windows:{" "}
                    right-click the speaker icon → Sounds → Recording tab → Show Disabled Devices
                    → right-click <strong>Stereo Mix</strong> → Enable. Then restart NRI OnTopic.
                  </AlertDescription>
                </div>
                <button onClick={() => dismissCaptureError("speaker")} className="shrink-0 mt-0.5 text-muted-foreground hover:text-foreground">
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            </Alert>
          </div>
        )}
        {micError && (
          <div className="px-4 pt-3">
            <Alert variant="destructive">
              <Mic className="h-4 w-4" />
              <div className="flex items-start justify-between gap-2">
                <div>
                  <AlertTitle>Microphone error</AlertTitle>
                  <AlertDescription className="text-xs">{micError.message}</AlertDescription>
                </div>
                <button onClick={() => dismissCaptureError("mic")} className="shrink-0 mt-0.5">
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            </Alert>
          </div>
        )}

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
              placeholder="Session title..."
              value={sessionTitle}
              onChange={(e) => setSessionTitle(e.target.value)}
              onFocus={() => { if (sessionTitle === "New Session") setSessionTitle(""); }}
              onBlur={() => { if (!sessionTitle.trim()) setSessionTitle("New Session"); }}
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

            <Button
              onClick={handleStartSession}
              disabled={createSessionMutation.isPending}
              className="w-full"
              data-testid="button-start-session"
            >
              {createSessionMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Activity className="h-4 w-4 mr-2" />
              )}
              Start Session
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
              Run Demo
            </Button>
            <p className="text-[10px] text-muted-foreground text-center leading-relaxed">
              Plays a sample session of a cloud migration meeting with AI-powered analysis. No mic needed.
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
                  sessionStart={activeSession.createdAt instanceof Date ? activeSession.createdAt.toISOString() : activeSession.createdAt}
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

        {/* Low audio warning */}
        {showLowAudioWarning && !isMuted && (
          <div className="shrink-0 px-4 pt-2">
            <Alert variant="destructive" className="py-2">
              <MicOff className="h-4 w-4" />
              <div className="flex items-start justify-between gap-2">
                <div>
                  <AlertTitle className="text-sm">No audio detected</AlertTitle>
                  <AlertDescription className="text-xs">
                    Check your microphone is connected and not muted in Windows Sound settings. If using a headset, ensure it is set as the default recording device.
                  </AlertDescription>
                </div>
                <button onClick={() => setShowLowAudioWarning(false)} className="shrink-0 mt-0.5">
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            </Alert>
          </div>
        )}

        {/* ── AE mode: 50/50 command centre ───────────────────────────────── */}
        {isAEMode ? (
          <div className="flex flex-1 min-h-0">

            {/* LEFT: Rolling transcript — enough to glance back */}
            <div className="flex flex-col w-1/2 min-h-0 border-r border-border" data-testid="ae-transcript-pane">
              <div className="px-3 py-2 border-b border-border flex items-center gap-2 bg-card/50 shrink-0">
                <BookOpen className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="text-xs font-semibold">Transcript</span>
                <div className="ml-auto flex items-center gap-2.5 flex-wrap justify-end">
                  {liveSpeakers.slice(0, 6).map((s, i) => {
                    const color = getSpeakerColorByIndex(i);
                    return (
                      <span key={s.name} className={`flex items-center gap-1 text-[10px] ${color.text}`}>
                        <span className="h-1.5 w-1.5 rounded-full shrink-0 bg-current opacity-80" />
                        {s.name}
                      </span>
                    );
                  })}
                </div>
              </div>
              <ScrollArea className="flex-1">
                <div className="p-4">
                  {displayedTranscript ? (
                    <>
                      <HighlightedTranscript
                        text={displayedTranscript}
                        topics={topics}
                        sessionStart={activeSession?.createdAt instanceof Date ? activeSession.createdAt.toISOString() : activeSession?.createdAt}
                      />
                      <div ref={transcriptEndRef} />
                    </>
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
                          <p className="text-xs text-muted-foreground">{isMuted ? "Microphone muted" : "Listening..."}</p>
                        </>
                      )}
                    </div>
                  )}
                </div>
              </ScrollArea>
            </div>

            {/* RIGHT RAIL: always-visible intelligence + detail tabs */}
            <div className="flex flex-col w-1/2 min-h-0 overflow-hidden">

              {/* BANT — 4 horizontal rows, label + value, no evidence */}
              <div className="shrink-0 border-b border-border" data-testid="column-bant-ae">
                <div className="px-3 py-2 flex items-center gap-2 bg-card/50">
                  <Target className="h-3.5 w-3.5 text-primary" />
                  <span className="text-xs font-semibold">BANT Qualification</span>
                  <div className="flex gap-0.5 flex-1 mx-2">
                    {BANT_KEYS.map(({ key }) => (
                      <div key={key} className={`h-1 flex-1 rounded-full transition-colors duration-500 ${bantData?.[key] ? "bg-emerald-500" : "bg-muted"}`} />
                    ))}
                  </div>
                  <span className="text-[10px] text-muted-foreground tabular-nums shrink-0">
                    {bantData ? Object.values(bantData).filter(Boolean).length : 0}/4
                  </span>
                </div>
                <div className="px-3 py-1.5 space-y-1">
                  {BANT_KEYS.map(({ key, label, icon: Icon, color }) => {
                    const field = bantData?.[key];
                    return (
                      <div key={key} className="flex items-center gap-2 min-w-0" data-testid={`card-bant-${key}`}>
                        <Icon className={`h-3 w-3 shrink-0 ${field ? color : "text-muted-foreground/25"}`} />
                        <span className={`text-[10px] w-16 shrink-0 ${field ? "text-muted-foreground" : "text-muted-foreground/40"}`}>{label}</span>
                        <span className={`text-[11px] font-medium flex-1 truncate ${field ? "text-foreground" : "text-muted-foreground/25 italic"}`}>
                          {field ? field.value : "—"}
                        </span>
                        {field && <CheckCircle2 className="h-3 w-3 text-emerald-500 shrink-0" />}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Action Items — text only, numbered, grows live */}
              <div className="shrink-0 border-b border-border flex flex-col" style={{ maxHeight: "180px" }}>
                <div className="px-3 py-2 flex items-center gap-2 bg-card/50 shrink-0">
                  <ClipboardList className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="text-xs font-semibold">Action Items</span>
                  {actionItems.length > 0 && (
                    <Badge variant="secondary" className="text-[10px] h-4 px-1.5">{actionItems.length}</Badge>
                  )}
                </div>
                <ScrollArea className="flex-1">
                  <div className="px-3 py-1.5 space-y-1">
                    {actionItems.length > 0 ? (
                      actionItems.map((item, i) => (
                        <div key={i} className="flex items-start gap-2 min-w-0">
                          <span className="text-[10px] text-muted-foreground/50 shrink-0 tabular-nums pt-px">{i + 1}.</span>
                          <span className="text-[11px] leading-snug text-foreground/90 min-w-0">{item.text}</span>
                        </div>
                      ))
                    ) : (
                      <p className="text-xs text-muted-foreground/50 py-2 text-center">Listening for commitments…</p>
                    )}
                  </div>
                </ScrollArea>
              </div>

              {/* Similar Projects — name + 1-line relevance, no tags */}
              <div className="shrink-0 border-b border-border flex flex-col" style={{ maxHeight: "160px" }}>
                <div className="px-3 py-2 flex items-center gap-2 bg-card/50 shrink-0">
                  <FolderOpen className="h-3.5 w-3.5 text-emerald-500" />
                  <span className="text-xs font-semibold">Similar Projects</span>
                  {consolidatedProjects.length > 0 && (
                    <Badge variant="secondary" className="text-[10px] h-4 px-1.5">{consolidatedProjects.length}</Badge>
                  )}
                </div>
                <ScrollArea className="flex-1">
                  <div className="px-3 py-1.5 space-y-2">
                    {consolidatedProjects.length > 0 ? (
                      consolidatedProjects.map((match) => {
                        const project = referenceProjectsList.find(p => p.id === match.projectId);
                        const title = match.title || project?.title || `Project #${match.projectId}`;
                        const url = project?.url;
                        return (
                          <div key={match.projectId} className="min-w-0" data-testid={`card-similar-project-${match.projectId}`}>
                            <div className="flex items-center gap-1">
                              <span className="text-[11px] font-semibold truncate" data-testid={`text-project-title-${match.projectId}`}>{title}</span>
                              {url && (
                                <a href={url} target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-foreground shrink-0" data-testid={`link-project-${match.projectId}`}>
                                  <ExternalLink className="h-3 w-3" />
                                </a>
                              )}
                            </div>
                            <p className="text-[10px] text-emerald-600 dark:text-emerald-400 leading-snug" data-testid={`text-project-relevance-${match.projectId}`}>{match.relevance}</p>
                          </div>
                        );
                      })
                    ) : (
                      <p className="text-xs text-muted-foreground/50 py-2 text-center">Projects surface as topics are detected.</p>
                    )}
                  </div>
                </ScrollArea>
              </div>

              {/* Tabs: detail-on-demand */}
              <Tabs defaultValue="salesqs" className="flex-1 min-h-0 flex flex-col">
                <div className="px-2 pt-2 pb-0 shrink-0">
                  <TabsList className="h-7 w-full grid grid-cols-5">
                    <TabsTrigger value="salesqs" className="text-[10px] px-0 h-6" data-testid="tab-ae-salesqs">Qs</TabsTrigger>
                    <TabsTrigger value="methodology" className="text-[10px] px-0 h-6" data-testid="tab-ae-methodology">Method</TabsTrigger>
                    <TabsTrigger value="salesforce" className="text-[10px] px-0 h-6" data-testid="tab-ae-salesforce">SF Opp</TabsTrigger>
                    <TabsTrigger value="topics" className="text-[10px] px-0 h-6" data-testid="tab-ae-topics">Topics</TabsTrigger>
                    <TabsTrigger value="sentiment" className="text-[10px] px-0 h-6" data-testid="tab-ae-sentiment">Sentiment</TabsTrigger>
                  </TabsList>
                </div>

                <TabsContent value="salesqs" className="flex-1 min-h-0 overflow-y-auto mt-0 p-2 data-[state=inactive]:hidden">
                  {followUpQuestions.length > 0 ? (
                    <FollowUpQuestionsPanel questions={followUpQuestions} />
                  ) : (
                    <div className="flex flex-col items-center justify-center py-8 text-center px-3">
                      <HelpCircle className="h-5 w-5 text-muted-foreground/20 mb-2" />
                      <p className="text-xs text-muted-foreground">Questions will appear as the call progresses.</p>
                    </div>
                  )}
                </TabsContent>

                <TabsContent value="methodology" className="flex-1 min-h-0 overflow-y-auto mt-0 p-2 data-[state=inactive]:hidden">
                  {methodologyProgress ? (
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
                        <div key={stage.id} className={`flex items-center gap-1.5 transition-all duration-300 ${stage.completed ? "opacity-100" : "opacity-40"}`} data-testid={`stage-${stage.id}`}>
                          {stage.completed
                            ? <CheckCircle2 className="h-3 w-3 text-emerald-500 shrink-0" />
                            : <Circle className="h-3 w-3 text-muted-foreground shrink-0" />}
                          <span className={`text-[10px] ${stage.completed ? "font-medium text-foreground" : "text-muted-foreground"}`}>{stage.name}</span>
                        </div>
                      ))}
                    </div>
                  ) : settings?.salesMethodology && METHODOLOGY_LABELS[settings.salesMethodology] ? (
                    <div>
                      <p className="text-[10px] font-semibold text-foreground mb-1">{METHODOLOGY_LABELS[settings.salesMethodology as string]}</p>
                      <p className="text-[9px] text-muted-foreground/50">Stages will appear as analysis progresses.</p>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center py-8 text-center px-3">
                      <TrendingUp className="h-5 w-5 text-muted-foreground/20 mb-2" />
                      <p className="text-xs text-muted-foreground">No methodology selected.</p>
                      <p className="text-[10px] text-muted-foreground/60 mt-0.5">Configure in Settings.</p>
                    </div>
                  )}
                </TabsContent>

                <TabsContent value="salesforce" className="flex-1 min-h-0 overflow-y-auto mt-0 data-[state=inactive]:hidden">
                  <div className="px-3 py-2 space-y-1.5">
                    {([
                      { label: "Opportunity", value: activeSession?.title || sessionTitle || null },
                      { label: "Account", value: activeSession?.clientName || clientName || null },
                      { label: "Stage", value: (activeSession || isListening) ? "Discovery" : null },
                      { label: "Amount", value: bantData?.budget?.value || null },
                      { label: "Timeline", value: bantData?.timeline?.value || null },
                      { label: "Contact", value: liveSpeakers.find(s => s.role !== "host")?.name || null },
                      { label: "Decision Maker", value: bantData?.authority?.value || null },
                    ] as Array<{ label: string; value: string | null }>).map(({ label, value }) => (
                      <div key={label} className="flex items-start gap-2">
                        <span className="text-[9px] text-muted-foreground/50 uppercase tracking-wide font-medium w-24 shrink-0 pt-px">{label}</span>
                        <span className={`text-[11px] leading-snug break-words min-w-0 ${value ? "text-foreground font-medium" : "text-muted-foreground/25 italic"}`}>
                          {value || "—"}
                        </span>
                      </div>
                    ))}
                  </div>
                </TabsContent>

                <TabsContent value="topics" className="flex-1 min-h-0 overflow-y-auto mt-0 p-2 data-[state=inactive]:hidden">
                  {topics.length > 0 ? (
                    <DashboardTopicGroups
                      toolTopics={toolTopics}
                      conceptTopics={conceptTopics}
                      industryTopics={industryTopics}
                      newTopicIds={newTopicIds}
                      sessionId={activeSession?.id}
                    />
                  ) : (
                    <div className="flex flex-col items-center justify-center py-8 text-center px-3">
                      <AlertCircle className="h-6 w-6 text-muted-foreground/20 mb-2" />
                      <p className="text-xs text-muted-foreground">
                        {isDemoRunning ? "Terms appear as the conversation plays..." : "IT terms will appear here as detected."}
                      </p>
                    </div>
                  )}
                </TabsContent>

                <TabsContent value="sentiment" className="flex-1 min-h-0 overflow-y-auto mt-0 p-2 data-[state=inactive]:hidden">
                  {sentimentData.length > 0 ? (
                    <SentimentEqualizerFull
                      sentimentData={sentimentData}
                      overallSentiment={overallSentiment}
                      sessionStart={activeSession.createdAt instanceof Date ? activeSession.createdAt.toISOString() : activeSession.createdAt}
                    />
                  ) : (
                    <div className="flex flex-col items-center justify-center py-8 text-center px-3">
                      <BarChart3 className="h-6 w-6 text-muted-foreground/20 mb-2" />
                      <p className="text-xs text-muted-foreground">Sentiment will appear as the conversation progresses.</p>
                    </div>
                  )}
                </TabsContent>
              </Tabs>

            </div>
          </div>

        ) : (

        /* ── Role-specific 50/50 layouts ─────────────────────────────────── */
        <div className="flex flex-1 min-h-0">

          {/* LEFT: Transcript (all roles) */}
          <div className="flex flex-col w-1/2 min-h-0 border-r border-border" data-testid="role-transcript-pane">
            <div className="px-3 py-2 border-b border-border flex items-center gap-2 bg-card/50 shrink-0">
              <BookOpen className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-xs font-semibold">Transcript</span>
              <div className="ml-auto flex items-center gap-2.5 flex-wrap justify-end">
                {liveSpeakers.slice(0, 6).map((s, i) => {
                  const color = getSpeakerColorByIndex(i);
                  return (
                    <span key={s.name} className={`flex items-center gap-1 text-[10px] ${color.text}`}>
                      <span className="h-1.5 w-1.5 rounded-full shrink-0 bg-current opacity-80" />
                      {s.name}
                    </span>
                  );
                })}
              </div>
            </div>
            <ScrollArea className="flex-1">
              <div className="p-4">
                {displayedTranscript ? (
                  <>
                    <HighlightedTranscript
                      text={displayedTranscript}
                      topics={topics}
                      sessionStart={activeSession?.createdAt instanceof Date ? activeSession.createdAt.toISOString() : activeSession?.createdAt}
                    />
                    <div ref={transcriptEndRef} />
                  </>
                ) : (
                  <div className="flex flex-col items-center justify-center py-16 text-center">
                    {isDemoRunning ? (
                      <><Loader2 className="h-6 w-6 text-muted-foreground/30 mb-2 animate-spin" /><p className="text-xs text-muted-foreground">Starting demo...</p></>
                    ) : (
                      <><Mic className="h-6 w-6 text-muted-foreground/20 mb-2" /><p className="text-xs text-muted-foreground">{isMuted ? "Microphone muted" : "Listening..."}</p></>
                    )}
                  </div>
                )}
              </div>
            </ScrollArea>
          </div>

          {/* RIGHT: Role-specific intelligence */}
          {hostRole === "host" && (
            /* ── SA: Follow-up questions hero + Competitor signals + Topics + Tabs ── */
            <div className="flex flex-col w-1/2 min-h-0 overflow-hidden" data-testid="role-rail-sa">

              {competitorMentions.length > 0 && (
                <div className="shrink-0 border-b border-border">
                  <div className="px-3 py-2 flex items-center gap-2 bg-amber-50/60 dark:bg-amber-950/20">
                    <ShieldAlert className="h-3.5 w-3.5 text-amber-500" />
                    <span className="text-xs font-semibold">Competitor / Incumbent Signals</span>
                    <Badge variant="secondary" className="text-[10px] h-4 px-1.5 ml-auto">{competitorMentions.length}</Badge>
                  </div>
                  <div className="px-3 py-1.5 space-y-1">
                    {competitorMentions.slice(-4).map((m, i) => (
                      <div key={i} className="flex items-start gap-2 min-w-0">
                        <span className="text-[11px] font-semibold text-amber-600 dark:text-amber-400 shrink-0">{m.name}</span>
                        <span className="text-[10px] text-muted-foreground leading-snug min-w-0 truncate">{m.context}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="shrink-0 border-b border-border flex flex-col" style={{ maxHeight: "200px" }}>
                <div className="px-3 py-2 flex items-center gap-2 bg-card/50 shrink-0">
                  <HelpCircle className="h-3.5 w-3.5 text-amber-500" />
                  <span className="text-xs font-semibold">Follow-Up Questions</span>
                </div>
                <ScrollArea className="flex-1">
                  <div className="p-2">
                    {followUpQuestions.length > 0 ? <FollowUpQuestionsPanel questions={followUpQuestions} /> : <p className="text-xs text-muted-foreground/50 py-3 text-center">Questions surface as the conversation progresses.</p>}
                  </div>
                </ScrollArea>
              </div>

              <div className="shrink-0 border-b border-border flex flex-col" style={{ maxHeight: "240px" }}>
                <div className="px-3 py-2 flex items-center gap-2 bg-card/50 shrink-0">
                  <AlertCircle className="h-3.5 w-3.5 text-primary" />
                  <span className="text-xs font-semibold">Detected Topics</span>
                  {topics.length > 0 && <Badge variant="secondary" className="text-[10px] h-4 px-1.5">{topics.length}</Badge>}
                </div>
                <ScrollArea className="flex-1">
                  <div className="p-2">
                    {topics.length > 0 ? <DashboardTopicGroups toolTopics={toolTopics} conceptTopics={conceptTopics} industryTopics={industryTopics} newTopicIds={newTopicIds} sessionId={activeSession?.id} /> : <p className="text-xs text-muted-foreground/50 py-3 text-center">{isDemoRunning ? "Terms appear as conversation plays..." : "IT terms will appear here as detected."}</p>}
                  </div>
                </ScrollArea>
              </div>

              <Tabs defaultValue="actions" className="flex-1 min-h-0 flex flex-col">
                <div className="px-2 pt-2 pb-0 shrink-0">
                  <TabsList className="h-7 w-full grid grid-cols-4">
                    <TabsTrigger value="actions" className="text-[10px] px-0 h-6">Actions</TabsTrigger>
                    <TabsTrigger value="projects" className="text-[10px] px-0 h-6">Projects</TabsTrigger>
                    <TabsTrigger value="methodology" className="text-[10px] px-0 h-6">Method</TabsTrigger>
                    <TabsTrigger value="sentiment" className="text-[10px] px-0 h-6">Sentiment</TabsTrigger>
                  </TabsList>
                </div>
                <TabsContent value="actions" className="flex-1 min-h-0 overflow-y-auto mt-0 p-2 data-[state=inactive]:hidden">
                  {actionItems.length > 0 ? <ActionItemsPanel items={actionItems} compact /> : <p className="text-xs text-muted-foreground/50 py-4 text-center">Action items will appear here.</p>}
                </TabsContent>
                <TabsContent value="projects" className="flex-1 min-h-0 overflow-y-auto mt-0 p-2 space-y-2 data-[state=inactive]:hidden">
                  {consolidatedProjects.length > 0 ? consolidatedProjects.map((match) => {
                    const project = referenceProjectsList.find(p => p.id === match.projectId);
                    const title = match.title || project?.title || `Project #${match.projectId}`;
                    return (
                      <div key={match.projectId} className="min-w-0">
                        <div className="flex items-center gap-1">
                          <span className="text-[11px] font-semibold truncate">{title}</span>
                          {project?.url && <a href={project.url} target="_blank" rel="noopener noreferrer" className="shrink-0 text-muted-foreground hover:text-foreground"><ExternalLink className="h-3 w-3" /></a>}
                        </div>
                        <p className="text-[10px] text-emerald-600 dark:text-emerald-400 leading-snug">{match.relevance}</p>
                      </div>
                    );
                  }) : <p className="text-xs text-muted-foreground/50 py-4 text-center">Projects surface as topics are detected.</p>}
                </TabsContent>
                <TabsContent value="methodology" className="flex-1 min-h-0 overflow-y-auto mt-0 p-2 data-[state=inactive]:hidden">
                  {methodologyProgress ? (
                    <div className="space-y-1">
                      {methodologyProgress.stages.map(stage => (
                        <div key={stage.id} className={`flex items-center gap-1.5 ${stage.completed ? "opacity-100" : "opacity-40"}`}>
                          {stage.completed ? <CheckCircle2 className="h-3 w-3 text-emerald-500 shrink-0" /> : <Circle className="h-3 w-3 text-muted-foreground shrink-0" />}
                          <span className={`text-[10px] ${stage.completed ? "font-medium text-foreground" : "text-muted-foreground"}`}>{stage.name}</span>
                        </div>
                      ))}
                    </div>
                  ) : <p className="text-xs text-muted-foreground/50 py-4 text-center">No methodology selected. Configure in Settings.</p>}
                </TabsContent>
                <TabsContent value="sentiment" className="flex-1 min-h-0 overflow-y-auto mt-0 p-2 data-[state=inactive]:hidden">
                  {sentimentData.length > 0 ? <SentimentEqualizerFull sentimentData={sentimentData} overallSentiment={overallSentiment} sessionStart={activeSession.createdAt instanceof Date ? activeSession.createdAt.toISOString() : activeSession.createdAt} /> : <p className="text-xs text-muted-foreground/50 py-4 text-center">Sentiment will appear as the conversation progresses.</p>}
                </TabsContent>
              </Tabs>
            </div>
          )}

          {hostRole === "engineer" && (() => {
            const LAYER_MAP: Record<string, string> = {
              infrastructure: "infra", cloud: "infra", networking: "infra", monitoring: "infra",
              data: "data", "ai-ml": "data",
              development: "app", devops: "app", methodology: "app", collaboration: "app",
              security: "security",
              integration: "integration",
            };
            const LAYER_META: Record<string, { label: string; icon: React.ReactNode; color: string }> = {
              app:         { label: "Application",   icon: <Cpu className="h-3 w-3" />,      color: "text-blue-500" },
              data:        { label: "Data & AI",     icon: <Database className="h-3 w-3" />, color: "text-purple-500" },
              infra:       { label: "Infra & Cloud", icon: <Server className="h-3 w-3" />,   color: "text-emerald-500" },
              security:    { label: "Security",      icon: <Lock className="h-3 w-3" />,     color: "text-red-500" },
              integration: { label: "Integration",   icon: <Plug className="h-3 w-3" />,     color: "text-orange-500" },
              other:       { label: "Other",         icon: <Lightbulb className="h-3 w-3" />, color: "text-muted-foreground" },
            };
            const byLayer: Record<string, Topic[]> = {};
            for (const t of topics) {
              const layer = LAYER_MAP[t.category] ?? "other";
              (byLayer[layer] = byLayer[layer] || []).push(t);
            }
            const layerOrder = ["app", "data", "infra", "security", "integration", "other"];
            return (
              <div className="flex flex-col w-1/2 min-h-0 overflow-hidden" data-testid="role-rail-se">
                <div className="shrink-0 border-b border-border flex flex-col" style={{ maxHeight: "260px" }}>
                  <div className="px-3 py-2 flex items-center gap-2 bg-card/50 shrink-0">
                    <Layers className="h-3.5 w-3.5 text-primary" />
                    <span className="text-xs font-semibold">Tech Stack</span>
                    {topics.length > 0 && <Badge variant="secondary" className="text-[10px] h-4 px-1.5">{topics.filter(t => t.type === "tool").length} tools</Badge>}
                  </div>
                  <ScrollArea className="flex-1">
                    <div className="px-3 py-2 space-y-2">
                      {layerOrder.filter(l => byLayer[l]?.length).map(layer => {
                        const meta = LAYER_META[layer];
                        return (
                          <div key={layer}>
                            <div className={`flex items-center gap-1.5 mb-1 ${meta.color}`}>
                              {meta.icon}
                              <span className="text-[9px] font-semibold uppercase tracking-wide">{meta.label}</span>
                            </div>
                            <div className="flex flex-wrap gap-1">
                              {byLayer[layer].map(t => (
                                <Badge key={t.id} variant={newTopicIds.has(t.id) ? "default" : "outline"} className="text-[10px] h-5 px-1.5">{t.term}</Badge>
                              ))}
                            </div>
                          </div>
                        );
                      })}
                      {topics.length === 0 && <p className="text-xs text-muted-foreground/50 py-3 text-center">{isDemoRunning ? "Stack populates as terms are detected..." : "Technology stack appears here."}</p>}
                    </div>
                  </ScrollArea>
                </div>
                <div className="shrink-0 border-b border-border flex flex-col" style={{ maxHeight: "200px" }}>
                  <div className="px-3 py-2 flex items-center gap-2 bg-card/50 shrink-0">
                    <HelpCircle className="h-3.5 w-3.5 text-amber-500" />
                    <span className="text-xs font-semibold">Follow-Up Questions</span>
                  </div>
                  <ScrollArea className="flex-1">
                    <div className="p-2">
                      {followUpQuestions.length > 0 ? <FollowUpQuestionsPanel questions={followUpQuestions} /> : <p className="text-xs text-muted-foreground/50 py-3 text-center">Technical questions surface as the call progresses.</p>}
                    </div>
                  </ScrollArea>
                </div>
                <Tabs defaultValue="topics" className="flex-1 min-h-0 flex flex-col">
                  <div className="px-2 pt-2 pb-0 shrink-0">
                    <TabsList className="h-7 w-full grid grid-cols-4">
                      <TabsTrigger value="topics" className="text-[10px] px-0 h-6">All Topics</TabsTrigger>
                      <TabsTrigger value="actions" className="text-[10px] px-0 h-6">Actions</TabsTrigger>
                      <TabsTrigger value="projects" className="text-[10px] px-0 h-6">Projects</TabsTrigger>
                      <TabsTrigger value="sentiment" className="text-[10px] px-0 h-6">Sentiment</TabsTrigger>
                    </TabsList>
                  </div>
                  <TabsContent value="topics" className="flex-1 min-h-0 overflow-y-auto mt-0 p-2 data-[state=inactive]:hidden">
                    {topics.length > 0 ? <DashboardTopicGroups toolTopics={toolTopics} conceptTopics={conceptTopics} industryTopics={industryTopics} newTopicIds={newTopicIds} sessionId={activeSession?.id} /> : <p className="text-xs text-muted-foreground/50 py-4 text-center">IT terms appear here as detected.</p>}
                  </TabsContent>
                  <TabsContent value="actions" className="flex-1 min-h-0 overflow-y-auto mt-0 p-2 data-[state=inactive]:hidden">
                    {actionItems.length > 0 ? <ActionItemsPanel items={actionItems} compact /> : <p className="text-xs text-muted-foreground/50 py-4 text-center">Action items will appear here.</p>}
                  </TabsContent>
                  <TabsContent value="projects" className="flex-1 min-h-0 overflow-y-auto mt-0 p-2 space-y-2 data-[state=inactive]:hidden">
                    {consolidatedProjects.length > 0 ? consolidatedProjects.map((match) => {
                      const project = referenceProjectsList.find(p => p.id === match.projectId);
                      const title = match.title || project?.title || `Project #${match.projectId}`;
                      return (<div key={match.projectId} className="min-w-0"><span className="text-[11px] font-semibold truncate block">{title}</span><p className="text-[10px] text-emerald-600 dark:text-emerald-400 leading-snug">{match.relevance}</p></div>);
                    }) : <p className="text-xs text-muted-foreground/50 py-4 text-center">Similar projects surface as topics are detected.</p>}
                  </TabsContent>
                  <TabsContent value="sentiment" className="flex-1 min-h-0 overflow-y-auto mt-0 p-2 data-[state=inactive]:hidden">
                    {sentimentData.length > 0 ? <SentimentEqualizerFull sentimentData={sentimentData} overallSentiment={overallSentiment} sessionStart={activeSession.createdAt instanceof Date ? activeSession.createdAt.toISOString() : activeSession.createdAt} /> : <p className="text-xs text-muted-foreground/50 py-4 text-center">Sentiment will appear as the conversation progresses.</p>}
                  </TabsContent>
                </Tabs>
              </div>
            );
          })()}

          {hostRole === "producer" && (
            <div className="flex flex-col w-1/2 min-h-0 overflow-hidden" data-testid="role-rail-pm">
              <div className="shrink-0 border-b border-border flex flex-col" style={{ maxHeight: "220px" }}>
                <div className="px-3 py-2 flex items-center gap-2 bg-card/50 shrink-0">
                  <ClipboardList className="h-3.5 w-3.5 text-primary" />
                  <span className="text-xs font-semibold">Action Items</span>
                  {actionItems.length > 0 && <Badge variant="secondary" className="text-[10px] h-4 px-1.5">{actionItems.length}</Badge>}
                </div>
                <ScrollArea className="flex-1">
                  <div className="px-3 py-1.5 space-y-1">
                    {actionItems.length > 0 ? actionItems.map((item, i) => (
                      <div key={i} className="flex items-start gap-2 min-w-0">
                        <span className="text-[10px] text-muted-foreground/50 shrink-0 tabular-nums pt-px">{i + 1}.</span>
                        <span className="text-[11px] leading-snug text-foreground/90 min-w-0">{item.text}</span>
                      </div>
                    )) : <p className="text-xs text-muted-foreground/50 py-3 text-center">Commitments and tasks appear here.</p>}
                  </div>
                </ScrollArea>
              </div>
              <div className="shrink-0 border-b border-border flex flex-col" style={{ maxHeight: "180px" }}>
                <div className="px-3 py-2 flex items-center gap-2 bg-card/50 shrink-0">
                  <CalendarClock className="h-3.5 w-3.5 text-blue-500" />
                  <span className="text-xs font-semibold">Timeline Signals</span>
                  {timelineSignals.length > 0 && <Badge variant="secondary" className="text-[10px] h-4 px-1.5">{timelineSignals.length}</Badge>}
                </div>
                <ScrollArea className="flex-1">
                  <div className="px-3 py-1.5 space-y-1.5">
                    {timelineSignals.length > 0 ? timelineSignals.map((s, i) => (
                      <div key={i} className="flex items-start gap-2 min-w-0">
                        <span className={`text-[10px] font-semibold shrink-0 ${s.urgency === "high" ? "text-red-500" : s.urgency === "medium" ? "text-amber-500" : "text-muted-foreground"}`}>{s.date}</span>
                        <span className="text-[10px] text-foreground/80 leading-snug min-w-0">{s.context}</span>
                      </div>
                    )) : <p className="text-xs text-muted-foreground/50 py-2 text-center">Dates and deadlines surface here.</p>}
                  </div>
                </ScrollArea>
              </div>
              <div className="shrink-0 border-b border-border flex flex-col" style={{ maxHeight: "160px" }}>
                <div className="px-3 py-2 flex items-center gap-2 bg-card/50 shrink-0">
                  <AlertTriangle className="h-3.5 w-3.5 text-red-500" />
                  <span className="text-xs font-semibold">Risks & Dependencies</span>
                  {riskFlags.length > 0 && <Badge variant="secondary" className="text-[10px] h-4 px-1.5">{riskFlags.length}</Badge>}
                </div>
                <ScrollArea className="flex-1">
                  <div className="px-3 py-1.5 space-y-1">
                    {riskFlags.length > 0 ? riskFlags.map((r, i) => (
                      <div key={i} className="flex items-start gap-2 min-w-0">
                        <span className={`text-[9px] font-semibold uppercase shrink-0 pt-px ${r.type === "blocker" ? "text-red-500" : r.type === "dependency" ? "text-amber-500" : "text-muted-foreground"}`}>{r.type ?? "risk"}</span>
                        <span className="text-[11px] leading-snug text-foreground/90 min-w-0">{r.text}</span>
                      </div>
                    )) : <p className="text-xs text-muted-foreground/50 py-2 text-center">Blockers and dependencies appear here.</p>}
                  </div>
                </ScrollArea>
              </div>
              <Tabs defaultValue="followups" className="flex-1 min-h-0 flex flex-col">
                <div className="px-2 pt-2 pb-0 shrink-0">
                  <TabsList className="h-7 w-full grid grid-cols-4">
                    <TabsTrigger value="followups" className="text-[10px] px-0 h-6">Questions</TabsTrigger>
                    <TabsTrigger value="topics" className="text-[10px] px-0 h-6">Topics</TabsTrigger>
                    <TabsTrigger value="projects" className="text-[10px] px-0 h-6">Projects</TabsTrigger>
                    <TabsTrigger value="sentiment" className="text-[10px] px-0 h-6">Sentiment</TabsTrigger>
                  </TabsList>
                </div>
                <TabsContent value="followups" className="flex-1 min-h-0 overflow-y-auto mt-0 p-2 data-[state=inactive]:hidden">
                  {followUpQuestions.length > 0 ? <FollowUpQuestionsPanel questions={followUpQuestions} /> : <p className="text-xs text-muted-foreground/50 py-4 text-center">Questions surface as the call progresses.</p>}
                </TabsContent>
                <TabsContent value="topics" className="flex-1 min-h-0 overflow-y-auto mt-0 p-2 data-[state=inactive]:hidden">
                  {topics.length > 0 ? <DashboardTopicGroups toolTopics={toolTopics} conceptTopics={conceptTopics} industryTopics={industryTopics} newTopicIds={newTopicIds} sessionId={activeSession?.id} /> : <p className="text-xs text-muted-foreground/50 py-4 text-center">IT terms appear here as detected.</p>}
                </TabsContent>
                <TabsContent value="projects" className="flex-1 min-h-0 overflow-y-auto mt-0 p-2 space-y-2 data-[state=inactive]:hidden">
                  {consolidatedProjects.length > 0 ? consolidatedProjects.map((match) => {
                    const project = referenceProjectsList.find(p => p.id === match.projectId);
                    const title = match.title || project?.title || `Project #${match.projectId}`;
                    return (<div key={match.projectId} className="min-w-0"><span className="text-[11px] font-semibold truncate block">{title}</span><p className="text-[10px] text-emerald-600 dark:text-emerald-400 leading-snug">{match.relevance}</p></div>);
                  }) : <p className="text-xs text-muted-foreground/50 py-4 text-center">Similar projects surface as topics are detected.</p>}
                </TabsContent>
                <TabsContent value="sentiment" className="flex-1 min-h-0 overflow-y-auto mt-0 p-2 data-[state=inactive]:hidden">
                  {sentimentData.length > 0 ? <SentimentEqualizerFull sentimentData={sentimentData} overallSentiment={overallSentiment} sessionStart={activeSession.createdAt instanceof Date ? activeSession.createdAt.toISOString() : activeSession.createdAt} /> : <p className="text-xs text-muted-foreground/50 py-4 text-center">Sentiment will appear as the conversation progresses.</p>}
                </TabsContent>
              </Tabs>
            </div>
          )}

          {hostRole === "correspondent" && (
            <div className="flex flex-col w-1/2 min-h-0 overflow-hidden" data-testid="role-rail-ba">
              <div className="shrink-0 border-b border-border flex flex-col" style={{ maxHeight: "220px" }}>
                <div className="px-3 py-2 flex items-center gap-2 bg-card/50 shrink-0">
                  <ListChecks className="h-3.5 w-3.5 text-primary" />
                  <span className="text-xs font-semibold">Requirements</span>
                  {requirements.length > 0 && <Badge variant="secondary" className="text-[10px] h-4 px-1.5">{requirements.length}</Badge>}
                </div>
                <ScrollArea className="flex-1">
                  <div className="px-3 py-1.5 space-y-1">
                    {requirements.length > 0 ? requirements.map((r, i) => (
                      <div key={i} className="flex items-start gap-2 min-w-0">
                        <span className="text-[10px] text-muted-foreground/50 shrink-0 tabular-nums pt-px">{i + 1}.</span>
                        <div className="min-w-0"><span className="text-[11px] leading-snug text-foreground/90">{r.text}</span>{r.source && <span className="text-[9px] text-muted-foreground ml-1">— {r.source}</span>}</div>
                      </div>
                    )) : <p className="text-xs text-muted-foreground/50 py-3 text-center">Client requirements appear here as stated.</p>}
                  </div>
                </ScrollArea>
              </div>
              <div className="shrink-0 border-b border-border flex flex-col" style={{ maxHeight: "180px" }}>
                <div className="px-3 py-2 flex items-center gap-2 bg-card/50 shrink-0">
                  <Siren className="h-3.5 w-3.5 text-red-500" />
                  <span className="text-xs font-semibold">Pain Points</span>
                  {painPoints.length > 0 && <Badge variant="secondary" className="text-[10px] h-4 px-1.5">{painPoints.length}</Badge>}
                </div>
                <ScrollArea className="flex-1">
                  <div className="px-3 py-1.5 space-y-1.5">
                    {painPoints.length > 0 ? painPoints.map((p, i) => (
                      <div key={i} className="min-w-0">
                        <p className="text-[11px] leading-snug text-foreground/90">{p.text}</p>
                        {p.impact && <p className="text-[10px] text-red-500/70 italic">{p.impact}</p>}
                      </div>
                    )) : <p className="text-xs text-muted-foreground/50 py-2 text-center">Business problems surface here.</p>}
                  </div>
                </ScrollArea>
              </div>
              {liveSpeakers.length > 0 && (
                <div className="shrink-0 border-b border-border">
                  <div className="px-3 py-2 flex items-center gap-2 bg-card/50">
                    <Users className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="text-xs font-semibold">Stakeholders</span>
                  </div>
                  <div className="px-3 py-1.5 flex flex-wrap gap-2">
                    {liveSpeakers.map((s, i) => {
                      const color = getSpeakerColorByIndex(i);
                      return (
                        <div key={s.name} className="flex items-center gap-1.5">
                          <span className={`h-2 w-2 rounded-full shrink-0 ${color.text.replace("text-", "bg-")}`} />
                          <span className={`text-[11px] font-medium ${color.text}`}>{s.name}</span>
                          {s.title && <span className="text-[9px] text-muted-foreground">{s.title}</span>}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
              <Tabs defaultValue="followups" className="flex-1 min-h-0 flex flex-col">
                <div className="px-2 pt-2 pb-0 shrink-0">
                  <TabsList className="h-7 w-full grid grid-cols-5">
                    <TabsTrigger value="followups" className="text-[10px] px-0 h-6">Questions</TabsTrigger>
                    <TabsTrigger value="sipoc" className="text-[10px] px-0 h-6" data-testid="tab-ba-sipoc">SIPOC</TabsTrigger>
                    <TabsTrigger value="topics" className="text-[10px] px-0 h-6">Topics</TabsTrigger>
                    <TabsTrigger value="actions" className="text-[10px] px-0 h-6">Actions</TabsTrigger>
                    <TabsTrigger value="sentiment" className="text-[10px] px-0 h-6">Sentiment</TabsTrigger>
                  </TabsList>
                </div>
                <TabsContent value="followups" className="flex-1 min-h-0 overflow-y-auto mt-0 p-2 data-[state=inactive]:hidden">
                  {followUpQuestions.length > 0 ? <FollowUpQuestionsPanel questions={followUpQuestions} /> : <p className="text-xs text-muted-foreground/50 py-4 text-center">Questions surface as the call progresses.</p>}
                </TabsContent>
                <TabsContent value="sipoc" className="flex-1 min-h-0 overflow-y-auto mt-0 p-2 data-[state=inactive]:hidden">
                  <SipocBoard data={sipocData} compact />
                </TabsContent>
                <TabsContent value="topics" className="flex-1 min-h-0 overflow-y-auto mt-0 p-2 data-[state=inactive]:hidden">
                  {topics.length > 0 ? <DashboardTopicGroups toolTopics={toolTopics} conceptTopics={conceptTopics} industryTopics={industryTopics} newTopicIds={newTopicIds} sessionId={activeSession?.id} /> : <p className="text-xs text-muted-foreground/50 py-4 text-center">IT terms appear here as detected.</p>}
                </TabsContent>
                <TabsContent value="actions" className="flex-1 min-h-0 overflow-y-auto mt-0 p-2 data-[state=inactive]:hidden">
                  {actionItems.length > 0 ? <ActionItemsPanel items={actionItems} compact /> : <p className="text-xs text-muted-foreground/50 py-4 text-center">Action items will appear here.</p>}
                </TabsContent>
                <TabsContent value="sentiment" className="flex-1 min-h-0 overflow-y-auto mt-0 p-2 data-[state=inactive]:hidden">
                  {sentimentData.length > 0 ? <SentimentEqualizerFull sentimentData={sentimentData} overallSentiment={overallSentiment} sessionStart={activeSession.createdAt instanceof Date ? activeSession.createdAt.toISOString() : activeSession.createdAt} /> : <p className="text-xs text-muted-foreground/50 py-4 text-center">Sentiment will appear as the conversation progresses.</p>}
                </TabsContent>
              </Tabs>
            </div>
          )}

        </div>

        )}
      </div>
    </div>
  );
}
