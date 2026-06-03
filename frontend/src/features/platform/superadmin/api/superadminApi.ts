import { apiClient } from "@/api/client";
import {
  Organization,
  CreateOrganizationPayload,
  EditOrganizationPayload,
  NotificationChannelConfig,
} from "../types";

export const superadminApi = {
  getOrganizations(): Promise<Organization[]> {
    return apiClient.get<Organization[]>("/superadmin/organizations");
  },

  createOrganization(payload: CreateOrganizationPayload): Promise<any> {
    return apiClient.post<any>("/superadmin/organizations", payload);
  },

  updateOrganization(id: string, payload: Partial<EditOrganizationPayload>): Promise<any> {
    return apiClient.put<any>(`/superadmin/organizations/${id}`, payload);
  },

  getOrgNotifications(orgId: string): Promise<NotificationChannelConfig[]> {
    return apiClient.get<NotificationChannelConfig[]>(`/superadmin/organizations/${orgId}/notifications`);
  },

  updateOrgNotification(orgId: string, payload: NotificationChannelConfig): Promise<any> {
    return apiClient.put<any>(`/superadmin/organizations/${orgId}/notifications`, payload);
  },
};
