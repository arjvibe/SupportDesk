import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

export type User = {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: "admin" | "agent" | "client_user";
  initials: string;
  organizationId: string | null;
};

import { getApiBase } from "../utils/api";

const API_BASE = getApiBase();

// Helper to fetch session
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

// Helper to fetch session
async function fetchSession(): Promise<AuthSession> {
  const res = await fetch(`${API_BASE}/auth/session`, {
    credentials: "include", // Ensure cookies are sent
  });

  if (!res.ok) {
    return { user: null, org: null };
  }

  const data = await res.json();
  return {
    user: data.user || null,
    org: data.org || null,
  };
}

export function useAuth() {
  const queryClient = useQueryClient();

  // 1. Session check query
  const { data: sessionData, isLoading, isError } = useQuery<AuthSession>({
    queryKey: ["auth_session"],
    queryFn: fetchSession,
    retry: false,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  const user = sessionData?.user || null;
  const org = sessionData?.org || null;

  // 2. Login mutation
  const loginMutation = useMutation({
    mutationFn: async (credentials: { email: string; password: string }) => {
      const res = await fetch(`${API_BASE}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(credentials),
        credentials: "include",
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Login failed");
      }
      return { user: data.user, org: data.org } as AuthSession;
    },
    onSuccess: (data) => {
      queryClient.setQueryData(["auth_session"], data);
    },
  });

  // 3. Logout mutation
  const logoutMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`${API_BASE}/auth/logout`, {
        method: "POST",
        credentials: "include",
      });
      if (!res.ok) {
        throw new Error("Logout failed");
      }
      return true;
    },
    onSuccess: () => {
      queryClient.setQueryData(["auth_session"], { user: null, org: null });
      queryClient.clear(); // Clear all caches on logout
    },
  });

  return {
    user,
    org,
    isAuthenticated: !!user,
    isLoading,
    isError,
    login: loginMutation.mutateAsync,
    isLoggingIn: loginMutation.isPending,
    loginError: loginMutation.error ? loginMutation.error.message : null,
    logout: logoutMutation.mutateAsync,
    isLoggingOut: logoutMutation.isPending,
  };
}
