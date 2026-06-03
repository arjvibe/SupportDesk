import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ticketsApi } from "../api/ticketsApi";
import { queryKeys } from "@/lib/queryKeys";
import type { Ticket, TicketDetails } from "../types";

export function usePostTicketMessage(ticketId: string | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: {
      body: string;
      isInternal: boolean;
      attachments?: any[];
    }) => ticketsApi.postTicketMessage(ticketId || "", payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.tickets.list() });
      if (ticketId) {
        queryClient.invalidateQueries({
          queryKey: queryKeys.tickets.detail(ticketId),
        });
      }
    },
  });
}

export function useUpdateTicketProperties(ticketId: string | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: Partial<Ticket>) =>
      ticketsApi.updateTicketProperties(ticketId || "", payload),

    // Perform optimistic updates
    onMutate: async (updatedFields) => {
      if (!ticketId) return;

      // Cancel outgoing refetches
      await queryClient.cancelQueries({
        queryKey: queryKeys.tickets.detail(ticketId),
      });
      await queryClient.cancelQueries({ queryKey: queryKeys.tickets.list() });

      // Snapshot the previous values
      const previousDetails = queryClient.getQueryData<TicketDetails>(
        queryKeys.tickets.detail(ticketId)
      );
      const previousQueue = queryClient.getQueryData<Ticket[]>(
        queryKeys.tickets.list()
      );

      // Optimistically update the ticket details cache
      if (previousDetails) {
        queryClient.setQueryData<TicketDetails>(
          queryKeys.tickets.detail(ticketId),
          {
            ...previousDetails,
            ...updatedFields,
          } as TicketDetails
        );
      }

      // Optimistically update the list queue cache
      if (previousQueue) {
        queryClient.setQueryData<Ticket[]>(
          queryKeys.tickets.list(),
          previousQueue.map((t) =>
            t.id === ticketId ? ({ ...t, ...updatedFields } as Ticket) : t
          )
        );
      }

      // Return context for rollback
      return { previousDetails, previousQueue };
    },

    // Rollback if failure occurs
    onError: (_err, _variables, context) => {
      if (!ticketId || !context) return;

      if (context.previousDetails) {
        queryClient.setQueryData(
          queryKeys.tickets.detail(ticketId),
          context.previousDetails
        );
      }
      if (context.previousQueue) {
        queryClient.setQueryData(
          queryKeys.tickets.list(),
          context.previousQueue
        );
      }
    },

    // Always refetch / invalidate after success or error
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.tickets.list() });
      if (ticketId) {
        queryClient.invalidateQueries({
          queryKey: queryKeys.tickets.detail(ticketId),
        });
      }
    },
  });
}

export function useMergeTickets(ticketId: string | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ticketsApi.mergeTickets,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.tickets.list() });
      if (ticketId) {
        queryClient.invalidateQueries({
          queryKey: queryKeys.tickets.detail(ticketId),
        });
      }
    },
  });
}
