import { apiClient } from "@/api/client";
import { SupportTeam, TeamAgent, AvailableAgent } from "../types";

export const teamsApi = {
  getTeams(): Promise<SupportTeam[]> {
    return apiClient.get<SupportTeam[]>("/teams");
  },

  getAvailableAgents(): Promise<AvailableAgent[]> {
    return apiClient.get<AvailableAgent[]>("/teams/agents/available");
  },

  getTeamAgents(teamId: string): Promise<TeamAgent[]> {
    return apiClient.get<TeamAgent[]>(`/teams/${teamId}/agents`);
  },

  createTeam(payload: { name: string; description: string }): Promise<SupportTeam> {
    return apiClient.post<SupportTeam>("/teams", payload);
  },

  assignTeamAgent(teamId: string, payload: { agentId: string; isLead: boolean }): Promise<any> {
    return apiClient.post<any>(`/teams/${teamId}/agents`, payload);
  },

  removeTeamAgent(teamId: string, agentId: string): Promise<any> {
    return apiClient.delete<any>(`/teams/${teamId}/agents/${agentId}`);
  },

  toggleAgentLead(teamId: string, agentId: string, isLead: boolean): Promise<any> {
    return apiClient.put<any>(`/teams/${teamId}/agents/${agentId}/lead`, { isLead });
  },
};
