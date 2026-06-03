import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/lib/queryKeys";
import { slaApi } from "../api/slaApi";
import { SlaPolicy, SlaPolicyDetails } from "../types";

export function useSlaPolicies() {
  return useQuery<SlaPolicy[]>({
    queryKey: queryKeys.sla.list(),
    queryFn: () => slaApi.getPolicies(),
  });
}

export function useSlaPolicyDetails(id: string | null) {
  return useQuery<SlaPolicyDetails>({
    queryKey: queryKeys.sla.detail(id),
    queryFn: () => slaApi.getPolicyDetails(id!),
    enabled: !!id,
  });
}
