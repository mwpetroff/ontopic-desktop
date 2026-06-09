import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { Session } from "@shared/schema";

export function useSessions(limit = 100) {
  return useQuery<Session[]>({
    queryKey: ["/api/sessions", { limit }],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/sessions?limit=${limit}`);
      return res.json();
    },
  });
}

export function useSession(id: number) {
  return useQuery<Session & { topics: any[] }>({
    queryKey: ["/api/sessions", id],
    enabled: id > 0,
  });
}

export function useCreateSession() {
  return useMutation({
    mutationFn: async (data: { title: string; clientName?: string; industry?: string }) => {
      const res = await apiRequest("POST", "/api/sessions", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/sessions"] });
    },
  });
}

export function useDeleteSession() {
  return useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/sessions/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/sessions"] });
    },
  });
}

export function useEndSession() {
  return useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest("PATCH", `/api/sessions/${id}/end`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/sessions"] });
    },
  });
}

export function useUpdateSession() {
  return useMutation({
    mutationFn: async ({ id, data }: { id: number; data: { title?: string; clientName?: string } }) => {
      const res = await apiRequest("PATCH", `/api/sessions/${id}`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/sessions"] });
    },
  });
}
