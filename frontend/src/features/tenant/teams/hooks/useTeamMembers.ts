import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/lib/queryKeys";
import { teamsApi } from "../api/teamsApi";
import { TeamAgent } from "../types";

export function useTeamMembers(teamId: string | null) {
  return useQuery<TeamAgent[]>({
    queryKey: queryKeys.teams.members(teamId || ""),
    queryFn: () => teamsApi.getTeamAgents(teamId!),
    enabled: !!teamId,
  });
}
