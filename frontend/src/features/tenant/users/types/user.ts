export interface StaffMember {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  role: "admin" | "agent";
  jobTitle: string | null;
  initials: string;
  isActive: boolean;
  createdAt: string;
  updatedAt?: string;
  createdBy?: string | null;
  updatedBy?: string | null;
  teamCount: number;
}
