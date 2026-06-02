import { db } from "../db/connection";
import { tickets, ticketAssignmentRules, agentTeamMapping, users, ticketAuditLogs } from "../schema";
import { eq, and, or, sql, notInArray, inArray } from "drizzle-orm";

/**
 * Interface representing active ticket counts per agent.
 */
interface AgentWorkload {
  agentId: string;
  activeCount: number;
}

/**
 * Calculates the next assignee for a support team using a workload-balanced Round-Robin algorithm.
 * Selects the agent belonging to the team who currently has the fewest active (unresolved/unclosed) tickets.
 * 
 * @param teamId The unique UUID of the target support team
 * @returns The UUID of the selected agent, or null if no agents are mapped to the team
 */
async function getRoundRobinAssignee(teamId: string): Promise<string | null> {
  try {
    // 1. Fetch all agents mapped to the specified support team
    const teamMembers = await db
      .select({
        agentId: agentTeamMapping.agentId,
      })
      .from(agentTeamMapping)
      .innerJoin(users, eq(agentTeamMapping.agentId, users.id))
      .where(
        and(
          eq(agentTeamMapping.teamId, teamId),
          eq(users.isActive, true) // Only assign to active staff
        )
      );

    if (teamMembers.length === 0) {
      return null;
    }

    const agentIds = teamMembers.map((m) => m.agentId);

    // 2. Query workload (count of active tickets where status is not 'resolved' or 'closed')
    const activeWorkloads = await db
      .select({
        agentId: tickets.assigneeId,
        activeCount: sql<number>`count(${tickets.id})`.mapWith(Number),
      })
      .from(tickets)
      .where(
        and(
          inArray(tickets.assigneeId, agentIds),
          notInArray(tickets.status, ["resolved", "closed"])
        )
      )
      .groupBy(tickets.assigneeId);

    // Map workloads into a lookup dictionary
    const workloadMap = new Map<string, number>();
    for (const workload of activeWorkloads) {
      if (workload.agentId) {
        workloadMap.set(workload.agentId, workload.activeCount);
      }
    }

    // 3. Find the agent with the minimum active ticket workload
    let selectedAgentId = agentIds[0];
    let minTickets = workloadMap.get(selectedAgentId) || 0;

    for (const agentId of agentIds) {
      const activeCount = workloadMap.get(agentId) || 0;
      if (activeCount < minTickets) {
        minTickets = activeCount;
        selectedAgentId = agentId;
      }
    }

    return selectedAgentId;
  } catch (error) {
    console.error("Round robin assignee calculation failed:", error);
    return null;
  }
}

/**
 * Processes and routes an incoming ticket through the automated routing engine.
 * Sequentially evaluates the ticket against configured assignment rules ordered by priorityOrder.
 * Once a match is found:
 * 1. Resolves the target assignee (Direct or Round-Robin workload-balanced).
 * 2. Updates the ticket assignee and team references.
 * 3. Records an audit log entry documenting the automated rule match.
 * 
 * @param ticketId The unique UUID of the ticket to be routed
 */
export async function routeTicket(ticketId: string): Promise<void> {
  try {
    // 1. Fetch ticket metadata
    const [ticket] = await db
      .select()
      .from(tickets)
      .where(eq(tickets.id, ticketId))
      .limit(1);

    if (!ticket) {
      console.warn(`Routing engine: Ticket ${ticketId} not found.`);
      return;
    }

    // 2. Fetch all active routing rules for this organization
    const activeRules = await db
      .select()
      .from(ticketAssignmentRules)
      .where(
        and(
          eq(ticketAssignmentRules.orgId, ticket.orgId),
          eq(ticketAssignmentRules.isActive, true)
        )
      )
      .orderBy(ticketAssignmentRules.priorityOrder);

    // 3. Sequentially evaluate rules
    for (const rule of activeRules) {
      let isMatch = false;

      if (rule.criteriaField === "priority") {
        isMatch = ticket.priority === rule.criteriaValue;
      } else if (rule.criteriaField === "category") {
        isMatch = ticket.workstream === rule.criteriaValue;
      } else if (rule.criteriaField === "client") {
        isMatch = ticket.clientId === rule.criteriaValue;
      }

      if (isMatch) {
        let finalAssigneeId = rule.targetAgentId;
        const finalTeamId = rule.targetTeamId;

        // Resolve Round-Robin assignee if mode is active and target team is set
        if (rule.assignmentMode === "round-robin" && finalTeamId) {
          const rrAgentId = await getRoundRobinAssignee(finalTeamId);
          if (rrAgentId) {
            finalAssigneeId = rrAgentId;
          }
        }

        // Apply ticket updates in database
        await db
          .update(tickets)
          .set({
            teamId: finalTeamId || ticket.teamId,
            assigneeId: finalAssigneeId || ticket.assigneeId,
            updatedAt: new Date(),
          })
          .where(eq(tickets.id, ticketId));

        // Insert automatic routing audit log
        await db.insert(ticketAuditLogs).values({
          ticketId,
          actorId: null, // null represents system automatic agent action
          action: "auto_assignment",
          previousValue: JSON.stringify({ teamId: ticket.teamId, assigneeId: ticket.assigneeId }),
          newValue: JSON.stringify({
            teamId: finalTeamId,
            assigneeId: finalAssigneeId,
            ruleId: rule.id,
            ruleName: rule.name,
          }),
        });

        console.log(`🚀 Routing engine: Ticket ${ticketId} successfully routed via rule '${rule.name}' to team: ${finalTeamId}, assignee: ${finalAssigneeId}`);
        break; // Match found and applied: exit rule evaluation loop
      }
    }
  } catch (error) {
    console.error(`Routing engine failed for ticket ${ticketId}:`, error);
  }
}
