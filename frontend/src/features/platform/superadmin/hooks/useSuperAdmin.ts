import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { superadminApi } from "../api/superadminApi";
import {
  Organization,
  CreateOrganizationPayload,
  EditOrganizationPayload,
  NotificationChannelConfig,
} from "../types";

export function useOrganizations() {
  return useQuery<Organization[]>({
    queryKey: ["superadmin_organizations"],
    queryFn: () => superadminApi.getOrganizations(),
  });
}

export function useCreateOrganization() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateOrganizationPayload) =>
      superadminApi.createOrganization(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["superadmin_organizations"] });
    },
  });
}

export function useUpdateOrganization() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: Partial<EditOrganizationPayload> }) =>
      superadminApi.updateOrganization(id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["superadmin_organizations"] });
    },
  });
}

export function useOrgNotifications(orgId: string) {
  return useQuery<NotificationChannelConfig[]>({
    queryKey: ["superadmin_org_notifications", orgId],
    queryFn: () => superadminApi.getOrgNotifications(orgId),
    enabled: !!orgId,
  });
}

export function useUpdateOrgNotification(orgId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: NotificationChannelConfig) =>
      superadminApi.updateOrgNotification(orgId, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["superadmin_org_notifications", orgId] });
    },
  });
}
