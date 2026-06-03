import { useMemo, useState } from "react";
import {
  AlertTriangle,
  BarChart3,
  CalendarDays,
  Download,
  Gauge,
  LineChart as LineChartIcon,
  Search,
  ShieldAlert,
  Timer,
  Users,
  X,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useReportsOverview, useReportsSla, useReportsAgents, useReportsDrilldown } from "../hooks/useReports";
import { useTeamsList } from "@/features/tenant/teams";
import { useStaffDirectory } from "@/features/tenant/users";
import { DateRange, AgentReport } from "../types";
import { getApiBase } from "@/utils/api";

const API_BASE = getApiBase();
const COLORS = ["#2563eb", "#16a34a", "#f59e0b", "#dc2626", "#7c3aed", "#0891b2", "#4b5563"];

const kpiLabels: Record<string, { label: string; suffix?: string; drilldown?: string; icon: typeof Gauge }> = {
  totalCreated: { label: "Created Tickets", drilldown: "created", icon: BarChart3 },
  totalResolved: { label: "Resolved Tickets", drilldown: "resolved", icon: LineChartIcon },
  openBacklog: { label: "Open Backlog", drilldown: "open_backlog", icon: Gauge },
  unassignedOpen: { label: "Unassigned Open", drilldown: "unassigned", icon: Users },
  urgentHighOpen: { label: "Urgent / High Open", drilldown: "urgent_high", icon: ShieldAlert },
  avgFirstResponseHours: { label: "Avg First Response", suffix: "h", icon: Timer },
  avgResolutionHours: { label: "Avg Resolution", suffix: "h", icon: Timer },
  responseSlaMetPct: { label: "Response SLA Met", suffix: "%", icon: Gauge },
  resolutionSlaMetPct: { label: "Resolution SLA Met", suffix: "%", icon: Gauge },
  avgCsat: { label: "Avg CSAT", suffix: "/5", icon: Gauge },
};

function formatDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

function getPresetRange(days: number): DateRange {
  const to = new Date();
  const from = new Date();
  from.setDate(to.getDate() - (days - 1));
  return { from: formatDate(from), to: formatDate(to) };
}

function formatMetric(value: number | null, suffix = "") {
  if (value === null || value === undefined) return "N/A";
  return `${value.toLocaleString(undefined, { maximumFractionDigits: 1 })}${suffix}`;
}

function formatDelta(delta: number | null) {
  if (delta === null) return "No prior baseline";
  const sign = delta > 0 ? "+" : "";
  return `${sign}${delta.toFixed(1)}% vs previous`;
}

function shortDate(value: string | null) {
  if (!value) return "N/A";
  return new Date(value).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function EmptyChart({ label }: { label: string }) {
  return (
    <div className="h-64 border border-dashed border-black/10 rounded-xl grid place-items-center text-xs text-muted-foreground bg-surface/10">
      {label}
    </div>
  );
}

function SectionTitle({ eyebrow, title }: { eyebrow: string; title: string }) {
  return (
    <div>
      <span className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">{eyebrow}</span>
      <h2 className="font-serif text-2xl text-ink mt-1">{title}</h2>
    </div>
  );
}

function ChartPanel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="border border-black/10 rounded-xl bg-canvas p-5 shadow-sm min-w-0">
      <h3 className="text-xs font-semibold uppercase tracking-wider font-mono text-muted-foreground mb-4">{title}</h3>
      {children}
    </div>
  );
}

