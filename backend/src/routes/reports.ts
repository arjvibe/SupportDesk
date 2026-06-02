import { Router, Request, Response } from "express";
import { db } from "../db/connection";
import { clients, teams, ticketFeedback, tickets, users } from "../schema";
import { and, eq, gte, lt, or, sql, inArray, desc, asc } from "drizzle-orm";
import { authenticateToken, requireRole } from "../middleware/auth";

const router = Router();

type DateWindow = {
  from: Date;
  toExclusive: Date;
  previousFrom: Date;
  previousToExclusive: Date;
};

const openStatuses = ["new", "open", "pending"] as const;

/**
 * Parses and computes the date range boundaries from the request query parameters.
 * Calculates both the current active window and the previous baseline period of matching duration.
 * 
 * @param req Express request object containing `from` and `to` date strings
 * @returns Date objects specifying start and end bounds of current and previous periods
 */
function parseDateWindow(req: Request): DateWindow {
  const fromParam = typeof req.query.from === "string" ? req.query.from : null;
  const toParam = typeof req.query.to === "string" ? req.query.to : null;
  const today = new Date();
  const defaultTo = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const defaultFrom = new Date(defaultTo);
  defaultFrom.setDate(defaultFrom.getDate() - 29);

  const from = fromParam ? new Date(`${fromParam}T00:00:00`) : defaultFrom;
  const toStart = toParam ? new Date(`${toParam}T00:00:00`) : defaultTo;
  const toExclusive = new Date(toStart);
  toExclusive.setDate(toExclusive.getDate() + 1);

  const spanMs = Math.max(24 * 60 * 60 * 1000, toExclusive.getTime() - from.getTime());
  const previousToExclusive = new Date(from);
  const previousFrom = new Date(from.getTime() - spanMs);

  return { from, toExclusive, previousFrom, previousToExclusive };
}

/**
 * Formats a Date object to YYYY-MM-DD string.
 */
function dateKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/**
 * Standard rounding helper.
 */
