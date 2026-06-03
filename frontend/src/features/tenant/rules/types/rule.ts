export interface RoutingRule {
  id: string;
  name: string;
  priorityOrder: number;
  criteriaField: "category" | "client" | "priority";
  criteriaValue: string;
  targetTeamId: string | null;
  targetAgentId: string | null;
  assignmentMode: "direct" | "round-robin";
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
  createdBy?: string | null;
  updatedBy?: string | null;
}
