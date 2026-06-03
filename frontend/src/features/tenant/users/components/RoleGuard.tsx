import { ReactNode } from "react";
import { useAuth } from "@/features/tenant/auth";

interface RoleGuardProps {
  allowedRoles: ("admin" | "agent" | "client_user")[];
  fallback?: ReactNode;
  children: ReactNode;
}

export function RoleGuard({ allowedRoles, fallback = null, children }: RoleGuardProps) {
  const { user } = useAuth();

  if (!user || !allowedRoles.includes(user.role as any)) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
}