function round(value: number | null, digits = 1): number | null {
  if (value === null || Number.isNaN(value) || !Number.isFinite(value)) return null;
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

/**
 * Percentage calculation helper.
 */
function percent(numerator: number, denominator: number): number | null {
  if (denominator === 0) return null;
  return (numerator / denominator) * 100;
}

/**
 * Delta comparison percentage helper.
 */
function delta(current: number | null, previous: number | null): number | null {
  if (current === null || previous === null || previous === 0) return null;
  return ((current - previous) / previous) * 100;
}

// Apply authentication and administrator role checks globally to all reporting routes
router.use(authenticateToken, requireRole(["admin"]));

/**
 * GET /api/reports/overview
 * 
 * Compiles main executive snapshot KPIs, performance deltas, volume trends, and breakdowns.
 * Runs SQL aggregations at the database level to avoid pulling full rows into memory.
 */
router.get("/overview", async (req: Request, res: Response) => {
  try {
    const window = parseDateWindow(req);
    const orgId = req.user!.orgId;
    const now = new Date();

    const getNum = (val: any) => Number(val || 0);
    const getFrtHrs = (sec: any) => sec ? round(Number(sec) / 3600) : null;

    // 1. Volume Stats (Current & Previous periods)
    const currentCounts = await db
      .select({
        created: sql<number>`COUNT(CASE WHEN ${tickets.createdAt} >= ${window.from.toISOString()} AND ${tickets.createdAt} < ${window.toExclusive.toISOString()} THEN 1 END)`,
        resolved: sql<number>`COUNT(CASE WHEN ${tickets.resolvedAt} >= ${window.from.toISOString()} AND ${tickets.resolvedAt} < ${window.toExclusive.toISOString()} THEN 1 END)`,
      })
      .from(tickets)
      .where(eq(tickets.orgId, orgId));

    const previousCounts = await db
      .select({
        created: sql<number>`COUNT(CASE WHEN ${tickets.createdAt} >= ${window.previousFrom.toISOString()} AND ${tickets.createdAt} < ${window.previousToExclusive.toISOString()} THEN 1 END)`,
        resolved: sql<number>`COUNT(CASE WHEN ${tickets.resolvedAt} >= ${window.previousFrom.toISOString()} AND ${tickets.resolvedAt} < ${window.previousToExclusive.toISOString()} THEN 1 END)`,
      })
      .from(tickets)
      .where(eq(tickets.orgId, orgId));

    // 2. Live Backlog Stats
    const liveCounts = await db
      .select({
        backlog: sql<number>`COUNT(CASE WHEN ${tickets.status} IN ('new', 'open', 'pending') THEN 1 END)`,
        unassigned: sql<number>`COUNT(CASE WHEN ${tickets.status} IN ('new', 'open', 'pending') AND ${tickets.assigneeId} IS NULL THEN 1 END)`,
        urgentHigh: sql<number>`COUNT(CASE WHEN ${tickets.status} IN ('new', 'open', 'pending') AND ${tickets.priority} IN ('urgent', 'high') THEN 1 END)`,
      })
      .from(tickets)
      .where(eq(tickets.orgId, orgId));

    // 3. Average Response and Resolution Speeds (aligned to cohort created in range)
    const avgResponse = await db
      .select({
        avgFrt: sql<number>`AVG(EXTRACT(EPOCH FROM (${tickets.firstRespondedAt} - ${tickets.createdAt})))`
      })
      .from(tickets)
      .where(
        and(
          eq(tickets.orgId, orgId),
          gte(tickets.createdAt, window.from),
          lt(tickets.createdAt, window.toExclusive),
          sql`${tickets.firstRespondedAt} IS NOT NULL`
        )
      );

    const prevAvgResponse = await db
      .select({
        avgFrt: sql<number>`AVG(EXTRACT(EPOCH FROM (${tickets.firstRespondedAt} - ${tickets.createdAt})))`
      })
      .from(tickets)
      .where(
        and(
          eq(tickets.orgId, orgId),
          gte(tickets.createdAt, window.previousFrom),
          lt(tickets.createdAt, window.previousToExclusive),
          sql`${tickets.firstRespondedAt} IS NOT NULL`
        )
      );

    const avgResolution = await db
      .select({
        avgArt: sql<number>`AVG(EXTRACT(EPOCH FROM (${tickets.resolvedAt} - ${tickets.createdAt})))`
      })
      .from(tickets)
      .where(
        and(
          eq(tickets.orgId, orgId),
          gte(tickets.createdAt, window.from),
          lt(tickets.createdAt, window.toExclusive),
          sql`${tickets.resolvedAt} IS NOT NULL`
        )
      );

    const prevAvgResolution = await db
      .select({
        avgArt: sql<number>`AVG(EXTRACT(EPOCH FROM (${tickets.resolvedAt} - ${tickets.createdAt})))`
      })
      .from(tickets)
      .where(
        and(
          eq(tickets.orgId, orgId),
          gte(tickets.createdAt, window.previousFrom),
          lt(tickets.createdAt, window.previousToExclusive),
          sql`${tickets.resolvedAt} IS NOT NULL`
        )
      );

    // 4. CSAT Satisfaction
    const csat = await db
      .select({
        avgCsat: sql<number>`AVG(${ticketFeedback.rating})`
      })
      .from(tickets)
      .innerJoin(ticketFeedback, eq(ticketFeedback.ticketId, tickets.id))
      .where(
        and(
          eq(tickets.orgId, orgId),
          gte(tickets.resolvedAt, window.from),
          lt(tickets.resolvedAt, window.toExclusive)
        )
      );

    const prevCsat = await db
      .select({
        avgCsat: sql<number>`AVG(${ticketFeedback.rating})`
      })
      .from(tickets)
      .innerJoin(ticketFeedback, eq(ticketFeedback.ticketId, tickets.id))
      .where(
        and(
          eq(tickets.orgId, orgId),
          gte(tickets.resolvedAt, window.previousFrom),
          lt(tickets.resolvedAt, window.previousToExclusive)
        )
      );

    // 5. SLA Met Rates (Current vs Previous)
    const slaResponseCurrent = await db
      .select({
        met: sql<number>`COUNT(CASE WHEN ${tickets.firstRespondedAt} <= ${tickets.slaResponseDueAt} THEN 1 END)`,
        total: sql<number>`COUNT(CASE WHEN ${tickets.firstRespondedAt} IS NOT NULL OR ${now.toISOString()} > ${tickets.slaResponseDueAt} THEN 1 END)`
      })
      .from(tickets)
      .where(
        and(
          eq(tickets.orgId, orgId),
          gte(tickets.createdAt, window.from),
          lt(tickets.createdAt, window.toExclusive),
          sql`${tickets.slaResponseDueAt} IS NOT NULL`
        )
      );

    const slaResponsePrevious = await db
      .select({
        met: sql<number>`COUNT(CASE WHEN ${tickets.firstRespondedAt} <= ${tickets.slaResponseDueAt} THEN 1 END)`,
        total: sql<number>`COUNT(CASE WHEN ${tickets.firstRespondedAt} IS NOT NULL OR ${window.from.toISOString()} > ${tickets.slaResponseDueAt} THEN 1 END)`
      })
      .from(tickets)
      .where(
        and(
          eq(tickets.orgId, orgId),
          gte(tickets.createdAt, window.previousFrom),
          lt(tickets.createdAt, window.previousToExclusive),
          sql`${tickets.slaResponseDueAt} IS NOT NULL`
        )
      );

    const slaResolutionCurrent = await db
      .select({
        met: sql<number>`COUNT(CASE WHEN ${tickets.resolvedAt} <= ${tickets.slaResolutionDueAt} THEN 1 END)`,
        total: sql<number>`COUNT(CASE WHEN ${tickets.resolvedAt} IS NOT NULL OR ${now.toISOString()} > ${tickets.slaResolutionDueAt} THEN 1 END)`
      })
      .from(tickets)
      .where(
        and(
          eq(tickets.orgId, orgId),
          gte(tickets.createdAt, window.from),
          lt(tickets.createdAt, window.toExclusive),
          sql`${tickets.slaResolutionDueAt} IS NOT NULL`
        )
      );

    const slaResolutionPrevious = await db
      .select({
        met: sql<number>`COUNT(CASE WHEN ${tickets.resolvedAt} <= ${tickets.slaResolutionDueAt} THEN 1 END)`,
        total: sql<number>`COUNT(CASE WHEN ${tickets.resolvedAt} IS NOT NULL OR ${window.from.toISOString()} > ${tickets.slaResolutionDueAt} THEN 1 END)`
      })
      .from(tickets)
      .where(
        and(
          eq(tickets.orgId, orgId),
          gte(tickets.createdAt, window.previousFrom),
          lt(tickets.createdAt, window.previousToExclusive),
          sql`${tickets.slaResolutionDueAt} IS NOT NULL`
        )
      );

    // Formulate card payloads
    const currentCreated = getNum(currentCounts[0]?.created);
    const previousCreated = getNum(previousCounts[0]?.created);
    const currentResolved = getNum(currentCounts[0]?.resolved);
    const previousResolved = getNum(previousCounts[0]?.resolved);

    const backlog = getNum(liveCounts[0]?.backlog);
    const unassigned = getNum(liveCounts[0]?.unassigned);
    const urgentHigh = getNum(liveCounts[0]?.urgentHigh);

    const currentFrt = getFrtHrs(avgResponse[0]?.avgFrt);
    const previousFrt = getFrtHrs(prevAvgResponse[0]?.avgFrt);
    const currentArt = getFrtHrs(avgResolution[0]?.avgArt);
    const previousArt = getFrtHrs(prevAvgResolution[0]?.avgArt);

    const currentCsat = csat[0]?.avgCsat ? round(Number(csat[0].avgCsat)) : null;
    const previousCsat = prevCsat[0]?.avgCsat ? round(Number(prevCsat[0].avgCsat)) : null;

    const responseSlaMetPct = round(percent(getNum(slaResponseCurrent[0]?.met), getNum(slaResponseCurrent[0]?.total)));
    const prevResponseSlaMetPct = round(percent(getNum(slaResponsePrevious[0]?.met), getNum(slaResponsePrevious[0]?.total)));

    const resolutionSlaMetPct = round(percent(getNum(slaResolutionCurrent[0]?.met), getNum(slaResolutionCurrent[0]?.total)));
    const prevResolutionSlaMetPct = round(percent(getNum(slaResolutionPrevious[0]?.met), getNum(slaResolutionPrevious[0]?.total)));

    const kpiSet = {
      totalCreated: currentCreated,
      totalResolved: currentResolved,
      openBacklog: backlog,
      unassignedOpen: unassigned,
      urgentHighOpen: urgentHigh,
      avgFirstResponseHours: currentFrt,
      avgResolutionHours: currentArt,
      responseSlaMetPct: responseSlaMetPct,
      resolutionSlaMetPct: resolutionSlaMetPct,
      avgCsat: currentCsat,
    };

    const previousSet = {
      totalCreated: previousCreated,
      totalResolved: previousResolved,
      openBacklog: backlog,
      unassignedOpen: unassigned,
      urgentHighOpen: urgentHigh,
      avgFirstResponseHours: previousFrt,
      avgResolutionHours: previousArt,
      responseSlaMetPct: prevResponseSlaMetPct,
      resolutionSlaMetPct: prevResolutionSlaMetPct,
      avgCsat: previousCsat,
    };

    // 6. Volume trends
    const createdTrend = await db
      .select({
        day: sql<string>`TO_CHAR(${tickets.createdAt}, 'YYYY-MM-DD')`,
        count: sql<number>`COUNT(*)`
      })
      .from(tickets)
      .where(
        and(
          eq(tickets.orgId, orgId),
          gte(tickets.createdAt, window.from),
          lt(tickets.createdAt, window.toExclusive)
        )
      )
      .groupBy(sql`TO_CHAR(${tickets.createdAt}, 'YYYY-MM-DD')`);

    const resolvedTrend = await db
      .select({
        day: sql<string>`TO_CHAR(${tickets.resolvedAt}, 'YYYY-MM-DD')`,
        count: sql<number>`COUNT(*)`
      })
      .from(tickets)
      .where(
        and(
          eq(tickets.orgId, orgId),
          gte(tickets.resolvedAt, window.from),
          lt(tickets.resolvedAt, window.toExclusive)
        )
      )
      .groupBy(sql`TO_CHAR(${tickets.resolvedAt}, 'YYYY-MM-DD')`);

    const breachedTrend = await db
      .select({
        day: sql<string>`TO_CHAR(${tickets.createdAt}, 'YYYY-MM-DD')`,
        count: sql<number>`COUNT(*)`
      })
      .from(tickets)
      .where(
        and(
          eq(tickets.orgId, orgId),
          eq(tickets.slaState, "breached"),
          gte(tickets.createdAt, window.from),
          lt(tickets.createdAt, window.toExclusive)
        )
      )
      .groupBy(sql`TO_CHAR(${tickets.createdAt}, 'YYYY-MM-DD')`);

    const createdMap = new Map(createdTrend.map((t) => [t.day, getNum(t.count)]));
    const resolvedMap = new Map(resolvedTrend.map((t) => [t.day, getNum(t.count)]));
    const breachedMap = new Map(breachedTrend.map((t) => [t.day, getNum(t.count)]));

    const trend: Array<{ date: string; created: number; resolved: number; breached: number }> = [];
    const cursor = new Date(window.from);
    while (cursor.getTime() < window.toExclusive.getTime()) {
      const key = dateKey(cursor);
      trend.push({
        date: key,
        created: createdMap.get(key) || 0,
        resolved: resolvedMap.get(key) || 0,
        breached: breachedMap.get(key) || 0,
      });
      cursor.setDate(cursor.getDate() + 1);
    }

    // 7. Grouped Chart breakdowns
    const statusBreakdown = await db
      .select({
        name: tickets.status,
        value: sql<number>`COUNT(*)`
      })
      .from(tickets)
      .where(
        and(
          eq(tickets.orgId, orgId),
          gte(tickets.createdAt, window.from),
          lt(tickets.createdAt, window.toExclusive)
        )
      )
      .groupBy(tickets.status);

    const priorityBreakdown = await db
      .select({
        name: tickets.priority,
        value: sql<number>`COUNT(*)`
      })
      .from(tickets)
      .where(
        and(
          eq(tickets.orgId, orgId),
          gte(tickets.createdAt, window.from),
          lt(tickets.createdAt, window.toExclusive)
        )
      )
      .groupBy(tickets.priority);

    const workstreamBreakdown = await db
      .select({
        name: tickets.workstream,
        value: sql<number>`COUNT(*)`
      })
      .from(tickets)
      .where(
        and(
          eq(tickets.orgId, orgId),
          gte(tickets.createdAt, window.from),
          lt(tickets.createdAt, window.toExclusive)
        )
      )
      .groupBy(tickets.workstream);

    const clientBreakdown = await db
      .select({
        name: clients.name,
        value: sql<number>`COUNT(*)`
      })
      .from(tickets)
      .innerJoin(clients, eq(tickets.clientId, clients.id))
      .where(
        and(
          eq(tickets.orgId, orgId),
          gte(tickets.createdAt, window.from),
          lt(tickets.createdAt, window.toExclusive)
        )
      )
      .groupBy(clients.name);

    return res.json({
      range: {
        from: window.from.toISOString().slice(0, 10),
        to: new Date(window.toExclusive.getTime() - 1).toISOString().slice(0, 10),
      },
      kpis: Object.entries(kpiSet).map(([key, value]) => ({
        key,
        value,
        deltaPct: delta(value, previousSet[key as keyof typeof previousSet]),
      })),
      trend,
      breakdowns: {
        status: statusBreakdown.map((b) => ({ name: b.name, value: getNum(b.value) })),
        priority: priorityBreakdown.map((b) => ({ name: b.name, value: getNum(b.value) })),
        workstream: workstreamBreakdown.map((b) => ({ name: b.name || "Unspecified", value: getNum(b.value) })),
        client: clientBreakdown.map((b) => ({ name: b.name, value: getNum(b.value) })),
      },
    });
  } catch (error) {
    console.error("Reports overview failed:", error);
    return res.status(500).json({ error: "Failed to retrieve overview report" });
  }
});

/**
 * GET /api/reports/sla
 * 
 * Compiles real-time SLA warning/breach volumes and historical compliance rates.
 * Restricts query by tenant context and date bounds. Uses SQL aggregates.
 */
router.get("/sla", async (req: Request, res: Response) => {
  try {
    const window = parseDateWindow(req);
    const orgId = req.user!.orgId;
    const now = new Date();
    const nextTwoHours = new Date(now.getTime() + 2 * 60 * 60 * 1000);
    const tomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);

    const getNum = (val: any) => Number(val || 0);

    // 1. Live warning/breach counts
    const liveCounts = await db
      .select({
        atRisk: sql<number>`COUNT(CASE WHEN ${tickets.slaState} = 'at-risk' THEN 1 END)`,
        breached: sql<number>`COUNT(CASE WHEN ${tickets.slaState} = 'breached' THEN 1 END)`,
        dueInTwoHours: sql<number>`COUNT(CASE WHEN ${tickets.slaResolutionDueAt} >= ${now.toISOString()} AND ${tickets.slaResolutionDueAt} <= ${nextTwoHours.toISOString()} THEN 1 END)`,
        dueToday: sql<number>`COUNT(CASE WHEN ${tickets.slaResolutionDueAt} >= ${now.toISOString()} AND ${tickets.slaResolutionDueAt} < ${tomorrow.toISOString()} THEN 1 END)`,
      })
      .from(tickets)
      .where(
        and(
          eq(tickets.orgId, orgId),
          inArray(tickets.status, ["new", "open", "pending"])
        )
      );

    // 2. Historical SLA met/missed
    const responseSla = await db
      .select({
        met: sql<number>`COUNT(CASE WHEN ${tickets.firstRespondedAt} <= ${tickets.slaResponseDueAt} THEN 1 END)`,
        missed: sql<number>`COUNT(CASE WHEN ${tickets.firstRespondedAt} > ${tickets.slaResponseDueAt} OR (${tickets.firstRespondedAt} IS NULL AND ${now.toISOString()} > ${tickets.slaResponseDueAt}) THEN 1 END)`
      })
      .from(tickets)
      .where(
        and(
          eq(tickets.orgId, orgId),
          gte(tickets.createdAt, window.from),
          lt(tickets.createdAt, window.toExclusive),
          sql`${tickets.slaResponseDueAt} IS NOT NULL`
        )
      );

    const resolutionSla = await db
      .select({
        met: sql<number>`COUNT(CASE WHEN ${tickets.resolvedAt} <= ${tickets.slaResolutionDueAt} THEN 1 END)`,
        missed: sql<number>`COUNT(CASE WHEN ${tickets.resolvedAt} > ${tickets.slaResolutionDueAt} OR (${tickets.resolvedAt} IS NULL AND ${now.toISOString()} > ${tickets.slaResolutionDueAt}) THEN 1 END)`
      })
      .from(tickets)
      .where(
        and(
          eq(tickets.orgId, orgId),
          gte(tickets.createdAt, window.from),
          lt(tickets.createdAt, window.toExclusive),
          sql`${tickets.slaResolutionDueAt} IS NOT NULL`
        )
      );

    // 3. Breach trends (daily counts of SLA breaches occurred in range)
    const breachTrendQuery = await db
      .select({
        day: sql<string>`TO_CHAR(${tickets.createdAt}, 'YYYY-MM-DD')`,
        count: sql<number>`COUNT(*)`
      })
      .from(tickets)
      .where(
        and(
          eq(tickets.orgId, orgId),
          eq(tickets.slaState, "breached"),
          gte(tickets.createdAt, window.from),
          lt(tickets.createdAt, window.toExclusive)
        )
      )
      .groupBy(sql`TO_CHAR(${tickets.createdAt}, 'YYYY-MM-DD')`);

    const breachTrendMap = new Map(breachTrendQuery.map((t) => [t.day, getNum(t.count)]));
    const breachTrend: Array<{ date: string; breached: number }> = [];
    const cursor = new Date(window.from);
    while (cursor.getTime() < window.toExclusive.getTime()) {
      const key = dateKey(cursor);
      breachTrend.push({
        date: key,
        breached: breachTrendMap.get(key) || 0,
      });
      cursor.setDate(cursor.getDate() + 1);
    }

    // 4. Breach breakdowns
    const breachByPriority = await db
      .select({
        name: tickets.priority,
        value: sql<number>`COUNT(*)`
      })
      .from(tickets)
      .where(
        and(
          eq(tickets.orgId, orgId),
          eq(tickets.slaState, "breached"),
          gte(tickets.createdAt, window.from),
          lt(tickets.createdAt, window.toExclusive)
        )
      )
      .groupBy(tickets.priority);

    const breachByClient = await db
      .select({
        name: clients.name,
        value: sql<number>`COUNT(*)`
      })
      .from(tickets)
      .innerJoin(clients, eq(tickets.clientId, clients.id))
      .where(
        and(
          eq(tickets.orgId, orgId),
          eq(tickets.slaState, "breached"),
          gte(tickets.createdAt, window.from),
          lt(tickets.createdAt, window.toExclusive)
        )
      )
      .groupBy(clients.name)
      .orderBy(desc(sql`COUNT(*)`))
      .limit(8);

    const breachByTeam = await db
      .select({
        name: teams.name,
        value: sql<number>`COUNT(*)`
      })
      .from(tickets)
      .innerJoin(teams, eq(tickets.teamId, teams.id))
      .where(
        and(
          eq(tickets.orgId, orgId),
          eq(tickets.slaState, "breached"),
          gte(tickets.createdAt, window.from),
          lt(tickets.createdAt, window.toExclusive)
        )
      )
      .groupBy(teams.name)
      .orderBy(desc(sql`COUNT(*)`))
      .limit(8);

    // 5. Due soon list (limit 8, returns select rows)
    const dueSoon = await db
      .select({
        id: tickets.id,
        code: tickets.code,
        subject: tickets.subject,
        status: tickets.status,
        priority: tickets.priority,
        workstream: tickets.workstream,
        clientName: clients.name,
        assigneeFirstName: users.firstName,
        assigneeLastName: users.lastName,
        teamName: teams.name,
        slaState: tickets.slaState,
        createdAt: tickets.createdAt,
        firstRespondedAt: tickets.firstRespondedAt,
        resolvedAt: tickets.resolvedAt,
        slaResponseDueAt: tickets.slaResponseDueAt,
        slaResolutionDueAt: tickets.slaResolutionDueAt,
      })
      .from(tickets)
      .leftJoin(clients, eq(tickets.clientId, clients.id))
      .leftJoin(users, eq(tickets.assigneeId, users.id))
      .leftJoin(teams, eq(tickets.teamId, teams.id))
      .where(
        and(
          eq(tickets.orgId, orgId),
          inArray(tickets.status, ["new", "open", "pending"]),
          sql`${tickets.slaResolutionDueAt} >= ${now.toISOString()}`
        )
      )
      .orderBy(asc(tickets.slaResolutionDueAt))
      .limit(8);

    return res.json({
      live: {
        atRisk: getNum(liveCounts[0]?.atRisk),
        breached: getNum(liveCounts[0]?.breached),
        dueInTwoHours: getNum(liveCounts[0]?.dueInTwoHours),
        dueToday: getNum(liveCounts[0]?.dueToday),
      },
      historical: {
        responseMet: getNum(responseSla[0]?.met),
        responseMissed: getNum(responseSla[0]?.missed),
        resolutionMet: getNum(resolutionSla[0]?.met),
        resolutionMissed: getNum(resolutionSla[0]?.missed),
        breachTrend,
        breachByPriority: breachByPriority.map((b) => ({ name: b.name, value: getNum(b.value) })),
        breachByClient: breachByClient.map((b) => ({ name: b.name, value: getNum(b.value) })),
        breachByTeam: breachByTeam.map((b) => ({ name: b.name, value: getNum(b.value) })),
      },
      dueSoon: dueSoon.map((row) => ({
        id: row.id,
        code: row.code,
        subject: row.subject,
        status: row.status,
        priority: row.priority,
        workstream: row.workstream,
        clientName: row.clientName,
        assigneeName: row.assigneeFirstName ? `${row.assigneeFirstName} ${row.assigneeLastName || ""}`.trim() : null,
        teamName: row.teamName,
        slaState: row.slaState,
        createdAt: row.createdAt,
        firstRespondedAt: row.firstRespondedAt,
        resolvedAt: row.resolvedAt,
        slaResponseDueAt: row.slaResponseDueAt,
        slaResolutionDueAt: row.slaResolutionDueAt,
      })),
    });
  } catch (error) {
    console.error("Reports SLA failed:", error);
    return res.status(500).json({ error: "Failed to retrieve SLA report" });
  }
});

