import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useSettings, useUpdateSettings } from "@/hooks/use-settings";
import { useToast } from "@/hooks/use-toast";
import { Settings, Mic, ClipboardList, Briefcase, Cpu, Bot, LinkIcon, Plus, X, TrendingUp, ChevronDown, Key, AlertCircle, CheckCircle2 } from "lucide-react";
import { MicTestWidget } from "@/components/mic-test-widget";

const HOST_ROLES = [
  {
    id: "host",
    name: "Show Host",
    role: "PreSales Architect",
    description: "Technical discovery, solution fit, and competitive positioning. Follow-ups focus on scalability, integration, and TCO.",
    icon: Mic,
  },
  {
    id: "producer",
    name: "Producer",
    role: "Project Manager",
    description: "Timelines, risks, deliverables, and stakeholder alignment. Action items emphasize milestones and resource planning.",
    icon: ClipboardList,
  },
  {
    id: "engineer",
    name: "Sound Engineer",
    role: "Technical Resource",
    description: "Architecture details, integration points, and technical debt. Follow-ups probe system design and performance.",
    icon: Cpu,
  },
  {
    id: "correspondent",
    name: "Correspondent",
    role: "Business Analyst",
    description: "Requirements, business processes, ROI, and stakeholder needs. Action items focus on documentation and gap analysis.",
    icon: Briefcase,
  },
  {
    id: "account-executive",
    name: "Deal Signal",
    role: "Account Executive",
    description: "Sales discovery, BANT qualification, and deal progression. Live dashboard tracks Budget, Authority, Needs, and Timeline as the conversation unfolds. Follow-ups are guided by your chosen sales methodology.",
    icon: TrendingUp,
  },
] as const;

const SALES_METHODOLOGIES = [
  {
    id: "sandler",
    name: "Sandler Selling",
    description: "Pain Funnel methodology — surface pain, quantify business and personal impact, confirm budget and decision process, then present fulfillment. 8 stages tracked.",
  },
  {
    id: "meddic",
    name: "MEDDIC",
    description: "Enterprise sales qualification — Metrics, Economic Buyer, Decision Criteria, Decision Process, Identify Pain, Champion. 6 stages tracked.",
  },
  {
    id: "spin",
    name: "SPIN Selling",
    description: "Question-driven discovery — Situation, Problem, Implication, and Need-Payoff questions to build urgency and value. 4 stages tracked.",
  },
  {
    id: "challenger",
    name: "Challenger Sale",
    description: "Teach-Tailor-Take Control framework — reframe the prospect's thinking with insight, then position your solution as the only logical path forward. 6 stages tracked.",
  },
] as const;

