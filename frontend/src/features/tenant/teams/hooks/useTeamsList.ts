import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/lib/queryKeys";
import { teamsApi } from "../api/teamsApi";
import { SupportTeam, AvailableAgent } from "../types";

export function useTeamsList() {
  return useQuery<SupportTeam[]>({
    queryKey: queryKeys.teams.list(),
    queryFn: () => teamsApi.getTeams(),
  });
}

export function useAvailableAgents() {
  return useQuery<AvailableAgent[]>({
    queryKey: queryKeys.teams.availableAgents(),
    queryFn: () => teamsApi.getAvailableAgents(),
  });
}
