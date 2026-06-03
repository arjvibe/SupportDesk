import { useMutation, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/queryKeys";
import { usersApi } from "../api/usersApi";

export function useCreateStaff() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: any) => usersApi.createStaff(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.staff.list() });
      queryClient.invalidateQueries({ queryKey: queryKeys.teams.availableAgents() });
    },
  });
}

export function useUpdateStaff() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: any }) =>
      usersApi.updateStaff(id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.staff.list() });
      queryClient.invalidateQueries({ queryKey: queryKeys.teams.availableAgents() });
    },
  });
}
