import { useMutation, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/queryKeys";
import { rulesApi } from "../api/rulesApi";

export function useCreateRule() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: any) => rulesApi.createRule(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.rules.list() });
    },
  });
}

export function useUpdateRule() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: any }) =>
      rulesApi.updateRule(id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.rules.list() });
    },
  });
}

export function useDeleteRule() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => rulesApi.deleteRule(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.rules.list() });
    },
  });
}

export function useReorderRules() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (orderedIds: string[]) => rulesApi.reorderRules(orderedIds),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.rules.list() });
    },
  });
}
