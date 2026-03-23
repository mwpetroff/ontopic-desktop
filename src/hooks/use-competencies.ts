import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { Competency } from "@shared/schema";

export function useCompetencies() {
  return useQuery<Competency[]>({
    queryKey: ["/api/competencies"],
  });
}

export function useCreateCompetency() {
  const { toast } = useToast();
  return useMutation({
    mutationFn: async (data: { name: string; type: string; source: string; partnerName?: string | null; consultancyName?: string | null; description?: string | null }) => {
      const res = await apiRequest("POST", "/api/competencies", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/competencies"] });
      toast({ title: "Competency added" });
    },
    onError: () => {
      toast({ title: "Failed to add competency", variant: "destructive" });
    },
  });
}

export function useUpdateCompetency() {
  const { toast } = useToast();
  return useMutation({
    mutationFn: async ({ id, data }: { id: number; data: Partial<Competency> }) => {
      const res = await apiRequest("PATCH", `/api/competencies/${id}`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/competencies"] });
      toast({ title: "Competency updated" });
    },
    onError: () => {
      toast({ title: "Failed to update competency", variant: "destructive" });
    },
  });
}

export function useDeleteCompetency() {
  const { toast } = useToast();
  return useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/competencies/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/competencies"] });
      toast({ title: "Competency removed" });
    },
    onError: () => {
      toast({ title: "Failed to remove competency", variant: "destructive" });
    },
  });
}
