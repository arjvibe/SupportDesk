export const queryKeys = {
  auth: {
    session: () => ["auth_session"] as const,
    workspace: (subdomain: string | null) => ["public_workspace", subdomain] as const,
  },
  tickets: {
    list: (filters?: Record<string, any>) => ["tickets", filters || {}] as const,
    detail: (id: string) => ["tickets", id] as const,
  },
  clients: {
    list: () => ["clients"] as const,
    users: (clientId: string | null) => ["clients", clientId, "users"] as const,
  },
  teams: {
    list: () => ["teams"] as const,
    members: (teamId: string) => ["teams", teamId, "agents"] as const,
    availableAgents: () => ["available_agents"] as const,
  },
  staff: {
    list: () => ["staff_directory"] as const,
  },
  sla: {
    list: () => ["sla_policies"] as const,
    detail: (id: string | null) => ["sla_policies", id] as const,
  },
  rules: {
    list: () => ["routing_rules"] as const,
  },
  reports: {
    data: (filters: any) => ["reports", filters] as const,
  },
};
