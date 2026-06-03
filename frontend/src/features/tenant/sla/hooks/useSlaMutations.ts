import { useMutation, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/queryKeys";
import { slaApi } from "../api/slaApi";
import { SlaTarget } from "../types";

export function useCreateSlaPolicy() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: { name: string; description: string }) =>
      slaApi.createPolicy(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.sla.list() });
    },
  });
}

export function useUpdateSlaPolicy() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: any }) =>
      slaApi.updatePolicy(id, payload),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.sla.detail(variables.id) });
      queryClient.invalidateQueries({ queryKey: queryKeys.sla.list() });
    },
  });
}

export function useUpdateSlaTargets() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, targets }: { id: string; targets: SlaTarget[] }) =>
      slaApi.updatePolicyTargets(id, targets),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.sla.detail(variables.id) });
    },
  });
}

export function useMakeDefaultSlaPolicy() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => slaApi.makeDefault(id),
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.sla.list() });
      queryClient.invalidateQueries({ queryKey: queryKeys.sla.detail(id) });
    },
  });
}
