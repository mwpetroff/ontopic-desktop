import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { ReferenceProject } from "@shared/schema";

export function useReferenceProjects() {
  return useQuery<ReferenceProject[]>({
    queryKey: ["/api/reference-projects"],
  });
}

export function useCreateReferenceProject() {
  const { toast } = useToast();
  return useMutation({
    mutationFn: async (data: { title: string; description: string; url?: string | null; tags?: string[]; industry?: string | null; clientName?: string | null; projectDate?: string | null }) => {
      const res = await apiRequest("POST", "/api/reference-projects", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/reference-projects"] });
      toast({ title: "Project added" });
    },
    onError: () => {
      toast({ title: "Failed to add project", variant: "destructive" });
    },
  });
}

export function useUpdateReferenceProject() {
  const { toast } = useToast();
  return useMutation({
    mutationFn: async ({ id, data }: { id: number; data: Partial<ReferenceProject> }) => {
      const res = await apiRequest("PATCH", `/api/reference-projects/${id}`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/reference-projects"] });
      toast({ title: "Project updated" });
    },
    onError: () => {
      toast({ title: "Failed to update project", variant: "destructive" });
    },
  });
}

export function useDeleteReferenceProject() {
  const { toast } = useToast();
  return useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/reference-projects/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/reference-projects"] });
      toast({ title: "Project removed" });
    },
    onError: () => {
      toast({ title: "Failed to remove project", variant: "destructive" });
    },
  });
}
