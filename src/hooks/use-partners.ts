import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { Partner } from "@shared/schema";

export function usePartners() {
  return useQuery<Partner[]>({
    queryKey: ["/api/partners"],
  });
}

export function useCreatePartner() {
  const { toast } = useToast();
  return useMutation({
    mutationFn: async (data: { name: string; specialties: string[]; contactInfo?: string | null; notes?: string | null }) => {
      const res = await apiRequest("POST", "/api/partners", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/partners"] });
      toast({ title: "Partner added", description: "Partner company has been added." });
    },
    onError: () => {
      toast({ title: "Failed to add partner", variant: "destructive" });
    },
  });
}

export function useUpdatePartner() {
  const { toast } = useToast();
  return useMutation({
    mutationFn: async ({ id, data }: { id: number; data: { name: string; specialties: string[]; contactInfo?: string | null; notes?: string | null } }) => {
      const res = await apiRequest("PATCH", `/api/partners/${id}`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/partners"] });
      toast({ title: "Partner updated" });
    },
    onError: () => {
      toast({ title: "Failed to update partner", variant: "destructive" });
    },
  });
}

export function useDeletePartner() {
  const { toast } = useToast();
  return useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/partners/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/partners"] });
      toast({ title: "Partner removed" });
    },
    onError: () => {
      toast({ title: "Failed to remove partner", variant: "destructive" });
    },
  });
}
