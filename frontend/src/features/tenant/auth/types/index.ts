export type User = {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: "admin" | "agent" | "client_user";
  initials: string;
  organizationId: string | null;
};

export type Org = {
  id: string;
  name: string;
  subdomain: string;
  subscriptionTier: string;
  logoUrl: string | null;
  primaryColor: string | null;
  secondaryColor: string | null;
};

export type AuthSession = {
  user: User | null;
  org: Org | null;
};