/**
 * GET /api/reports/agents
 * 
 * Returns workload distributions, speed, and customer feedback ratings per staff member.
 * Restricts query by tenant context and date bounds. Uses SQL grouped aggregates.
 */
router.get("/agents", async (req: Request, res: Response) => {
  try {
    const window = parseDateWindow(req);
    const orgId = req.user!.orgId;

    const staff = await db
      .select({
        id: users.id,
        firstName: users.firstName,
        lastName: users.lastName,
        email: users.email,
        role: users.role,
        initials: users.initials,
      })
      .from(users)
      .where(
        and(
          eq(users.orgId, orgId),
          eq(users.isActive, true),
          or(eq(users.role, "admin"), eq(users.role, "agent"))
        )
      )
      .orderBy(users.firstName, users.lastName);

    const agentStats = await db
      .select({
        assigneeId: tickets.assigneeId,
        assignedOpen: sql<number>`COUNT(CASE WHEN ${tickets.status} IN ('new', 'open', 'pending') THEN 1 END)`,
        resolved: sql<number>`COUNT(CASE WHEN ${tickets.resolvedAt} >= ${window.from.toISOString()} AND ${tickets.resolvedAt} < ${window.toExclusive.toISOString()} THEN 1 END)`,
        breached: sql<number>`COUNT(CASE WHEN ${tickets.status} IN ('new', 'open', 'pending') AND ${tickets.slaState} = 'breached' THEN 1 END)`,
        avgFrt: sql<number>`AVG(CASE WHEN ${tickets.firstRespondedAt} >= ${window.from.toISOString()} AND ${tickets.firstRespondedAt} < ${window.toExclusive.toISOString()} THEN EXTRACT(EPOCH FROM (${tickets.firstRespondedAt} - ${tickets.createdAt})) END)`,
        avgArt: sql<number>`AVG(CASE WHEN ${tickets.resolvedAt} >= ${window.from.toISOString()} AND ${tickets.resolvedAt} < ${window.toExclusive.toISOString()} THEN EXTRACT(EPOCH FROM (${tickets.resolvedAt} - ${tickets.createdAt})) END)`,
        avgCsat: sql<number>`AVG(CASE WHEN ${tickets.resolvedAt} >= ${window.from.toISOString()} AND ${tickets.resolvedAt} < ${window.toExclusive.toISOString()} THEN ${ticketFeedback.rating} END)`,
        csatCount: sql<number>`COUNT(CASE WHEN ${tickets.resolvedAt} >= ${window.from.toISOString()} AND ${tickets.resolvedAt} < ${window.toExclusive.toISOString()} AND ${ticketFeedback.rating} IS NOT NULL THEN 1 END)`,
      })
      .from(tickets)
      .leftJoin(ticketFeedback, eq(ticketFeedback.ticketId, tickets.id))
      .where(eq(tickets.orgId, orgId))
      .groupBy(tickets.assigneeId);

    const statsMap = new Map(agentStats.map((s) => [s.assigneeId, s]));

    return res.json(
      staff.map((agent) => {
        const stats = statsMap.get(agent.id) || {
          assignedOpen: 0,
          resolved: 0,
          breached: 0,
          avgFrt: null,
          avgArt: null,
          avgCsat: null,
          csatCount: 0,
        };
        return {
          id: agent.id,
          firstName: agent.firstName,
          lastName: agent.lastName,
          email: agent.email,
          role: agent.role,
          initials: agent.initials,
          assignedOpenTickets: Number(stats.assignedOpen || 0),
          resolvedTickets: Number(stats.resolved || 0),
          avgFirstResponseHours: stats.avgFrt ? round(Number(stats.avgFrt) / 3600) : null,
          avgResolutionHours: stats.avgArt ? round(Number(stats.avgArt) / 3600) : null,
          breachedAssignedTickets: Number(stats.breached || 0),
          csatAverage: stats.avgCsat ? round(Number(stats.avgCsat)) : null,
          csatCount: Number(stats.csatCount || 0),
        };
      })
    );
  } catch (error) {
    console.error("Reports agents failed:", error);
    return res.status(500).json({ error: "Failed to retrieve agent report" });
  }
});

