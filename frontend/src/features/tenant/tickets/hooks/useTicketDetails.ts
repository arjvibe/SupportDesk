import { useQuery } from "@tanstack/react-query";
import { ticketsApi } from "../api/ticketsApi";
import { queryKeys } from "@/lib/queryKeys";

export function useTicketDetails(ticketId: string | null) {
  return useQuery({
    queryKey: queryKeys.tickets.detail(ticketId || ""),
    queryFn: () => ticketsApi.getTicketDetails(ticketId || ""),
    enabled: !!ticketId,
  });
}
