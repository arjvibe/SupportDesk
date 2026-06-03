export interface TeamLead {
  id: string;
  firstName: string;
  lastName: string;
  initials: string;
}

export interface SupportTeam {
  id: string;
  name: string;
  description: string | null;
  createdAt: string;
  updatedAt?: string;
  createdBy?: string | null;
  updatedBy?: string | null;
  lead: TeamLead | null;
  agentCount: number;
}

export interface TeamAgent {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  role: "admin" | "agent";
  jobTitle: string | null;
  initials: string;
  isLead: boolean;
}

export interface AvailableAgent {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  role: "admin" | "agent";
  jobTitle: string | null;
  initials: string;
  teamCount: number;
}
