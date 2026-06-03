import { useQuery } from "@tanstack/react-query";
import { ticketsApi } from "../api/ticketsApi";
import { queryKeys } from "@/lib/queryKeys";

export function useTicketsList(search?: string) {
  return useQuery({
    queryKey: queryKeys.tickets.list({ search }),
    queryFn: () => ticketsApi.getTickets(search),
  });
}
