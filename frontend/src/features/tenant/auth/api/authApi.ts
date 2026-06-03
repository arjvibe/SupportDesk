import { apiClient } from "@/api/client";
import { AuthSession } from "../types";

export const authApi = {
  async getSession(): Promise<AuthSession> {
    try {
      return await apiClient.get<AuthSession>("/auth/session");
    } catch (err: any) {
      if (err && (err.status === 401 || err.status === 403)) {
        return { user: null, org: null };
      }
      throw err;
    }
  },

  login(credentials: { email: string; password: string }): Promise<AuthSession> {
    return apiClient.post<AuthSession>("/auth/login", credentials);
  },

  logout(): Promise<{ success: boolean }> {
    return apiClient.post<{ success: boolean }>("/auth/logout");
  },

  getWorkspacePublic(): Promise<any> {
    return apiClient.get<any>("/auth/workspace");
  },
};