export function ReportsDashboard() {
  const [range, setRange] = useState<DateRange>(getPresetRange(30));
  const [teamId, setTeamId] = useState<string>("");
  const [agentId, setAgentId] = useState<string>("");
  
  const [drilldownType, setDrilldownType] = useState<string | null>(null);
  const [agentSort, setAgentSort] = useState<keyof AgentReport>("assignedOpenTickets");

  const filters = useMemo(() => ({
    from: range.from,
    to: range.to,
    teamId: teamId || undefined,
    agentId: agentId || undefined,
  }), [range.from, range.to, teamId, agentId]);

  // Queries
  const { data: overview, isLoading: loadingOverview } = useReportsOverview(filters);
  const { data: sla, isLoading: loadingSla } = useReportsSla(filters);
  const { data: agents = [], isLoading: loadingAgents } = useReportsAgents(filters);
  const { data: drilldown, isLoading: loadingDrilldown } = useReportsDrilldown({
    ...filters,
    type: drilldownType,
  });

  const { data: teams = [] } = useTeamsList();
  const { data: staff = [] } = useStaffDirectory();

  const sortedAgents = useMemo(() => {
    return [...agents].sort((a, b) => {
      const left = a[agentSort];
      const right = b[agentSort];
      if (typeof left === "number" || typeof right === "number") {
        return Number(right || 0) - Number(left || 0);
      }
      return String(right || "").localeCompare(String(left || ""));
    });
  }, [agentSort, agents]);

  const downloadCsv = async () => {
    if (!drilldownType) return;
    const drillParams = new URLSearchParams({
      from: filters.from,
      to: filters.to,
      type: drilldownType,
      format: "csv"
    });
    if (filters.teamId) drillParams.set("teamId", filters.teamId);
    if (filters.agentId) drillParams.set("agentId", filters.agentId);

    const res = await fetch(`${API_BASE}/reports/drilldown?${drillParams.toString()}`, { credentials: "include" });
    if (!res.ok) return;
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `supportdesk-${drilldownType}-report.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const kpis = overview?.kpis || [];
  const loading = loadingOverview || loadingSla || loadingAgents;

  return (
    <div className="space-y-10">
      {/* Filtering Hub */}
      <div className="border border-black/10 rounded-xl bg-surface/10 p-4 flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-wrap items-end gap-3">
          <label className="flex flex-col gap-1 text-[9px] font-mono uppercase tracking-widest text-muted-foreground">
            Date Range
            <div className="flex items-center gap-1.5">
              <button onClick={() => setRange(getPresetRange(1))} className="px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-canvas border border-black/10 hover:bg-surface transition-colors cursor-pointer">
                Today
              </button>
              <button onClick={() => setRange(getPresetRange(7))} className="px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-canvas border border-black/10 hover:bg-surface transition-colors cursor-pointer">
                7 Days
              </button>
              <button onClick={() => setRange(getPresetRange(30))} className="px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-canvas border border-black/10 hover:bg-surface transition-colors cursor-pointer">
                30 Days
              </button>
            </div>
          </label>

          <label className="flex flex-col gap-1 text-[9px] font-mono uppercase tracking-widest text-muted-foreground">
            From
            <input type="date" value={range.from} onChange={(e) => setRange((prev) => ({ ...prev, from: e.target.value }))} className="bg-canvas border border-black/10 rounded-lg px-2 py-1.5 text-xs text-ink font-sans" />
          </label>

          <label className="flex flex-col gap-1 text-[9px] font-mono uppercase tracking-widest text-muted-foreground">
            To
            <input type="date" value={range.to} onChange={(e) => setRange((prev) => ({ ...prev, to: e.target.value }))} className="bg-canvas border border-black/10 rounded-lg px-2 py-1.5 text-xs text-ink font-sans" />
          </label>
        </div>

        <div className="flex flex-wrap items-end gap-3">
          <label className="flex flex-col gap-1 text-[9px] font-mono uppercase tracking-widest text-muted-foreground">
            Filter by Team
            <select
              value={teamId}
              onChange={(e) => setTeamId(e.target.value)}
              className="bg-canvas border border-black/10 rounded-lg px-3 py-1.5 text-xs text-ink font-sans max-w-[180px] focus:outline-none"
            >
              <option value="">All Teams</option>
              {teams.map((t) => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-1 text-[9px] font-mono uppercase tracking-widest text-muted-foreground">
            Filter by Agent
            <select
              value={agentId}
              onChange={(e) => setAgentId(e.target.value)}
              className="bg-canvas border border-black/10 rounded-lg px-3 py-1.5 text-xs text-ink font-sans max-w-[180px] focus:outline-none"
            >
              <option value="">All Agents</option>
              {staff.map((s) => (
                <option key={s.id} value={s.id}>{s.firstName} {s.lastName}</option>
              ))}
            </select>
          </label>
        </div>
      </div>

      {loading ? (
        <div className="py-20 text-center text-xs text-muted-foreground font-mono">Loading reporting dashboard...</div>
      ) : (
        <div className="space-y-10">
          {/* Executive Snapshot */}
          <section className="space-y-5">
            <SectionTitle eyebrow="Executive Snapshot" title="Workspace performance" />
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-4">
              {kpis.map((kpi) => {
                const meta = kpiLabels[kpi.key];
                if (!meta) return null;
                const Icon = meta.icon;
                return (
                  <button
                    key={kpi.key}
                    disabled={!meta.drilldown}
                    onClick={() => meta.drilldown && setDrilldownType(meta.drilldown)}
                    className="border border-black/10 rounded-xl bg-canvas p-4 text-left shadow-sm hover:shadow-md hover:border-black/20 transition-all disabled:hover:shadow-sm disabled:cursor-default cursor-pointer group"
                  >
                    <div className="flex items-center justify-between mb-4">
                      <Icon className="size-4 text-muted-foreground group-hover:text-ink transition-colors" />
                      {meta.drilldown && <Search className="size-3.5 text-muted-foreground/50 group-hover:text-ink transition-colors" />}
                    </div>
                    <span className="block text-[10px] font-mono uppercase tracking-widest text-muted-foreground">{meta.label}</span>
                    <strong className="block text-2xl font-serif mt-1">{formatMetric(kpi.value, meta.suffix)}</strong>
                    <span className="block text-[10px] text-muted-foreground mt-1">{formatDelta(kpi.deltaPct)}</span>
                  </button>
                );
              })}
            </div>
          </section>

          {/* Ticket Performance */}
          <section className="space-y-5">
            <SectionTitle eyebrow="Ticket Performance" title="Volume, mix, and demand" />
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
              <ChartPanel title="Created vs Resolved">
                {overview && overview.trend.some((row) => row.created || row.resolved) ? (
                  <div className="h-72">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={overview.trend}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                        <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                        <YAxis allowDecimals={false} tick={{ fontSize: 10 }} />
                        <Tooltip />
                        <Line type="monotone" dataKey="created" stroke="#2563eb" strokeWidth={2} dot={false} name="Created" />
                        <Line type="monotone" dataKey="resolved" stroke="#16a34a" strokeWidth={2} dot={false} name="Resolved" />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <EmptyChart label="No ticket volume for this range." />
                )}
              </ChartPanel>

              <ChartPanel title="Priority Mix">
                {overview && overview.breakdowns.priority.length > 0 ? (
                  <div className="h-72">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={overview.breakdowns.priority} dataKey="value" nameKey="name" innerRadius={58} outerRadius={92} label>
                          {overview.breakdowns.priority.map((_, index) => <Cell key={index} fill={COLORS[index % COLORS.length]} />)}
                        </Pie>
                        <Tooltip />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <EmptyChart label="No priority data for this range." />
                )}
              </ChartPanel>

              <ChartPanel title="Top Clients">
                {overview && overview.breakdowns.client.length > 0 ? (
                  <div className="h-72">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={overview.breakdowns.client.slice(0, 6)} layout="vertical">
                        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                        <XAxis type="number" allowDecimals={false} tick={{ fontSize: 10 }} />
                        <YAxis type="category" dataKey="name" width={110} tick={{ fontSize: 10 }} />
                        <Tooltip />
                        <Bar dataKey="value" fill="#0891b2" radius={[0, 4, 4, 0]} name="Tickets" />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <EmptyChart label="No client demand for this range." />
                )}
              </ChartPanel>
            </div>
          </section>

          {/* SLA Health */}
          <section className="space-y-5">
            <SectionTitle eyebrow="SLA Health" title="Risk, breaches, and deadlines" />
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              {[
                { label: "At Risk", value: sla?.live.atRisk || 0, type: "at_risk", icon: AlertTriangle },
                { label: "Breached", value: sla?.live.breached || 0, type: "breached", icon: ShieldAlert },
                { label: "Due In 2h", value: sla?.live.dueInTwoHours || 0, type: "open_backlog", icon: Timer },
                { label: "Due Today", value: sla?.live.dueToday || 0, type: "open_backlog", icon: CalendarDays },
              ].map((item) => {
                const Icon = item.icon;
                return (
                  <button key={item.label} onClick={() => setDrilldownType(item.type)} className="border border-black/10 rounded-xl bg-canvas p-4 text-left shadow-sm hover:shadow-md hover:border-black/20 transition-all cursor-pointer">
                    <Icon className="size-4 text-muted-foreground mb-4" />
                    <span className="block text-[10px] font-mono uppercase tracking-widest text-muted-foreground">{item.label}</span>
                    <strong className="block text-3xl font-serif mt-1">{item.value}</strong>
                  </button>
                );
              })}
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
              <ChartPanel title="SLA Met vs Missed">
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={[
                      { name: "Response", met: sla?.historical.responseMet || 0, missed: sla?.historical.responseMissed || 0 },
                      { name: "Resolution", met: sla?.historical.resolutionMet || 0, missed: sla?.historical.resolutionMissed || 0 },
                    ]}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                      <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                      <YAxis allowDecimals={false} tick={{ fontSize: 10 }} />
                      <Tooltip />
                      <Bar dataKey="met" fill="#16a34a" radius={[4, 4, 0, 0]} name="Met" />
                      <Bar dataKey="missed" fill="#dc2626" radius={[4, 4, 0, 0]} name="Missed" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </ChartPanel>

              <ChartPanel title="Breach Trend">
                {sla && sla.historical.breachTrend.some((row) => row.breached) ? (
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={sla.historical.breachTrend}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                        <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                        <YAxis allowDecimals={false} tick={{ fontSize: 10 }} />
                        <Tooltip />
                        <Line type="monotone" dataKey="breached" stroke="#dc2626" strokeWidth={2} dot={false} name="Breaches" />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <EmptyChart label="No SLA breaches in this range." />
                )}
              </ChartPanel>

              <ChartPanel title="Next SLA Deadlines">
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {sla && sla.dueSoon.length > 0 ? sla.dueSoon.map((ticket) => (
                    <div key={ticket.id} className="border border-black/5 rounded-lg p-3 bg-surface/10">
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-[10px] font-mono font-bold text-muted-foreground">#{ticket.code}</span>
                        <span className="text-[10px] font-mono text-muted-foreground">{shortDate(ticket.slaResolutionDueAt)}</span>
                      </div>
                      <p className="text-xs font-semibold line-clamp-1 mt-1">{ticket.subject}</p>
                      <p className="text-[10px] text-muted-foreground mt-1">{ticket.clientName || "Unknown client"}</p>
                    </div>
                  )) : (
                    <div className="h-52 grid place-items-center text-xs text-muted-foreground">No upcoming SLA deadlines.</div>
                  )}
                </div>
              </ChartPanel>
            </div>
          </section>

          {/* Agent Performance */}
          <section className="space-y-5">
            <SectionTitle eyebrow="Agent Performance" title="Workload and outcomes" />
            <div className="border border-black/10 rounded-xl bg-canvas shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-surface/30 text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
                    <tr>
                      <th className="px-4 py-3">Agent</th>
                      {[
                        ["assignedOpenTickets", "Open"],
                        ["resolvedTickets", "Resolved"],
                        ["avgFirstResponseHours", "First Resp"],
                        ["avgResolutionHours", "Resolution"],
                        ["breachedAssignedTickets", "Breaches"],
                        ["csatAverage", "CSAT"],
                      ].map(([key, label]) => (
                        <th key={key} className="px-4 py-3">
                          <button onClick={() => setAgentSort(key as keyof AgentReport)} className="hover:text-ink focus:outline-none font-bold font-mono tracking-wider cursor-pointer">{label}</button>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-black/5">
                    {sortedAgents.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="px-4 py-12 text-center text-muted-foreground">No active staff members found.</td>
                      </tr>
                    ) : sortedAgents.map((agent) => (
                      <tr key={agent.id} className="hover:bg-surface/20">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            <span className="size-8 rounded-full bg-surface border border-black/5 grid place-items-center text-[10px] font-mono font-bold">{agent.initials}</span>
                            <div>
                              <p className="font-semibold">{agent.firstName} {agent.lastName}</p>
                              <p className="text-[10px] text-muted-foreground">{agent.email}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3">{agent.assignedOpenTickets}</td>
                        <td className="px-4 py-3">{agent.resolvedTickets}</td>
                        <td className="px-4 py-3">{formatMetric(agent.avgFirstResponseHours, "h")}</td>
                        <td className="px-4 py-3">{formatMetric(agent.avgResolutionHours, "h")}</td>
                        <td className="px-4 py-3">{agent.breachedAssignedTickets}</td>
                        <td className="px-4 py-3">{agent.csatAverage ? `${agent.csatAverage}/5 (${agent.csatCount})` : "N/A"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </section>
        </div>
      )}

      {/* Drilldown Slideover Modal */}
      {drilldownType && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex justify-end">
          <div className="w-full max-w-4xl h-full bg-canvas shadow-xl border-l border-black/10 flex flex-col animate-in slide-in-from-right duration-200">
            <div className="p-5 border-b border-black/10 flex items-center justify-between gap-4">
              <div>
                <span className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">Drill-down</span>
                <h3 className="font-serif text-2xl mt-1 capitalize">{drilldownType.replace(/_/g, " ")}</h3>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={downloadCsv} className="px-3 py-2 rounded-lg bg-ink text-canvas text-xs font-semibold flex items-center gap-1.5 hover:opacity-90 active:scale-95 transition-all cursor-pointer shadow-sm">
                  <Download className="size-3.5" />
                  CSV
                </button>
                <button onClick={() => setDrilldownType(null)} className="size-9 rounded-lg border border-black/10 grid place-items-center hover:bg-surface transition-colors cursor-pointer">
                  <X className="size-4" />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-auto">
              {loadingDrilldown ? (
                <div className="py-20 text-center text-xs text-muted-foreground font-mono">Loading matching tickets...</div>
              ) : !drilldown || drilldown.rows.length === 0 ? (
                <div className="py-20 text-center text-xs text-muted-foreground">No tickets match this report slice.</div>
              ) : (
                <table className="w-full text-left text-xs">
                  <thead className="sticky top-0 bg-surface text-[10px] font-mono uppercase tracking-wider text-muted-foreground border-b border-black/10">
                    <tr>
                      <th className="px-4 py-3">Code</th>
                      <th className="px-4 py-3">Subject</th>
                      <th className="px-4 py-3">Client</th>
                      <th className="px-4 py-3">Assignee</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3">SLA</th>
                      <th className="px-4 py-3">Created</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-black/5 bg-canvas">
                    {drilldown.rows.map((ticket) => (
                      <tr key={ticket.id} className="hover:bg-surface/20 transition-colors">
                        <td className="px-4 py-3 font-mono font-bold text-muted-foreground">#{ticket.code}</td>
                        <td className="px-4 py-3 font-semibold max-w-sm">
                          <span className="line-clamp-1">{ticket.subject}</span>
                          <span className="block text-[10px] text-muted-foreground mt-1 capitalize">{ticket.priority} priority</span>
                        </td>
                        <td className="px-4 py-3">{ticket.clientName || "N/A"}</td>
                        <td className="px-4 py-3">{ticket.assigneeName || "Unassigned"}</td>
                        <td className="px-4 py-3 capitalize">{ticket.status}</td>
                        <td className="px-4 py-3 capitalize">{ticket.slaState}</td>
                        <td className="px-4 py-3">{shortDate(ticket.createdAt)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
