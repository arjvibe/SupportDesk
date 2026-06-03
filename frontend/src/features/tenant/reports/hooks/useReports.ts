import { useQuery } from "@tanstack/react-query";
import { reportsApi, ReportFilterParams } from "../api/reportsApi";
import { OverviewReport, SlaReport, AgentReport, DrilldownResponse } from "../types";

export function useReportsOverview(filters: ReportFilterParams) {
  return useQuery<OverviewReport>({
    queryKey: ["reports_overview", filters],
    queryFn: () => reportsApi.getOverview(filters),
  });
}

export function useReportsSla(filters: ReportFilterParams) {
  return useQuery<SlaReport>({
    queryKey: ["reports_sla", filters],
    queryFn: () => reportsApi.getSla(filters),
  });
}

export function useReportsAgents(filters: ReportFilterParams) {
  return useQuery<AgentReport[]>({
    queryKey: ["reports_agents", filters],
    queryFn: () => reportsApi.getAgents(filters),
  });
}

export function useReportsDrilldown(filters: ReportFilterParams & { type: string | null }) {
  return useQuery<DrilldownResponse>({
    queryKey: ["reports_drilldown", filters],
    queryFn: () => reportsApi.getDrilldown({ ...filters, type: filters.type || "created" }),
    enabled: !!filters.type,
  });
}