/**
 * GET /api/reports/drilldown
 * 
 * Lists detailed ticket records matching a specific dashboard widget or metrics segment.
 * Supports returning JSON format or exporting raw data as a downloadable CSV.
 */
router.get("/drilldown", async (req: Request, res: Response) => {
  try {
    const window = parseDateWindow(req);
    const now = new Date();
    const type = typeof req.query.type === "string" ? req.query.type : "created";
    const format = typeof req.query.format === "string" ? req.query.format : "json";

    const conditions = [eq(tickets.orgId, req.user!.orgId)];

    if (type === "created") {
      conditions.push(gte(tickets.createdAt, window.from), lt(tickets.createdAt, window.toExclusive));
    } else if (type === "resolved") {
      conditions.push(gte(tickets.resolvedAt, window.from), lt(tickets.resolvedAt, window.toExclusive));
    } else if (type === "open_backlog") {
      conditions.push(inArray(tickets.status, ["new", "open", "pending"]));
    } else if (type === "unassigned") {
      conditions.push(inArray(tickets.status, ["new", "open", "pending"]), sql`${tickets.assigneeId} IS NULL`);
    } else if (type === "at_risk") {
      conditions.push(inArray(tickets.status, ["new", "open", "pending"]), eq(tickets.slaState, "at-risk"));
    } else if (type === "breached") {
      conditions.push(inArray(tickets.status, ["new", "open", "pending"]), eq(tickets.slaState, "breached"));
    } else if (type === "sla_response_missed") {
      conditions.push(
        gte(tickets.createdAt, window.from),
        lt(tickets.createdAt, window.toExclusive),
        sql`${tickets.slaResponseDueAt} IS NOT NULL`,
        or(
          sql`${tickets.firstRespondedAt} > ${tickets.slaResponseDueAt}`,
          and(sql`${tickets.firstRespondedAt} IS NULL`, sql`${now.toISOString()} > ${tickets.slaResponseDueAt}`)
        ) as any
      );
    } else if (type === "sla_resolution_missed") {
      conditions.push(
        gte(tickets.createdAt, window.from),
        lt(tickets.createdAt, window.toExclusive),
        sql`${tickets.slaResolutionDueAt} IS NOT NULL`,
        or(
          sql`${tickets.resolvedAt} > ${tickets.slaResolutionDueAt}`,
          and(sql`${tickets.resolvedAt} IS NULL`, sql`${now.toISOString()} > ${tickets.slaResolutionDueAt}`)
        ) as any
      );
    } else if (type === "urgent_high") {
      conditions.push(inArray(tickets.status, ["new", "open", "pending"]), inArray(tickets.priority, ["urgent", "high"]));
    }

    const rows = await db
      .select({
        id: tickets.id,
        code: tickets.code,
        subject: tickets.subject,
        status: tickets.status,
        priority: tickets.priority,
        workstream: tickets.workstream,
        clientId: tickets.clientId,
        assigneeId: tickets.assigneeId,
        teamId: tickets.teamId,
        slaState: tickets.slaState,
        slaResponseDueAt: tickets.slaResponseDueAt,
        slaResolutionDueAt: tickets.slaResolutionDueAt,
        firstRespondedAt: tickets.firstRespondedAt,
        resolvedAt: tickets.resolvedAt,
        createdAt: tickets.createdAt,
        updatedAt: tickets.updatedAt,
        clientName: clients.name,
        assigneeFirstName: users.firstName,
        assigneeLastName: users.lastName,
        teamName: teams.name,
      })
      .from(tickets)
      .leftJoin(clients, eq(tickets.clientId, clients.id))
      .leftJoin(users, eq(tickets.assigneeId, users.id))
      .leftJoin(teams, eq(tickets.teamId, teams.id))
      .where(and(...conditions))
      .orderBy(desc(tickets.createdAt));

    const result = rows.map((row) => ({
      id: row.id,
      code: row.code,
      subject: row.subject,
      status: row.status,
      priority: row.priority,
      workstream: row.workstream,
      clientName: row.clientName,
      assigneeName: row.assigneeFirstName ? `${row.assigneeFirstName} ${row.assigneeLastName || ""}`.trim() : null,
      teamName: row.teamName,
      slaState: row.slaState,
      createdAt: row.createdAt,
      firstRespondedAt: row.firstRespondedAt,
      resolvedAt: row.resolvedAt,
      slaResponseDueAt: row.slaResponseDueAt,
      slaResolutionDueAt: row.slaResolutionDueAt,
    }));

    if (format === "csv") {
      const headers = [
        "Code",
        "Subject",
        "Status",
        "Priority",
        "Client",
        "Assignee",
        "Team",
        "SLA State",
        "Created At",
        "First Responded At",
        "Resolved At",
      ];
      const values = result.map((row) => [
        row.code,
        row.subject,
        row.status,
        row.priority,
        row.clientName || "",
        row.assigneeName || "",
        row.teamName || "",
        row.slaState,
        row.createdAt?.toISOString() || "",
        row.firstRespondedAt?.toISOString() || "",
        row.resolvedAt?.toISOString() || "",
      ]);
      const csvContent = [headers, ...values]
        .map((cells) => cells.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","))
        .join("\n");

      res.setHeader("Content-Type", "text/csv");
      res.setHeader("Content-Disposition", `attachment; filename="supportdesk-${type}-report.csv"`);
      return res.send(csvContent);
    }

    return res.json({ type, rows: result });
  } catch (error) {
    console.error("Reports drilldown failed:", error);
    return res.status(500).json({ error: "Failed to retrieve drill-down report" });
  }
});

export default router;
