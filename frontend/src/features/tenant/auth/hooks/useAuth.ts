import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { authApi } from "../api/authApi";
import { AuthSession } from "../types";
import { queryKeys } from "@/lib/queryKeys";

export function useAuth() {
  const queryClient = useQueryClient();

  // 1. Session check query
  const { data: sessionData, isLoading, isError } = useQuery<AuthSession>({
    queryKey: queryKeys.auth.session(),
    queryFn: authApi.getSession,
    retry: false,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  const user = sessionData?.user || null;
  const org = sessionData?.org || null;

  // 2. Login mutation
  const loginMutation = useMutation({
    mutationFn: authApi.login,
    onSuccess: (data) => {
      queryClient.setQueryData(queryKeys.auth.session(), data);
    },
  });

  // 3. Logout mutation
  const logoutMutation = useMutation({
    mutationFn: authApi.logout,
    onSuccess: () => {
      queryClient.setQueryData(queryKeys.auth.session(), { user: null, org: null });
      setTimeout(() => {
        queryClient.clear(); // Clear all caches on logout after redirect/unmount
      }, 0);
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
