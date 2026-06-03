import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { clientsApi } from "../api/clientsApi";
import { queryKeys } from "@/lib/queryKeys";

export function useClientsList() {
  return useQuery({
    queryKey: queryKeys.clients.list(),
    queryFn: clientsApi.getClients,
  });
}

export function useStaffList() {
  return useQuery({
    queryKey: queryKeys.staff.list(),
    queryFn: clientsApi.getStaffList,
  });
}

export function useClientUsers(clientId: string | null) {
  return useQuery({
    queryKey: queryKeys.clients.users(clientId || ""),
    queryFn: () => clientsApi.getClientUsers(clientId || ""),
    enabled: !!clientId,
  });
}

export function useCreateClient() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: clientsApi.createClient,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.clients.list() });
    },
  });
}

export function useCreateClientUser(clientId: string | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: any) => clientsApi.createClientUser(clientId || "", payload),
    onSuccess: () => {
      if (clientId) {
        queryClient.invalidateQueries({ queryKey: queryKeys.clients.users(clientId) });
      }
      queryClient.invalidateQueries({ queryKey: queryKeys.clients.list() });
    },
  });
}
