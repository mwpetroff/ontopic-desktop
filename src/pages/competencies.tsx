import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useCompetencies, useCreateCompetency, useUpdateCompetency, useDeleteCompetency } from "@/hooks/use-competencies";
import { useCreatePartner } from "@/hooks/use-partners";
import { Briefcase, Plus, Trash2, Globe, Loader2, Package, Wrench, Layers, Check, X, Pencil } from "lucide-react";
import type { Competency } from "@shared/schema";

const TYPE_CONFIG = {
  service: { label: "Services", icon: Wrench, color: "text-blue-600 dark:text-blue-400" },
  product: { label: "Products", icon: Package, color: "text-purple-600 dark:text-purple-400" },
  offering: { label: "Offerings", icon: Layers, color: "text-amber-600 dark:text-amber-400" },
} as const;

interface ScrapeResult {
  name: string;
  type: string;
  description: string;
  partnerName?: string;
}

export default function Competencies() {
  const { toast } = useToast();
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [scrapeOpen, setScrapeOpen] = useState(false);
  const [scrapeUrl, setScrapeUrl] = useState("");
  const [scrapeSuggestions, setScrapeSuggestions] = useState<ScrapeResult[]>([]);
  const [selectedSuggestions, setSelectedSuggestions] = useState<Set<number>>(new Set());
  const [scrapeSource, setScrapeSource] = useState<"in-house" | "partner">("in-house");
  const [scrapePartnerName, setScrapePartnerName] = useState("");
  const [scrapeConsultancyName, setScrapeConsultancyName] = useState("");
  const [isPartnerPage, setIsPartnerPage] = useState(false);

  const [formName, setFormName] = useState("");
  const [formType, setFormType] = useState<"service" | "product" | "offering">("service");
  const [formSource, setFormSource] = useState<"in-house" | "partner">("in-house");
  const [formPartnerName, setFormPartnerName] = useState("");
  const [formDescription, setFormDescription] = useState("");

  const { data: competencies, isLoading } = useCompetencies();
  const createMutation = useCreateCompetency();
  const baseUpdateMutation = useUpdateCompetency();
  const updateMutation = {
    ...baseUpdateMutation,
    mutate: (args: { id: number; data: Partial<Competency> }) => {
      baseUpdateMutation.mutate(args, {
        onSuccess: () => setEditingId(null),
      });
    },
  };
  const deleteMutation = useDeleteCompetency();

  const clearAllMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("DELETE", "/api/competencies");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/competencies"] });
      toast({ title: "All competencies cleared" });
    },
    onError: () => {
      toast({ title: "Failed to clear competencies", variant: "destructive" });
    },
  });

  const [confirmClear, setConfirmClear] = useState(false);

  const scrapeMutation = useMutation({
    mutationFn: async (url: string) => {
      const res = await apiRequest("POST", "/api/competencies/scrape", { url });
      return res.json();
    },
    onSuccess: (data) => {
      setScrapeSuggestions(data.suggestions || []);
      setSelectedSuggestions(new Set(data.suggestions?.map((_: any, i: number) => i) || []));
      setIsPartnerPage(!!data.isPartnerPage);
      setScrapeConsultancyName(data.consultancyName || "");
      if (data.isPartnerPage) {
        setScrapeSource("partner");
      }
    },
    onError: () => {
      toast({ title: "Scrape failed", description: "Could not extract competencies from that URL.", variant: "destructive" });
    },
  });

  function resetForm() {
    setFormName("");
    setFormType("service");
    setFormSource("in-house");
    setFormPartnerName("");
    setFormDescription("");
    setShowAddForm(false);
  }

  function handleAdd() {
    if (!formName.trim()) return;
    createMutation.mutate({
      name: formName.trim(),
      type: formType,
      source: formSource,
      partnerName: formSource === "partner" ? formPartnerName.trim() || null : null,
      description: formDescription.trim() || null,
    });
    resetForm();
  }

  const createPartnerMutation = useCreatePartner();

  async function handleImportSelected() {
    const toImport = scrapeSuggestions.filter((_, i) => selectedSuggestions.has(i));
    let imported = 0;

    const consultancy = scrapeConsultancyName.trim() || null;

    if (scrapeSource === "partner" && isPartnerPage) {
      const partnerMap = new Map<string, string[]>();
      for (const item of toImport) {
        const validType = ["service", "product", "offering"].includes(item.type) ? item.type : "product";
        const partnerName = item.partnerName || item.name;
        createMutation.mutate({
          name: item.name,
          type: validType,
          source: "partner",
          partnerName: partnerName,
          consultancyName: consultancy,
          description: item.description || null,
        });

        if (!partnerMap.has(partnerName)) {
          partnerMap.set(partnerName, []);
        }
        partnerMap.get(partnerName)!.push(item.name);
        imported++;
      }

      for (const [name, products] of partnerMap) {
        createPartnerMutation.mutate({
          name,
          specialties: products.slice(0, 5),
          notes: null,
        });
      }
    } else {
      for (const item of toImport) {
        const validType = ["service", "product", "offering"].includes(item.type) ? item.type : "service";
        createMutation.mutate({
          name: item.name,
          type: validType,
          source: scrapeSource,
          partnerName: scrapeSource === "partner" ? scrapePartnerName.trim() || null : null,
          consultancyName: consultancy,
          description: item.description || null,
        });
        imported++;
      }
    }

    toast({ title: `Imported ${imported} competencies${scrapeSource === "partner" && isPartnerPage ? " and partners" : ""}` });
    setScrapeOpen(false);
    setScrapeSuggestions([]);
    setSelectedSuggestions(new Set());
    setScrapeUrl("");
    setScrapeConsultancyName("");
    setIsPartnerPage(false);
  }

  function toggleSuggestion(index: number) {
    setSelectedSuggestions(prev => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  }

  const grouped = {
    service: (competencies || []).filter(c => c.type === "service"),
    product: (competencies || []).filter(c => c.type === "product"),
    offering: (competencies || []).filter(c => c.type === "offering"),
  };

  return (
    <div className="flex flex-col h-full">
      <div className="border-b border-border bg-background/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="flex items-center justify-between p-4">
          <div className="flex items-center gap-3">
            <Briefcase className="h-5 w-5 text-primary" />
            <div>
              <h1 className="text-lg font-semibold" data-testid="text-page-title">Competencies</h1>
              <p className="text-[11px] text-muted-foreground">Define your services, products, and offerings to improve capability scoring</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {(competencies || []).length > 0 && (
              confirmClear ? (
                <div className="flex items-center gap-1.5">
                  <span className="text-xs text-muted-foreground">Clear all?</span>
                  <Button
                    size="sm"
                    variant="destructive"
                    className="h-7 text-xs"
                    onClick={() => { clearAllMutation.mutate(); setConfirmClear(false); }}
                    disabled={clearAllMutation.isPending}
                    data-testid="button-confirm-clear-competencies"
                  >
                    Yes, clear
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 text-xs"
                    onClick={() => setConfirmClear(false)}
                    data-testid="button-cancel-clear-competencies"
                  >
                    Cancel
                  </Button>
                </div>
              ) : (
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-muted-foreground"
                  onClick={() => setConfirmClear(true)}
                  data-testid="button-clear-all-competencies"
                >
                  <Trash2 className="h-3.5 w-3.5 mr-1.5" />
                  Clear All
                </Button>
              )
            )}
            <Dialog open={scrapeOpen} onOpenChange={setScrapeOpen}>
              <DialogTrigger asChild>
                <Button size="sm" variant="outline" data-testid="button-scrape-website">
                  <Globe className="h-3.5 w-3.5 mr-1.5" />
                  Scrape Website
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>Scrape Website for Competencies</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <label className="text-xs font-medium mb-1.5 block">Website URL</label>
                    <div className="flex gap-2">
                      <Input
                        placeholder="https://example.com/services"
                        value={scrapeUrl}
                        onChange={(e) => setScrapeUrl(e.target.value)}
                        data-testid="input-scrape-url"
                      />
                      <Button
                        size="sm"
                        onClick={() => scrapeMutation.mutate(scrapeUrl)}
                        disabled={!scrapeUrl.trim() || scrapeMutation.isPending}
                        data-testid="button-scrape-submit"
                      >
                        {scrapeMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Scan"}
                      </Button>
                    </div>
                  </div>

                  {scrapeSuggestions.length > 0 && (
                    <>
                      {scrapeConsultancyName && (
                        <div className="rounded-md bg-muted/60 border border-border p-2.5 flex items-center gap-2">
                          <Globe className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                          <p className="text-[11px] text-foreground" data-testid="text-consultancy-name">
                            Scraped from <span className="font-semibold">{scrapeConsultancyName}</span>
                          </p>
                        </div>
                      )}
                      {isPartnerPage && (
                        <div className="rounded-md bg-blue-500/10 border border-blue-500/20 p-2.5">
                          <p className="text-[11px] text-blue-700 dark:text-blue-300">
                            Partner page detected — each item will be added as both a competency and a partner company.
                          </p>
                        </div>
                      )}

                      <div className="flex items-center gap-4">
                        <div className="flex-1">
                          <label className="text-xs font-medium mb-1 block">Import as</label>
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-muted-foreground">In-house</span>
                            <Switch
                              checked={scrapeSource === "partner"}
                              onCheckedChange={(v) => setScrapeSource(v ? "partner" : "in-house")}
                              data-testid="switch-scrape-source"
                            />
                            <span className="text-xs text-muted-foreground">Partner</span>
                          </div>
                        </div>
                        {scrapeSource === "partner" && !isPartnerPage && (
                          <div className="flex-1">
                            <label className="text-xs font-medium mb-1 block">Partner Name</label>
                            <Input
                              placeholder="Partner company"
                              value={scrapePartnerName}
                              onChange={(e) => setScrapePartnerName(e.target.value)}
                              className="h-8 text-sm"
                              data-testid="input-scrape-partner"
                            />
                          </div>
                        )}
                      </div>

                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-medium">{scrapeSuggestions.length} items found</span>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-6 text-[10px]"
                            onClick={() => setSelectedSuggestions(
                              selectedSuggestions.size === scrapeSuggestions.length
                                ? new Set()
                                : new Set(scrapeSuggestions.map((_, i) => i))
                            )}
                            data-testid="button-toggle-all"
                          >
                            {selectedSuggestions.size === scrapeSuggestions.length ? "Deselect All" : "Select All"}
                          </Button>
                        </div>
                        {scrapeSuggestions.map((item, i) => (
                          <Card
                            key={i}
                            className={`p-2.5 cursor-pointer transition-all ${selectedSuggestions.has(i) ? "border-primary bg-primary/5 ring-1 ring-primary/20" : "opacity-60"}`}
                            onClick={() => toggleSuggestion(i)}
                            data-testid={`card-suggestion-${i}`}
                          >
                            <div className="flex items-start gap-2">
                              <div className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 mt-0.5 ${selectedSuggestions.has(i) ? "bg-primary border-primary" : "border-border"}`}>
                                {selectedSuggestions.has(i) && <Check className="h-3 w-3 text-primary-foreground" />}
                              </div>
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-1.5">
                                  <span className="text-xs font-semibold">{item.name}</span>
                                  <Badge variant="secondary" className="text-[9px] h-3.5">{item.type}</Badge>
                                  {item.partnerName && item.partnerName !== item.name && (
                                    <span className="text-[10px] text-muted-foreground">via {item.partnerName}</span>
                                  )}
                                </div>
                                {item.description && (
                                  <p className="text-[10px] text-muted-foreground mt-0.5 line-clamp-2">{item.description}</p>
                                )}
                              </div>
                            </div>
                          </Card>
                        ))}
                      </div>

                      <Button
                        className="w-full"
                        size="sm"
                        disabled={selectedSuggestions.size === 0}
                        onClick={handleImportSelected}
                        data-testid="button-import-selected"
                      >
                        Import {selectedSuggestions.size} Selected{isPartnerPage && scrapeSource === "partner" ? " as Partners" : ""}
                      </Button>
                    </>
                  )}
                </div>
              </DialogContent>
            </Dialog>

            <Button size="sm" onClick={() => setShowAddForm(!showAddForm)} data-testid="button-add-competency">
              <Plus className="h-3.5 w-3.5 mr-1.5" />
              Add
            </Button>
          </div>
        </div>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-4 max-w-3xl mx-auto space-y-6">
          {showAddForm && (
            <Card className="p-4 border-primary/30 bg-primary/5">
              <h3 className="text-xs font-semibold mb-3">Add Competency</h3>
              <div className="space-y-3">
                <Input
                  placeholder="Name (e.g. Kubernetes Management, CrowdStrike EDR)"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  data-testid="input-competency-name"
                />
                <div className="flex gap-3">
                  <div className="flex-1">
                    <label className="text-[11px] font-medium text-muted-foreground mb-1 block">Type</label>
                    <Select value={formType} onValueChange={(v) => setFormType(v as any)}>
                      <SelectTrigger className="h-8 text-sm" data-testid="select-competency-type">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="service">Service</SelectItem>
                        <SelectItem value="product">Product</SelectItem>
                        <SelectItem value="offering">Offering</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex-1">
                    <label className="text-[11px] font-medium text-muted-foreground mb-1 block">Source</label>
                    <Select value={formSource} onValueChange={(v) => setFormSource(v as any)}>
                      <SelectTrigger className="h-8 text-sm" data-testid="select-competency-source">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="in-house">In-house</SelectItem>
                        <SelectItem value="partner">Partner</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  {formSource === "partner" && (
                    <div className="flex-1">
                      <label className="text-[11px] font-medium text-muted-foreground mb-1 block">Partner</label>
                      <Input
                        placeholder="Partner name"
                        className="h-8 text-sm"
                        value={formPartnerName}
                        onChange={(e) => setFormPartnerName(e.target.value)}
                        data-testid="input-competency-partner"
                      />
                    </div>
                  )}
                </div>
                <Textarea
                  placeholder="Brief description (optional)"
                  className="text-sm min-h-[60px]"
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  data-testid="input-competency-description"
                />
                <div className="flex justify-end gap-2">
                  <Button size="sm" variant="ghost" onClick={resetForm}>Cancel</Button>
                  <Button size="sm" onClick={handleAdd} disabled={!formName.trim()} data-testid="button-save-competency">
                    Save
                  </Button>
                </div>
              </div>
            </Card>
          )}

          {isLoading ? (
            <div className="space-y-4">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-32 w-full rounded-lg" />
              ))}
            </div>
          ) : (competencies || []).length === 0 && !showAddForm ? (
            <div className="text-center py-12">
              <Briefcase className="h-10 w-10 mx-auto text-muted-foreground/40 mb-3" />
              <h3 className="text-sm font-semibold mb-1">No competencies defined</h3>
              <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                Add your consultancy's services, products, and offerings to help OnTopic accurately tag capabilities as in-house or partner-delivered.
              </p>
            </div>
          ) : (
            (["service", "product", "offering"] as const).map(type => {
              const items = grouped[type];
              if (items.length === 0) return null;
              const config = TYPE_CONFIG[type];
              const Icon = config.icon;

              return (
                <div key={type}>
                  <div className="flex items-center gap-2 mb-2">
                    <Icon className={`h-4 w-4 ${config.color}`} />
                    <h2 className="text-sm font-semibold">{config.label}</h2>
                    <Badge variant="secondary" className="text-[10px] h-4">{items.length}</Badge>
                  </div>
                  <div className="space-y-1.5">
                    {items.map(comp => (
                      <CompetencyRow
                        key={comp.id}
                        competency={comp}
                        isEditing={editingId === comp.id}
                        onEdit={() => setEditingId(comp.id)}
                        onCancelEdit={() => setEditingId(null)}
                        onUpdate={(data) => updateMutation.mutate({ id: comp.id, data })}
                        onDelete={() => deleteMutation.mutate(comp.id)}
                      />
                    ))}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </ScrollArea>
    </div>
  );
}

function CompetencyRow({
  competency,
  isEditing,
  onEdit,
  onCancelEdit,
  onUpdate,
  onDelete,
}: {
  competency: Competency;
  isEditing: boolean;
  onEdit: () => void;
  onCancelEdit: () => void;
  onUpdate: (data: Partial<Competency>) => void;
  onDelete: () => void;
}) {
  const [editName, setEditName] = useState(competency.name);
  const [editSource, setEditSource] = useState(competency.source);
  const [editPartner, setEditPartner] = useState(competency.partnerName || "");
  const [editDesc, setEditDesc] = useState(competency.description || "");

  if (isEditing) {
    return (
      <Card className="p-3 border-primary/30 bg-primary/5">
        <div className="space-y-2">
          <Input
            value={editName}
            onChange={(e) => setEditName(e.target.value)}
            className="h-8 text-sm"
            data-testid={`input-edit-name-${competency.id}`}
          />
          <div className="flex gap-2 items-center">
            <Select value={editSource} onValueChange={setEditSource}>
              <SelectTrigger className="h-7 text-xs w-28" data-testid={`select-edit-source-${competency.id}`}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="in-house">In-house</SelectItem>
                <SelectItem value="partner">Partner</SelectItem>
              </SelectContent>
            </Select>
            {editSource === "partner" && (
              <Input
                placeholder="Partner name"
                value={editPartner}
                onChange={(e) => setEditPartner(e.target.value)}
                className="h-7 text-xs flex-1"
                data-testid={`input-edit-partner-${competency.id}`}
              />
            )}
          </div>
          <Textarea
            value={editDesc}
            onChange={(e) => setEditDesc(e.target.value)}
            className="text-xs min-h-[40px]"
            placeholder="Description"
            data-testid={`input-edit-desc-${competency.id}`}
          />
          <div className="flex justify-end gap-1.5">
            <Button size="sm" variant="ghost" className="h-6 text-[10px]" onClick={onCancelEdit}>
              <X className="h-3 w-3 mr-1" /> Cancel
            </Button>
            <Button
              size="sm"
              className="h-6 text-[10px]"
              onClick={() => onUpdate({
                name: editName.trim(),
                source: editSource,
                partnerName: editSource === "partner" ? editPartner.trim() || null : null,
                description: editDesc.trim() || null,
              })}
              data-testid={`button-save-edit-${competency.id}`}
            >
              <Check className="h-3 w-3 mr-1" /> Save
            </Button>
          </div>
        </div>
      </Card>
    );
  }

  return (
    <Card className="p-3 group" data-testid={`card-competency-${competency.id}`}>
      <div className="flex items-start gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-xs font-semibold">{competency.name}</span>
            <Badge
              variant={competency.source === "in-house" ? "default" : "secondary"}
              className="text-[9px] h-3.5"
            >
              {competency.source}
            </Badge>
            {competency.partnerName && (
              <span className="text-[10px] text-muted-foreground">via {competency.partnerName}</span>
            )}
            {competency.consultancyName && (
              <span className="text-[10px] text-muted-foreground italic">from {competency.consultancyName}</span>
            )}
          </div>
          {competency.description && (
            <p className="text-[10px] text-muted-foreground mt-0.5 leading-relaxed">{competency.description}</p>
          )}
        </div>
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
          <Button size="icon" variant="ghost" className="h-6 w-6" onClick={onEdit} data-testid={`button-edit-${competency.id}`}>
            <Pencil className="h-3 w-3" />
          </Button>
          <Button size="icon" variant="ghost" className="h-6 w-6 text-destructive" onClick={onDelete} data-testid={`button-delete-${competency.id}`}>
            <Trash2 className="h-3 w-3" />
          </Button>
        </div>
      </div>
    </Card>
  );
}
