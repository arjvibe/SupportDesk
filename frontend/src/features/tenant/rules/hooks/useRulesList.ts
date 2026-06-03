import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/lib/queryKeys";
import { rulesApi } from "../api/rulesApi";
import { RoutingRule } from "../types";

export function useRulesList() {
  return useQuery<RoutingRule[]>({
    queryKey: queryKeys.rules.list(),
    queryFn: () => rulesApi.getRules(),
  });
}
