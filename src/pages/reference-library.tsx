import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useReferenceProjects, useCreateReferenceProject, useUpdateReferenceProject, useDeleteReferenceProject } from "@/hooks/use-reference-projects";
import { useSettings } from "@/hooks/use-settings";
import { FolderOpen, Plus, Trash2, Globe, Upload, Loader2, Pencil, Check, ExternalLink, X, Building2, Tag } from "lucide-react";
import type { ReferenceProject } from "@shared/schema";

interface ScrapeSuggestion {
  title: string;
  description: string;
  tags: string[];
  industry: string | null;
  clientName: string | null;
}

export default function ReferenceLibrary() {
  const { toast } = useToast();
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [scrapeOpen, setScrapeOpen] = useState(false);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [scrapeUrl, setScrapeUrl] = useState("");
  const [scrapeSuggestions, setScrapeSuggestions] = useState<ScrapeSuggestion[]>([]);
  const [selectedSuggestions, setSelectedSuggestions] = useState<Set<number>>(new Set());

  const [formTitle, setFormTitle] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [formUrl, setFormUrl] = useState("");
  const [formTags, setFormTags] = useState("");
  const [formIndustry, setFormIndustry] = useState("");
  const [formClientName, setFormClientName] = useState("");
  const [formProjectDate, setFormProjectDate] = useState("");

  const { data: projects, isLoading } = useReferenceProjects();
  const { data: settings } = useSettings();
  const createMutation = useCreateReferenceProject();
  const baseUpdateMutation = useUpdateReferenceProject();
  const updateMutation = {
    ...baseUpdateMutation,
    mutate: (args: { id: number; data: Partial<ReferenceProject> }) => {
      baseUpdateMutation.mutate(args, {
        onSuccess: () => setEditingId(null),
      });
    },
  };
  const deleteMutation = useDeleteReferenceProject();

  const scrapeMutation = useMutation({
    mutationFn: async (url: string) => {
      const res = await apiRequest("POST", "/api/reference-projects/scrape", { url });
      return res.json();
    },
    onSuccess: (data) => {
      setScrapeSuggestions(data.suggestions || []);
      setSelectedSuggestions(new Set(data.suggestions?.map((_: any, i: number) => i) || []));
    },
    onError: () => {
      toast({ title: "Scrape failed", description: "Could not extract projects from that URL.", variant: "destructive" });
    },
  });

  const uploadMutation = useMutation({
    mutationFn: async (files: FileList) => {
      const formData = new FormData();
      Array.from(files).forEach(f => formData.append("files", f));
      const res = await fetch("/api/reference-projects/upload", {
        method: "POST",
        body: formData,
        credentials: "include",
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Upload failed" }));
        throw new Error(err.error || "Upload failed");
      }
      return res.json();
    },
    onSuccess: (data) => {
      setScrapeSuggestions(data.suggestions || []);
      setSelectedSuggestions(new Set(data.suggestions?.map((_: any, i: number) => i) || []));
      setUploadOpen(false);
      setScrapeOpen(true);
    },
    onError: (err: Error) => {
      toast({ title: "Upload failed", description: err.message, variant: "destructive" });
    },
  });

  function resetForm() {
    setFormTitle("");
    setFormDescription("");
    setFormUrl("");
    setFormTags("");
    setFormIndustry("");
    setFormClientName("");
    setFormProjectDate("");
    setShowAddForm(false);
  }

  function handleAdd() {
    if (!formTitle.trim() || !formDescription.trim()) return;
    createMutation.mutate({
      title: formTitle.trim(),
      description: formDescription.trim(),
      url: formUrl.trim() || null,
      tags: formTags.split(",").map(t => t.trim()).filter(Boolean),
      industry: formIndustry.trim() || null,
      clientName: formClientName.trim() || null,
      projectDate: formProjectDate || null,
    });
    resetForm();
  }

  function handleImportSelected() {
    const toImport = scrapeSuggestions.filter((_, i) => selectedSuggestions.has(i));
    for (const item of toImport) {
      createMutation.mutate({
        title: item.title,
        description: item.description,
        tags: item.tags || [],
        industry: item.industry || null,
        clientName: item.clientName || null,
      });
    }
    toast({ title: `Imported ${toImport.length} project${toImport.length !== 1 ? "s" : ""}` });
    setScrapeOpen(false);
    setScrapeSuggestions([]);
    setSelectedSuggestions(new Set());
    setScrapeUrl("");
  }

  function toggleSuggestion(index: number) {
    setSelectedSuggestions(prev => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  }

  function startEdit(project: ReferenceProject) {
    setEditingId(project.id);
    setFormTitle(project.title);
    setFormDescription(project.description);
    setFormUrl(project.url || "");
    setFormTags((project.tags || []).join(", "));
    setFormIndustry(project.industry || "");
    setFormClientName(project.clientName || "");
    setFormProjectDate(project.projectDate ? new Date(project.projectDate).toISOString().split("T")[0] : "");
  }

  function handleSaveEdit() {
    if (!editingId || !formTitle.trim() || !formDescription.trim()) return;
    updateMutation.mutate({
      id: editingId,
      data: {
        title: formTitle.trim(),
        description: formDescription.trim(),
        url: formUrl.trim() || null,
        tags: formTags.split(",").map(t => t.trim()).filter(Boolean),
        industry: formIndustry.trim() || null,
        clientName: formClientName.trim() || null,
        projectDate: formProjectDate || null,
      },
    });
  }

  const caseStudyUrls = settings?.caseStudyUrls || [];

  return (
    <div className="flex flex-col h-full">
      <div className="border-b border-border bg-background/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="flex items-center justify-between p-4">
          <div className="flex items-center gap-3">
            <FolderOpen className="h-5 w-5 text-primary" />
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg font-semibold" data-testid="text-page-title">Reference Library</h1>
                {projects && projects.length > 0 && (
                  <Badge variant="secondary" className="text-[10px] h-4" data-testid="text-project-count">{projects.length}</Badge>
                )}
              </div>
              <p className="text-[11px] text-muted-foreground">Past projects surfaced during live episodes for relevant context</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Dialog open={uploadOpen} onOpenChange={setUploadOpen}>
              <DialogTrigger asChild>
                <Button size="sm" variant="outline" data-testid="button-upload-files">
                  <Upload className="h-3.5 w-3.5 mr-1.5" />
                  Upload
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-md">
                <DialogHeader>
                  <DialogTitle>Upload Documents</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <p className="text-xs text-muted-foreground">
                    Upload case study documents (.txt, .md, .pdf, .docx). AI will extract project references automatically.
                  </p>
                  <Input
                    type="file"
                    multiple
                    accept=".txt,.md,.pdf,.docx,.csv"
                    onChange={(e) => {
                      if (e.target.files && e.target.files.length > 0) {
                        uploadMutation.mutate(e.target.files);
                      }
                    }}
                    disabled={uploadMutation.isPending}
                    data-testid="input-upload-files"
                  />
                  {uploadMutation.isPending && (
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      Analyzing documents...
                    </div>
                  )}
                </div>
              </DialogContent>
            </Dialog>

            <Dialog open={scrapeOpen} onOpenChange={(open) => {
              setScrapeOpen(open);
              if (!open) { setScrapeSuggestions([]); setSelectedSuggestions(new Set()); setScrapeUrl(""); }
            }}>
              <DialogTrigger asChild>
                <Button size="sm" variant="outline" data-testid="button-scrape-url">
                  <Globe className="h-3.5 w-3.5 mr-1.5" />
                  Scrape URL
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>Scrape Case Study Page</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  {caseStudyUrls.length > 0 && scrapeSuggestions.length === 0 && (
                    <div>
                      <label className="text-xs font-medium mb-1.5 block">Saved Sources</label>
                      <div className="flex flex-wrap gap-1.5">
                        {caseStudyUrls.map((url: string) => (
                          <Badge
                            key={url}
                            variant="outline"
                            className="text-[10px] cursor-pointer hover:bg-primary/10 transition-colors"
                            onClick={() => { setScrapeUrl(url); scrapeMutation.mutate(url); }}
                            data-testid="badge-saved-source"
                          >
                            <Globe className="h-2.5 w-2.5 mr-1" />
                            {new URL(url).hostname}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}

                  <div>
                    <label className="text-xs font-medium mb-1.5 block">Website URL</label>
                    <div className="flex gap-2">
                      <Input
                        placeholder="https://example.com/case-studies"
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
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-medium">{scrapeSuggestions.length} project{scrapeSuggestions.length !== 1 ? "s" : ""} found</span>
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
                                <span className="text-xs font-semibold">{item.title}</span>
                                {item.clientName && (
                                  <span className="text-[10px] text-muted-foreground ml-1.5">({item.clientName})</span>
                                )}
                                <p className="text-[10px] text-muted-foreground mt-0.5 line-clamp-2">{item.description}</p>
                                {item.tags && item.tags.length > 0 && (
                                  <div className="flex flex-wrap gap-1 mt-1">
                                    {item.tags.slice(0, 5).map((tag: string) => (
                                      <Badge key={tag} variant="secondary" className="text-[8px] h-3.5 px-1">{tag}</Badge>
                                    ))}
                                  </div>
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
                        Import {selectedSuggestions.size} Selected
                      </Button>
                    </>
                  )}
                </div>
              </DialogContent>
            </Dialog>

            <Button size="sm" onClick={() => setShowAddForm(!showAddForm)} data-testid="button-add-project">
              <Plus className="h-3.5 w-3.5 mr-1.5" />
              Add Project
            </Button>
          </div>
        </div>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-4 max-w-3xl mx-auto space-y-4">
          {showAddForm && (
            <Card className="p-4 border-primary/30 bg-primary/5">
              <h3 className="text-xs font-semibold mb-3">Add Project</h3>
              <div className="space-y-3">
                <Input
                  placeholder="Project title (required)"
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  data-testid="input-project-title"
                />
                <Textarea
                  placeholder="Description — scope, technologies, outcomes (required)"
                  className="text-sm min-h-[60px]"
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  data-testid="input-project-description"
                />
                <div className="grid grid-cols-2 gap-3">
                  <Input
                    placeholder="Industry (optional)"
                    value={formIndustry}
                    onChange={(e) => setFormIndustry(e.target.value)}
                    data-testid="input-project-industry"
                  />
                  <Input
                    placeholder="Client name (optional)"
                    value={formClientName}
                    onChange={(e) => setFormClientName(e.target.value)}
                    data-testid="input-project-client"
                  />
                </div>
                <Input
                  placeholder="Tags (comma-separated, e.g. Azure, migration, AD)"
                  value={formTags}
                  onChange={(e) => setFormTags(e.target.value)}
                  data-testid="input-project-tags"
                />
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[11px] font-medium text-muted-foreground mb-1 block">Project Date</label>
                    <Input
                      type="date"
                      value={formProjectDate}
                      onChange={(e) => setFormProjectDate(e.target.value)}
                      data-testid="input-project-date"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-medium text-muted-foreground mb-1 block">URL (optional)</label>
                    <Input
                      placeholder="https://..."
                      value={formUrl}
                      onChange={(e) => setFormUrl(e.target.value)}
                      data-testid="input-project-url"
                    />
                  </div>
                </div>
                <div className="flex justify-end gap-2">
                  <Button size="sm" variant="ghost" onClick={resetForm}>Cancel</Button>
                  <Button size="sm" onClick={handleAdd} disabled={!formTitle.trim() || !formDescription.trim()} data-testid="button-save-project">
                    Save
                  </Button>
                </div>
              </div>
            </Card>
          )}

          {isLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-28 w-full rounded-lg" />
              ))}
            </div>
          ) : (projects || []).length === 0 && !showAddForm ? (
            <div className="text-center py-12">
              <FolderOpen className="h-10 w-10 mx-auto text-muted-foreground/40 mb-3" />
              <h3 className="text-sm font-semibold mb-1">No reference projects</h3>
              <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                Add past projects to help OnTopic surface relevant experience during live episodes. You can add manually, scrape from a URL, or upload documents.
              </p>
            </div>
          ) : (
            (projects || []).map(project => (
              <Card key={project.id} className="p-4" data-testid={`card-project-${project.id}`}>
                {editingId === project.id ? (
                  <div className="space-y-3">
                    <Input value={formTitle} onChange={(e) => setFormTitle(e.target.value)} data-testid="input-edit-title" />
                    <Textarea value={formDescription} onChange={(e) => setFormDescription(e.target.value)} className="text-sm min-h-[60px]" data-testid="input-edit-description" />
                    <div className="grid grid-cols-2 gap-3">
                      <Input placeholder="Industry" value={formIndustry} onChange={(e) => setFormIndustry(e.target.value)} data-testid="input-edit-industry" />
                      <Input placeholder="Client" value={formClientName} onChange={(e) => setFormClientName(e.target.value)} data-testid="input-edit-client" />
                    </div>
                    <Input placeholder="Tags (comma-separated)" value={formTags} onChange={(e) => setFormTags(e.target.value)} data-testid="input-edit-tags" />
                    <div className="grid grid-cols-2 gap-3">
                      <Input type="date" value={formProjectDate} onChange={(e) => setFormProjectDate(e.target.value)} data-testid="input-edit-date" />
                      <Input placeholder="URL" value={formUrl} onChange={(e) => setFormUrl(e.target.value)} data-testid="input-edit-url" />
                    </div>
                    <div className="flex justify-end gap-2">
                      <Button size="sm" variant="ghost" onClick={() => setEditingId(null)}>Cancel</Button>
                      <Button size="sm" onClick={handleSaveEdit} disabled={!formTitle.trim() || !formDescription.trim()} data-testid="button-save-edit">Save</Button>
                    </div>
                  </div>
                ) : (
                  <div>
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="text-sm font-semibold" data-testid={`text-project-title-${project.id}`}>{project.title}</h3>
                          {project.industry && (
                            <Badge variant="outline" className="text-[9px] h-3.5 gap-0.5">
                              <Building2 className="h-2.5 w-2.5" />
                              {project.industry}
                            </Badge>
                          )}
                          {project.clientName && (
                            <Badge variant="secondary" className="text-[9px] h-3.5">{project.clientName}</Badge>
                          )}
                          {project.projectDate && (
                            <span className="text-[10px] text-muted-foreground">{new Date(project.projectDate).toLocaleDateString("en-US", { year: "numeric", month: "short" })}</span>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{project.description}</p>
                        {project.tags && project.tags.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-2">
                            {project.tags.map((tag: string) => (
                              <Badge key={tag} variant="secondary" className="text-[9px] h-4 gap-0.5">
                                <Tag className="h-2.5 w-2.5" />
                                {tag}
                              </Badge>
                            ))}
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        {project.url && (
                          <Button size="icon" variant="ghost" className="h-7 w-7" asChild>
                            <a href={project.url} target="_blank" rel="noopener noreferrer" data-testid={`link-project-url-${project.id}`}>
                              <ExternalLink className="h-3.5 w-3.5" />
                            </a>
                          </Button>
                        )}
                        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => startEdit(project)} data-testid={`button-edit-project-${project.id}`}>
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => deleteMutation.mutate(project.id)} data-testid={`button-delete-project-${project.id}`}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  </div>
                )}
              </Card>
            ))
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
