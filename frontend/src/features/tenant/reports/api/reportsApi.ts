import { apiClient } from "@/api/client";
import { OverviewReport, SlaReport, AgentReport, DrilldownResponse, DateRange } from "../types";

export type ReportFilterParams = DateRange & {
  teamId?: string;
  agentId?: string;
};

export const reportsApi = {
  getOverview(params: ReportFilterParams): Promise<OverviewReport> {
    const queryParams = new URLSearchParams();
    queryParams.set("from", params.from);
    queryParams.set("to", params.to);
    if (params.teamId) queryParams.set("teamId", params.teamId);
    if (params.agentId) queryParams.set("agentId", params.agentId);
    
    return apiClient.get<OverviewReport>(`/reports/overview?${queryParams.toString()}`);
  },

  getSla(params: ReportFilterParams): Promise<SlaReport> {
    const queryParams = new URLSearchParams();
    queryParams.set("from", params.from);
    queryParams.set("to", params.to);
    if (params.teamId) queryParams.set("teamId", params.teamId);
    if (params.agentId) queryParams.set("agentId", params.agentId);

    return apiClient.get<SlaReport>(`/reports/sla?${queryParams.toString()}`);
  },

  getAgents(params: ReportFilterParams): Promise<AgentReport[]> {
    const queryParams = new URLSearchParams();
    queryParams.set("from", params.from);
    queryParams.set("to", params.to);
    if (params.teamId) queryParams.set("teamId", params.teamId);
    if (params.agentId) queryParams.set("agentId", params.agentId);

    return apiClient.get<AgentReport[]>(`/reports/agents?${queryParams.toString()}`);
  },

  getDrilldown(params: ReportFilterParams & { type: string }): Promise<DrilldownResponse> {
    const queryParams = new URLSearchParams();
    queryParams.set("from", params.from);
    queryParams.set("to", params.to);
    queryParams.set("type", params.type);
    if (params.teamId) queryParams.set("teamId", params.teamId);
    if (params.agentId) queryParams.set("agentId", params.agentId);

    return apiClient.get<DrilldownResponse>(`/reports/drilldown?${queryParams.toString()}`);
  },
};
