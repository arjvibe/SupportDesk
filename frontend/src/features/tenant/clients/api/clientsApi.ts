import { apiClient } from "@/api/client";

export type ClientOwner = {
  id: string;
  firstName: string;
  lastName: string;
  initials: string;
};

export type ClientAccount = {
  id: string;
  name: string;
  domain: string | null;
  clientTier: "trial" | "business" | "enterprise";
  createdAt: string;
  owner: ClientOwner | null;
  userCount: number;
  ticketCount: number;
};

export type ClientContact = {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  jobTitle: string | null;
  initials: string;
  isActive: boolean;
};

export type StaffMember = {
  id: string;
  firstName: string;
  lastName: string;
  role: string;
  initials: string;
};

export const clientsApi = {
  getClients(): Promise<ClientAccount[]> {
    return apiClient.get<ClientAccount[]>("/clients");
  },

  getStaffList(): Promise<StaffMember[]> {
    return apiClient.get<StaffMember[]>("/clients/staff/list");
  },

  getClientUsers(clientId: string): Promise<ClientContact[]> {
    return apiClient.get<ClientContact[]>(`/clients/${clientId}/users`);
  },

  createClient(payload: {
    name: string;
    domain: string | null;
    clientTier: "trial" | "business" | "enterprise";
    ownerId: string | null;
  }): Promise<ClientAccount> {
    return apiClient.post<ClientAccount>("/clients", payload);
  },

  createClientUser(
    clientId: string,
    payload: any
  ): Promise<ClientContact> {
    return apiClient.post<ClientContact>(`/clients/${clientId}/users`, payload);
  },
};