export default function StudioSettings() {
  const { toast } = useToast();

  const { data: settings, isLoading } = useSettings();
  const updateMutation = useUpdateSettings();

  const currentRole = settings?.hostRole || "host";
  const currentAnalysisModel = settings?.analysisModel || "gpt-4o-mini";
  const currentTranscriptionModel = settings?.transcriptionModel || "gpt-4o-mini-transcribe";
  const currentCaseStudyUrls = settings?.caseStudyUrls || [];
  const currentSalesMethodology = (settings as any)?.salesMethodology as string | null ?? null;
  const isAERole = currentRole === "account-executive";

  const [newUrl, setNewUrl] = useState("");

  // OpenAI API key — stored in electron-store, not the database.
  const isElectron = !!window.electronAudio;
  const [apiKey, setApiKey] = useState("");
  const [apiKeyInput, setApiKeyInput] = useState("");
  const [savingKey, setSavingKey] = useState(false);

  useEffect(() => {
    if (!window.electronAudio) return;
    window.electronAudio.getApiKey().then((k) => {
      setApiKey(k);
      setApiKeyInput(k);
    });
  }, []);

  async function handleSaveApiKey() {
    if (!window.electronAudio) return;
    setSavingKey(true);
    try {
      await window.electronAudio.setApiKey(apiKeyInput.trim());
      setApiKey(apiKeyInput.trim());
      toast({ title: "API key saved", description: "The server will use the new key immediately." });
    } catch {
      toast({ title: "Failed to save API key", variant: "destructive" });
    } finally {
      setSavingKey(false);
    }
  }

  function handleAddUrl() {
    const trimmed = newUrl.trim();
    if (!trimmed) return;
    try {
      new URL(trimmed);
    } catch {
      toast({ title: "Invalid URL", description: "Please enter a valid URL starting with http:// or https://", variant: "destructive" });
      return;
    }
    if (currentCaseStudyUrls.includes(trimmed)) {
      toast({ title: "Duplicate URL", description: "This URL is already in your list.", variant: "destructive" });
      return;
    }
    updateMutation.mutate({ caseStudyUrls: [...currentCaseStudyUrls, trimmed] });
    setNewUrl("");
  }

  function handleRemoveUrl(url: string) {
    updateMutation.mutate({ caseStudyUrls: currentCaseStudyUrls.filter((u: string) => u !== url) });
  }

  return (
    <div className="flex flex-col h-full">
      <div className="border-b border-border bg-background/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="flex items-center gap-3 p-4">
          <Settings className="h-5 w-5 text-primary" />
          <h1 className="text-lg font-semibold" data-testid="text-page-title">Studio Settings</h1>
        </div>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-4 max-w-2xl mx-auto space-y-6">
          <div>
            <h2 className="text-sm font-semibold mb-1">Your Role</h2>
            <p className="text-xs text-muted-foreground mb-4">
              Choose your host role to tailor how OnTopic analyzes meetings. Your role shapes the Key Takeaway, Action Items, and Follow-Up Questions.
            </p>

            {isLoading ? (
              <div className="space-y-3">
                {Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton key={i} className="h-24 w-full rounded-lg" />
                ))}
              </div>
            ) : (
              <div className="space-y-2">
                {HOST_ROLES.map((role) => {
                  const isSelected = currentRole === role.id;
                  const Icon = role.icon;

                  return (
                    <Card
                      key={role.id}
                      className={`p-4 cursor-pointer transition-all ${
                        isSelected
                          ? "border-primary bg-primary/5 ring-1 ring-primary/20"
                          : "hover:border-primary/30"
                      }`}
                      onClick={() => updateMutation.mutate({ hostRole: role.id })}
                      data-testid={`card-role-${role.id}`}
                    >
                      <div className="flex items-start gap-3">
                        <div className={`flex h-9 w-9 items-center justify-center rounded-lg shrink-0 ${
                          isSelected ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                        }`}>
                          <Icon className="h-4 w-4" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-semibold">{role.name}</span>
                            <Badge variant="secondary" className="text-[10px] h-4">{role.role}</Badge>
                            {isSelected && (
                              <Badge className="text-[10px] h-4 bg-primary text-primary-foreground">Active</Badge>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{role.description}</p>
                        </div>
                      </div>
                    </Card>
                  );
                })}
              </div>
            )}
          </div>

          {isAERole && (
            <div className="border-t border-border pt-4">
              <div className="flex items-center gap-2 mb-1">
                <TrendingUp className="h-4 w-4 text-primary" />
                <h2 className="text-sm font-semibold">Sales Methodology</h2>
              </div>
              <p className="text-xs text-muted-foreground mb-4">
                Choose your company's sales methodology. OnTopic will track which stages have been covered during the call and bias follow-up questions toward what the methodology says to ask next.
              </p>
              {isLoading ? (
                <div className="space-y-2">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <div key={i} className="h-16 rounded-lg bg-muted animate-pulse" />
                  ))}
                </div>
              ) : (
                <div className="space-y-2">
                  <Card
                    className={`p-3 cursor-pointer transition-all ${!currentSalesMethodology ? "border-primary bg-primary/5 ring-1 ring-primary/20" : "hover:border-primary/30"}`}
                    onClick={() => updateMutation.mutate({ salesMethodology: null } as any)}
                    data-testid="card-methodology-none"
                  >
                    <div className="flex items-center gap-2">
                      <div className={`flex h-7 w-7 items-center justify-center rounded shrink-0 ${!currentSalesMethodology ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>
                        <ChevronDown className="h-3.5 w-3.5" />
                      </div>
                      <div>
                        <span className="text-sm font-semibold">No Methodology</span>
                        {!currentSalesMethodology && <Badge className="text-[10px] h-4 bg-primary text-primary-foreground ml-2">Active</Badge>}
                        <p className="text-xs text-muted-foreground mt-0.5">BANT tracking active. No specific methodology stages will be tracked.</p>
                      </div>
                    </div>
                  </Card>
                  {SALES_METHODOLOGIES.map((method) => {
                    const isSelected = currentSalesMethodology === method.id;
                    return (
                      <Card
                        key={method.id}
                        className={`p-3 cursor-pointer transition-all ${isSelected ? "border-primary bg-primary/5 ring-1 ring-primary/20" : "hover:border-primary/30"}`}
                        onClick={() => updateMutation.mutate({ salesMethodology: method.id } as any)}
                        data-testid={`card-methodology-${method.id}`}
                      >
                        <div className="flex items-start gap-2">
                          <div className={`flex h-7 w-7 items-center justify-center rounded shrink-0 mt-0.5 ${isSelected ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>
                            <TrendingUp className="h-3.5 w-3.5" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-semibold">{method.name}</span>
                              {isSelected && <Badge className="text-[10px] h-4 bg-primary text-primary-foreground">Active</Badge>}
                            </div>
                            <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{method.description}</p>
                          </div>
                        </div>
                      </Card>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          <div className="border-t border-border pt-4">
            <div className="flex items-center gap-2 mb-1">
              <Bot className="h-4 w-4 text-primary" />
              <h2 className="text-sm font-semibold">AI Models</h2>
            </div>
            <p className="text-xs text-muted-foreground mb-4">
              Choose which language models OnTopic uses for analysis and transcription.
            </p>

            {isLoading ? (
              <div className="space-y-3">
                <Skeleton className="h-10 w-full rounded-lg" />
                <Skeleton className="h-10 w-full rounded-lg" />
              </div>
            ) : (
              <div className="space-y-4">
                <div>
                  <label className="text-xs font-medium text-foreground mb-1.5 block">Analysis Model</label>
                  <p className="text-[11px] text-muted-foreground mb-1.5">Used for term detection, sentiment, action items, follow-ups, and summaries.</p>
                  <Select value={currentAnalysisModel} onValueChange={(v) => updateMutation.mutate({ analysisModel: v })}>
                    <SelectTrigger className="h-9 text-sm" data-testid="select-analysis-model">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="gpt-4o-mini">gpt-4o-mini (default, fast)</SelectItem>
                      <SelectItem value="gpt-4o">gpt-4o (higher quality)</SelectItem>
                        <SelectItem value="gpt-4.1-nano">gpt-4.1-nano (fastest)</SelectItem>
                        <SelectItem value="gpt-4.1-mini">gpt-4.1-mini</SelectItem>
                        <SelectItem value="gpt-4.1">gpt-4.1 (most capable, higher cost)</SelectItem>
                        <SelectItem value="o3-mini">o3-mini (reasoning model)</SelectItem>
                        <SelectItem value="o4-mini">o4-mini (fast reasoning)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <label className="text-xs font-medium text-foreground mb-1.5 block">Transcription Model</label>
                  <p className="text-[11px] text-muted-foreground mb-1.5">Used for converting speech to text during live episodes.</p>
                  <Select value={currentTranscriptionModel} onValueChange={(v) => updateMutation.mutate({ transcriptionModel: v })}>
                    <SelectTrigger className="h-9 text-sm" data-testid="select-transcription-model">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="gpt-4o-mini-transcribe">gpt-4o-mini-transcribe (default)</SelectItem>
                      <SelectItem value="gpt-4o-transcribe">gpt-4o-transcribe (higher accuracy)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}
          </div>

          <div className="border-t border-border pt-4">
            <div className="flex items-center gap-2 mb-1">
              <LinkIcon className="h-4 w-4 text-primary" />
              <h2 className="text-sm font-semibold">Case Study Sources</h2>
            </div>
            <p className="text-xs text-muted-foreground mb-4">
              Add URLs to your company's case study or portfolio pages. These can be scraped from the Reference Library to populate project references.
            </p>

            {isLoading ? (
              <Skeleton className="h-20 w-full rounded-lg" />
            ) : (
              <div className="space-y-3">
                <div className="flex gap-2">
                  <Input
                    placeholder="https://example.com/case-studies"
                    value={newUrl}
                    onChange={(e) => setNewUrl(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleAddUrl()}
                    className="h-9 text-sm"
                    data-testid="input-case-study-url"
                  />
                  <Button
                    size="sm"
                    className="h-9 shrink-0"
                    onClick={handleAddUrl}
                    disabled={!newUrl.trim() || updateMutation.isPending}
                    data-testid="button-add-case-study-url"
                  >
                    <Plus className="h-3.5 w-3.5 mr-1" />
                    Add
                  </Button>
                </div>

                {currentCaseStudyUrls.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {currentCaseStudyUrls.map((url: string) => (
                      <Badge
                        key={url}
                        variant="secondary"
                        className="text-xs py-1 px-2.5 gap-1.5 max-w-full"
                      >
                        <LinkIcon className="h-3 w-3 shrink-0 text-muted-foreground" />
                        <span className="truncate" data-testid={`text-case-study-url`}>{url}</span>
                        <button
                          className="ml-0.5 hover:text-destructive transition-colors shrink-0"
                          onClick={() => handleRemoveUrl(url)}
                          data-testid={`button-remove-url`}
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </Badge>
                    ))}
                  </div>
                ) : (
                  <p className="text-[11px] text-muted-foreground italic">No case study URLs configured yet.</p>
                )}
              </div>
            )}
          </div>

          {isElectron && (
            <div className="border-t border-border pt-4">
              <div className="flex items-center gap-2 mb-1">
                <Key className="h-4 w-4 text-primary" />
                <h2 className="text-sm font-semibold">OpenAI API Key</h2>
                {!apiKey ? (
                  <span className="flex items-center gap-1 text-[10px] font-semibold text-amber-600 dark:text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded">
                    <AlertCircle className="h-3 w-3" /> Required
                  </span>
                ) : (
                  <span className="flex items-center gap-1 text-[10px] font-semibold text-green-600 dark:text-green-400 bg-green-500/10 px-1.5 py-0.5 rounded">
                    <CheckCircle2 className="h-3 w-3" /> Configured
                  </span>
                )}
              </div>
              <p className="text-xs text-muted-foreground mb-4">
                Your API key is stored locally on this device and never sent to any external server.
                It is passed directly to the OpenAI API for transcription and analysis.
              </p>
              {!apiKey && (
                <p className="text-xs text-amber-600 dark:text-amber-400 mb-3 flex items-start gap-2">
                  <AlertCircle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                  No API key set. You won&apos;t be able to transcribe or analyze audio until you add one.
                  Get your key at <a href="https://platform.openai.com/api-keys" target="_blank" rel="noreferrer" className="underline">platform.openai.com/api-keys</a>.
                </p>
              )}
              <div className="flex gap-2">
                <Input
                  type="password"
                  placeholder="sk-..."
                  value={apiKeyInput}
                  onChange={(e) => setApiKeyInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSaveApiKey()}
                  className="h-9 text-sm font-mono"
                  data-testid="input-api-key"
                />
                <Button
                  size="sm"
                  className="h-9 shrink-0"
                  onClick={handleSaveApiKey}
                  disabled={savingKey || apiKeyInput.trim() === apiKey}
                  data-testid="button-save-api-key"
                >
                  Save
                </Button>
              </div>
              {apiKey && (
                <p className="text-[11px] text-muted-foreground mt-2">
                  Key saved: {apiKey.slice(0, 7)}…{apiKey.slice(-4)}
                </p>
              )}
            </div>
          )}

          <div className="border-t border-border pt-4">
            <div className="flex items-center gap-2 mb-1">
              <Mic className="h-4 w-4 text-primary" />
              <h2 className="text-sm font-semibold">Microphone</h2>
            </div>
            <p className="text-xs text-muted-foreground mb-4">
              Select and test your microphone before starting a session. Speak normally — the meter should respond as you talk.
            </p>
            <MicTestWidget />
          </div>

          <div className="border-t border-border pt-4">
            <h2 className="text-sm font-semibold mb-1">How Roles Work</h2>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Your host role influences three areas of the AI analysis during episodes:
            </p>
            <ul className="mt-2 space-y-1.5 text-xs text-muted-foreground">
              <li className="flex items-start gap-2">
                <span className="text-primary font-semibold mt-0.5">1.</span>
                <span><strong className="text-foreground">Key Takeaway</strong> — The episode summary is written from your role's perspective, highlighting what matters most to you.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-primary font-semibold mt-0.5">2.</span>
                <span><strong className="text-foreground">Action Items</strong> — Tasks are extracted based on what your role would prioritize (technical tasks vs project milestones vs business requirements).</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-primary font-semibold mt-0.5">3.</span>
                <span><strong className="text-foreground">Follow-Up Questions</strong> — Questions are framed from your professional lens, asking what matters most for your role.</span>
              </li>
            </ul>
          </div>
        </div>
      </ScrollArea>
    </div>
  );
}
