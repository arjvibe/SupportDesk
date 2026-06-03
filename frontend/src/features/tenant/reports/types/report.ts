export type DateRange = {
  from: string;
  to: string;
};

export type Kpi = {
  key: string;
  value: number | null;
  deltaPct: number | null;
};

export type OverviewReport = {
  range: DateRange;
  kpis: Kpi[];
  trend: Array<{ date: string; created: number; resolved: number; breached: number }>;
  breakdowns: {
    status: Array<{ name: string; value: number }>;
    priority: Array<{ name: string; value: number }>;
    workstream: Array<{ name: string; value: number }>;
    client: Array<{ name: string; value: number }>;
  };
};

export type SlaReport = {
  live: {
    atRisk: number;
    breached: number;
    dueInTwoHours: number;
    dueToday: number;
  };
  historical: {
    responseMet: number;
    responseMissed: number;
    resolutionMet: number;
    resolutionMissed: number;
    breachTrend: Array<{ date: string; breached: number }>;
    breachByPriority: Array<{ name: string; value: number }>;
    breachByClient: Array<{ name: string; value: number }>;
    breachByTeam: Array<{ name: string; value: number }>;
  };
  dueSoon: DrilldownTicket[];
};

export type AgentReport = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  role: "admin" | "agent";
  initials: string;
  assignedOpenTickets: number;
  resolvedTickets: number;
  avgFirstResponseHours: number | null;
  avgResolutionHours: number | null;
  breachedAssignedTickets: number;
  csatAverage: number | null;
  csatCount: number;
};

export type DrilldownTicket = {
  id: string;
  code: number;
  subject: string;
  status: string;
  priority: string;
  workstream: string | null;
  clientName: string | null;
  assigneeName: string | null;
  teamName: string | null;
  slaState: string;
  createdAt: string | null;
  firstRespondedAt: string | null;
  resolvedAt: string | null;
  slaResponseDueAt: string | null;
  slaResolutionDueAt: string | null;
};

export type DrilldownResponse = {
  type: string;
  rows: DrilldownTicket[];
};
