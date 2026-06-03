import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/lib/queryKeys";
import { usersApi } from "../api/usersApi";
import { StaffMember } from "../types";

export function useStaffDirectory() {
  return useQuery<StaffMember[]>({
    queryKey: queryKeys.staff.list(),
    queryFn: () => usersApi.getStaffDirectory(),
  });
}
