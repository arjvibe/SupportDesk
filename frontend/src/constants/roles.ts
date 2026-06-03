export const ROLES = {
  SUPER_ADMIN: "superadmin",
  ADMIN: "admin",
  AGENT: "agent",
  CLIENT_USER: "client_user",
} as const;

export type UserRole = typeof ROLES[keyof typeof ROLES];

export const ROLE_LABELS: Record<UserRole, string> = {
  superadmin: "Super Admin",
  admin: "Admin",
  agent: "Agent",
  client_user: "Client User",
};
