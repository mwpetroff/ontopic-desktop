import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { usePartners, useCreatePartner, useUpdatePartner, useDeletePartner } from "@/hooks/use-partners";
import { Building2, Plus, Trash2, Mail, FileText, Pencil, Globe, Loader2, Check } from "lucide-react";
import type { Partner } from "@shared/schema";

interface ScrapePartnerSuggestion {
  name: string;
  type: string;
  description: string;
  partnerName?: string;
}

const partnerFormSchema = z.object({
  name: z.string().min(1, "Partner name is required"),
  specialties: z.string(),
  contactInfo: z.string().optional(),
  notes: z.string().optional(),
});

type PartnerFormValues = z.infer<typeof partnerFormSchema>;

export default function Partners() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingPartner, setEditingPartner] = useState<Partner | null>(null);
  const [scrapeOpen, setScrapeOpen] = useState(false);
  const [scrapeUrl, setScrapeUrl] = useState("");
  const [scrapeSuggestions, setScrapeSuggestions] = useState<ScrapePartnerSuggestion[]>([]);
  const [selectedSuggestions, setSelectedSuggestions] = useState<Set<number>>(new Set());
  const { toast } = useToast();

  const { data: partners = [], isLoading } = usePartners();

  const form = useForm<PartnerFormValues>({
    resolver: zodResolver(partnerFormSchema),
    defaultValues: {
      name: "",
      specialties: "",
      contactInfo: "",
      notes: "",
    },
  });

  const baseCreateMutation = useCreatePartner();
  const baseUpdateMutation = useUpdatePartner();
  const deleteMutation = useDeletePartner();

  const createMutation = {
    ...baseCreateMutation,
    mutate: (data: PartnerFormValues | { name: string; specialties: string; contactInfo?: string; notes?: string }, options?: any) => {
      const specialties = data.specialties
        ? (typeof data.specialties === 'string' ? data.specialties.split(",").map((s: string) => s.trim()).filter(Boolean) : data.specialties)
        : [];
      baseCreateMutation.mutate({
        name: data.name,
        specialties: specialties as string[],
        contactInfo: data.contactInfo || null,
        notes: data.notes || null,
      }, {
        onSuccess: () => {
          setIsDialogOpen(false);
          form.reset();
        },
        ...options,
      });
    },
  };

  const updateMutation = {
    ...baseUpdateMutation,
    mutate: ({ id, data }: { id: number; data: PartnerFormValues }) => {
      const specialties = data.specialties
        .split(",")
        .map((s: string) => s.trim())
        .filter(Boolean);
      baseUpdateMutation.mutate({
        id,
        data: {
          name: data.name,
          specialties,
          contactInfo: data.contactInfo || null,
          notes: data.notes || null,
        },
      }, {
        onSuccess: () => {
          setIsDialogOpen(false);
          setEditingPartner(null);
          form.reset();
        },
      });
    },
  };

  const clearAllMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("DELETE", "/api/partners");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/partners"] });
      toast({ title: "All partners cleared" });
    },
    onError: () => {
      toast({ title: "Failed to clear partners", variant: "destructive" });
    },
  });

  const [confirmClear, setConfirmClear] = useState(false);

  const scrapeMutation = useMutation({
    mutationFn: async (url: string) => {
      const res = await apiRequest("POST", "/api/competencies/scrape", { url });
      return res.json();
    },
    onSuccess: (data) => {
      const suggestions: ScrapePartnerSuggestion[] = data.suggestions || [];
      const partnerMap = new Map<string, ScrapePartnerSuggestion[]>();
      for (const s of suggestions) {
        const key = s.partnerName || s.name;
        if (!partnerMap.has(key)) partnerMap.set(key, []);
        partnerMap.get(key)!.push(s);
      }
      const grouped = Array.from(partnerMap.entries()).map(([name, items]) => ({
        name,
        type: "partner",
        description: items.map(i => i.name).filter(n => n !== name).join(", ") || items[0]?.description || "",
        partnerName: name,
      }));
      setScrapeSuggestions(grouped);
      setSelectedSuggestions(new Set(grouped.map((_, i) => i)));
    },
    onError: () => {
      toast({ title: "Scrape failed", description: "Could not extract partners from that URL.", variant: "destructive" });
    },
  });

  function toggleSuggestion(index: number) {
    setSelectedSuggestions(prev => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  }

  async function handleImportPartners() {
    const toImport = scrapeSuggestions.filter((_, i) => selectedSuggestions.has(i));
    let imported = 0;
    for (const item of toImport) {
      const specialties = item.description
        ? item.description.split(",").map(s => s.trim()).filter(Boolean).slice(0, 10)
        : [];
      createMutation.mutate({
        name: item.name,
        specialties: specialties.join(", "),
        contactInfo: "",
        notes: "",
      });
      imported++;
    }
    toast({ title: `Imported ${imported} partners` });
    setScrapeOpen(false);
    setScrapeSuggestions([]);
    setSelectedSuggestions(new Set());
    setScrapeUrl("");
  }

  const handleOpenAdd = () => {
    setEditingPartner(null);
    form.reset({ name: "", specialties: "", contactInfo: "", notes: "" });
    setIsDialogOpen(true);
  };

  const handleOpenEdit = (partner: Partner) => {
    setEditingPartner(partner);
    form.reset({
      name: partner.name,
      specialties: (partner.specialties || []).join(", "),
      contactInfo: partner.contactInfo || "",
      notes: partner.notes || "",
    });
    setIsDialogOpen(true);
  };

  const handleSubmit = (values: PartnerFormValues) => {
    if (editingPartner) {
      updateMutation.mutate({ id: editingPartner.id, data: values });
    } else {
      createMutation.mutate(values);
    }
  };

  return (
    <div className="flex flex-col h-full">
      <div className="border-b border-border bg-background/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="flex items-center justify-between gap-3 p-4">
          <div className="flex items-center gap-3">
            <Building2 className="h-5 w-5 text-muted-foreground" />
            <h1 className="text-lg font-semibold" data-testid="text-page-title">
              Partner Companies
            </h1>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="secondary">{partners.length} partners</Badge>
            {partners.length > 0 && (
              confirmClear ? (
                <div className="flex items-center gap-1.5">
                  <span className="text-xs text-muted-foreground">Clear all?</span>
                  <Button
                    size="sm"
                    variant="destructive"
                    className="h-7 text-xs"
                    onClick={() => { clearAllMutation.mutate(); setConfirmClear(false); }}
                    disabled={clearAllMutation.isPending}
                    data-testid="button-confirm-clear-partners"
                  >
                    Yes, clear
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 text-xs"
                    onClick={() => setConfirmClear(false)}
                    data-testid="button-cancel-clear-partners"
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
                  data-testid="button-clear-all-partners"
                >
                  <Trash2 className="h-3.5 w-3.5 mr-1.5" />
                  Clear All
                </Button>
              )
            )}
            <Dialog open={scrapeOpen} onOpenChange={(open) => { setScrapeOpen(open); if (!open) { setScrapeSuggestions([]); setSelectedSuggestions(new Set()); setScrapeUrl(""); } }}>
              <DialogTrigger asChild>
                <Button size="sm" variant="outline" data-testid="button-scrape-website">
                  <Globe className="h-3.5 w-3.5 mr-1.5" />
                  Scrape Website
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>Scrape Website for Partners</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <label className="text-xs font-medium mb-1.5 block">Website URL</label>
                    <div className="flex gap-2">
                      <Input
                        placeholder="https://example.com/partners"
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
                          <span className="text-xs font-medium">{scrapeSuggestions.length} partners found</span>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-6 text-[10px]"
                            onClick={() => setSelectedSuggestions(
                              selectedSuggestions.size === scrapeSuggestions.length
                                ? new Set()
                                : new Set(scrapeSuggestions.map((_, i) => i))
                            )}
                            data-testid="button-toggle-all-partners"
                          >
                            {selectedSuggestions.size === scrapeSuggestions.length ? "Deselect All" : "Select All"}
                          </Button>
                        </div>
                        {scrapeSuggestions.map((item, i) => (
                          <Card
                            key={i}
                            className={`p-2.5 cursor-pointer transition-all ${selectedSuggestions.has(i) ? "border-primary bg-primary/5 ring-1 ring-primary/20" : "opacity-60"}`}
                            onClick={() => toggleSuggestion(i)}
                            data-testid={`card-partner-suggestion-${i}`}
                          >
                            <div className="flex items-start gap-2">
                              <div className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 mt-0.5 ${selectedSuggestions.has(i) ? "bg-primary border-primary" : "border-border"}`}>
                                {selectedSuggestions.has(i) && <Check className="h-3 w-3 text-primary-foreground" />}
                              </div>
                              <div className="min-w-0 flex-1">
                                <span className="text-xs font-semibold">{item.name}</span>
                                {item.description && (
                                  <div className="flex flex-wrap gap-1 mt-1">
                                    {item.description.split(",").map((s, j) => s.trim()).filter(Boolean).map((spec, j) => (
                                      <Badge key={j} variant="outline" className="text-[9px]">{spec}</Badge>
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
                        onClick={handleImportPartners}
                        data-testid="button-import-partners"
                      >
                        Import {selectedSuggestions.size} Selected Partners
                      </Button>
                    </>
                  )}
                </div>
              </DialogContent>
            </Dialog>
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
              <DialogTrigger asChild>
                <Button size="sm" onClick={handleOpenAdd} data-testid="button-add-partner">
                  <Plus className="h-4 w-4 mr-1.5" />
                  Add Partner
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>
                    {editingPartner ? "Edit Partner" : "Add Partner Company"}
                  </DialogTitle>
                </DialogHeader>
                <Form {...form}>
                  <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
                    <FormField
                      control={form.control}
                      name="name"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Company Name</FormLabel>
                          <FormControl>
                            <Input
                              placeholder="e.g., CloudBridge Solutions"
                              {...field}
                              data-testid="input-partner-name"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="specialties"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Specialties (comma-separated)</FormLabel>
                          <FormControl>
                            <Input
                              placeholder="e.g., AWS, Kubernetes, cloud migration"
                              {...field}
                              data-testid="input-partner-specialties"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="contactInfo"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Contact Info</FormLabel>
                          <FormControl>
                            <Input
                              placeholder="Email or phone"
                              {...field}
                              data-testid="input-partner-contact"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="notes"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Notes</FormLabel>
                          <FormControl>
                            <Textarea
                              placeholder="Any additional details..."
                              className="resize-none"
                              {...field}
                              data-testid="input-partner-notes"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <Button
                      type="submit"
                      className="w-full"
                      disabled={createMutation.isPending || updateMutation.isPending}
                      data-testid="button-save-partner"
                    >
                      {editingPartner ? "Update Partner" : "Add Partner"}
                    </Button>
                  </form>
                </Form>
              </DialogContent>
            </Dialog>
          </div>
        </div>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-4 max-w-3xl mx-auto space-y-3">
          {isLoading ? (
            Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-28 w-full rounded-md" />
            ))
          ) : partners.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-24 text-center">
              <Building2 className="h-12 w-12 text-muted-foreground/20 mb-4" />
              <h2 className="text-lg font-semibold mb-1">No Partners Yet</h2>
              <p className="text-sm text-muted-foreground max-w-xs mb-4">
                Add partner companies and their specialties so the app can automatically match detected tools and brands to the right capability source.
              </p>
              <Button onClick={handleOpenAdd} data-testid="button-add-partner-empty">
                <Plus className="h-4 w-4 mr-1.5" />
                Add Your First Partner
              </Button>
            </div>
          ) : (
            partners.map((partner) => (
              <Card
                key={partner.id}
                className="p-4"
                data-testid={`card-partner-${partner.id}`}
              >
                <div className="flex items-start gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-md bg-blue-500/10 shrink-0">
                    <Building2 className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <h3 className="text-sm font-semibold">{partner.name}</h3>
                      <div className="flex items-center gap-1 shrink-0">
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => handleOpenEdit(partner)}
                          data-testid={`button-edit-partner-${partner.id}`}
                        >
                          <Pencil className="h-4 w-4 text-muted-foreground" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => deleteMutation.mutate(partner.id)}
                          data-testid={`button-delete-partner-${partner.id}`}
                        >
                          <Trash2 className="h-4 w-4 text-muted-foreground" />
                        </Button>
                      </div>
                    </div>

                    {partner.specialties && partner.specialties.length > 0 && (
                      <div className="flex flex-wrap gap-1 mb-2">
                        {partner.specialties.map((spec, i) => (
                          <Badge
                            key={i}
                            variant="outline"
                            className="text-[10px]"
                          >
                            {spec}
                          </Badge>
                        ))}
                      </div>
                    )}

                    <div className="flex items-center gap-4 text-xs text-muted-foreground">
                      {partner.contactInfo && (
                        <span className="flex items-center gap-1">
                          <Mail className="h-3 w-3" />
                          {partner.contactInfo}
                        </span>
                      )}
                      {partner.notes && (
                        <span className="flex items-center gap-1 truncate">
                          <FileText className="h-3 w-3 shrink-0" />
                          {partner.notes}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </Card>
            ))
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
