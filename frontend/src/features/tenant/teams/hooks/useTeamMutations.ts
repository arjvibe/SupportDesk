import { useMutation, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/queryKeys";
import { teamsApi } from "../api/teamsApi";

export function useCreateTeam() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: { name: string; description: string }) =>
      teamsApi.createTeam(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.teams.list() });
    },
  });
}

export function useAssignTeamAgent(teamId: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: { agentId: string; isLead: boolean }) => {
      if (!teamId) throw new Error("No team selected");
      return teamsApi.assignTeamAgent(teamId, payload);
    },
    onSuccess: () => {
      if (teamId) {
        queryClient.invalidateQueries({ queryKey: queryKeys.teams.members(teamId) });
      }
      queryClient.invalidateQueries({ queryKey: queryKeys.teams.list() });
      queryClient.invalidateQueries({ queryKey: queryKeys.teams.availableAgents() });
    },
  });
}

export function useRemoveTeamAgent(teamId: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (agentId: string) => {
      if (!teamId) throw new Error("No team selected");
      return teamsApi.removeTeamAgent(teamId, agentId);
    },
    onSuccess: () => {
      if (teamId) {
        queryClient.invalidateQueries({ queryKey: queryKeys.teams.members(teamId) });
      }
      queryClient.invalidateQueries({ queryKey: queryKeys.teams.list() });
      queryClient.invalidateQueries({ queryKey: queryKeys.teams.availableAgents() });
    },
  });
}

export function useToggleAgentLead(teamId: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ agentId, isLead }: { agentId: string; isLead: boolean }) => {
      if (!teamId) throw new Error("No team selected");
      return teamsApi.toggleAgentLead(teamId, agentId, isLead);
    },
    onSuccess: () => {
      if (teamId) {
        queryClient.invalidateQueries({ queryKey: queryKeys.teams.members(teamId) });
      }
      queryClient.invalidateQueries({ queryKey: queryKeys.teams.list() });
    },
  });
}
