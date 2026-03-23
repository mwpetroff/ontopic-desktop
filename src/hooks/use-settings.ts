import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { Settings } from "@shared/schema";

export function useSettings() {
  return useQuery<Settings>({
    queryKey: ["/api/settings"],
  });
}

export function useUpdateSettings() {
  const { toast } = useToast();
  return useMutation({
    mutationFn: async (updates: Partial<Settings>) => {
      const res = await apiRequest("PATCH", "/api/settings", updates);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/settings"] });
      toast({ title: "Settings updated", description: "Your changes have been saved." });
    },
    onError: () => {
      toast({ title: "Failed to update settings", variant: "destructive" });
    },
  });
}
