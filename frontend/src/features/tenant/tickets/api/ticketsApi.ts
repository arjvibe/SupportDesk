import { apiClient } from "@/api/client";
import type {
  Ticket,
  TicketDetails,
  Attachment,
  SupportTeam,
  StaffMember,
} from "../types";

export const ticketsApi = {
  getTickets(search?: string): Promise<Ticket[]> {
    const params = new URLSearchParams();
    if (search) {
      params.append("search", search);
    }
    const query = params.toString();
    return apiClient.get<Ticket[]>(`/tickets${query ? `?${query}` : ""}`);
  },

  getTicketDetails(id: string): Promise<TicketDetails> {
    return apiClient.get<TicketDetails>(`/tickets/${id}`);
  },

  postTicketMessage(
    id: string,
    payload: { body: string; isInternal: boolean; attachments?: Attachment[] }
  ): Promise<any> {
    return apiClient.post<any>(`/tickets/${id}/messages`, payload);
  },

  updateTicketProperties(id: string, payload: Partial<Ticket>): Promise<any> {
    return apiClient.put<any>(`/tickets/${id}`, payload);
  },

  mergeTickets(payload: {
    parentTicketId: string;
    childTicketId: string;
  }): Promise<any> {
    return apiClient.post<any>("/tickets/merge", payload);
  },

  uploadAttachment(file: File): Promise<Attachment> {
    const formData = new FormData();
    formData.append("file", file);
    return apiClient.post<Attachment>("/uploads/attachment", formData);
  },

  getTeamsList(): Promise<SupportTeam[]> {
    return apiClient.get<SupportTeam[]>("/teams");
  },

  getStaffList(): Promise<StaffMember[]> {
    return apiClient.get<StaffMember[]>("/staff");
  },
};
