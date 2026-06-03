import { apiClient } from "@/api/client";
import { StaffMember } from "../types";

export const usersApi = {
  getStaffDirectory(): Promise<StaffMember[]> {
    return apiClient.get<StaffMember[]>("/staff");
  },

  createStaff(payload: any): Promise<StaffMember> {
    return apiClient.post<StaffMember>("/staff", payload);
  },

  updateStaff(id: string, payload: any): Promise<StaffMember> {
    return apiClient.put<StaffMember>(`/staff/${id}`, payload);
  },
};
