import { useQuery } from "@tanstack/react-query";
import { ticketsApi } from "../api/ticketsApi";
import { queryKeys } from "@/lib/queryKeys";

export function useTeamsAssignList() {
  return useQuery({
    queryKey: queryKeys.teams.list(),
    queryFn: ticketsApi.getTeamsList,
  });
}

export function useStaffAssignList() {
  return useQuery({
    queryKey: queryKeys.staff.list(),
    queryFn: ticketsApi.getStaffList,
  });
}
