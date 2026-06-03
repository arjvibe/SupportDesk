import { apiClient } from "@/api/client";
import { SlaPolicy, SlaPolicyDetails, SlaTarget } from "../types";

export const slaApi = {
  getPolicies(): Promise<SlaPolicy[]> {
    return apiClient.get<SlaPolicy[]>("/sla");
  },

  getPolicyDetails(id: string): Promise<SlaPolicyDetails> {
    return apiClient.get<SlaPolicyDetails>(`/sla/${id}`);
  },

  createPolicy(payload: { name: string; description: string }): Promise<SlaPolicy> {
    return apiClient.post<SlaPolicy>("/sla", payload);
  },

  updatePolicy(id: string, payload: any): Promise<SlaPolicy> {
    return apiClient.put<SlaPolicy>(`/sla/${id}`, payload);
  },

  updatePolicyTargets(id: string, targets: SlaTarget[]): Promise<any> {
    return apiClient.put<any>(`/sla/${id}/targets`, { targets });
  },

  makeDefault(id: string): Promise<any> {
    return apiClient.post<any>(`/sla/${id}/default`);
  },
};
