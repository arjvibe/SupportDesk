import { apiClient } from "@/api/client";
import { RoutingRule } from "../types";

export const rulesApi = {
  getRules(): Promise<RoutingRule[]> {
    return apiClient.get<RoutingRule[]>("/rules");
  },

  createRule(payload: any): Promise<RoutingRule> {
    return apiClient.post<RoutingRule>("/rules", payload);
  },

  updateRule(id: string, payload: any): Promise<RoutingRule> {
    return apiClient.put<RoutingRule>(`/rules/${id}`, payload);
  },

  deleteRule(id: string): Promise<any> {
    return apiClient.delete<any>(`/rules/${id}`);
  },

  reorderRules(orderedIds: string[]): Promise<any> {
    return apiClient.put<any>("/rules/reorder", { orderedIds });
  },
};
