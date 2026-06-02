import { db } from "../db/connection";
import { tickets, slaPolicies, slaTargets, users, ticketAuditLogs, jobs, inAppNotifications } from "../schema";
import { eq, and, notInArray } from "drizzle-orm";
import { calculateDeadline } from "./sla";
import { getTenantUrlByOrgId } from "./url";

/**
 * Checks all unresolved tickets for SLA warning or breach.
 * Updates their state and queues notification jobs if state changes.
 */
export async function checkSLAs() {
  console.log("⏱️ [SLA Monitor] Running periodic check...");
  try {
    const unresolvedTickets = await db
      .select({
        id: tickets.id,
        code: tickets.code,
        subject: tickets.subject,
        orgId: tickets.orgId,
        priority: tickets.priority,
        status: tickets.status,
        slaPolicyId: tickets.slaPolicyId,
        slaState: tickets.slaState,
        slaResponseDueAt: tickets.slaResponseDueAt,
        slaResolutionDueAt: tickets.slaResolutionDueAt,
        firstRespondedAt: tickets.firstRespondedAt,
        resolvedAt: tickets.resolvedAt,
        createdAt: tickets.createdAt,
        assigneeId: tickets.assigneeId,
      })
      .from(tickets)
      .where(notInArray(tickets.status, ["resolved", "closed"]));

    const now = new Date();

    for (const ticket of unresolvedTickets) {
      if (!ticket.slaPolicyId) continue;

      // 1. Fetch policy details
      const [policy] = await db
        .select()
        .from(slaPolicies)
        .where(eq(slaPolicies.id, ticket.slaPolicyId))
        .limit(1);

      if (!policy) continue;

      // 2. Fetch targets for this policy and ticket's priority
      const [target] = await db
        .select()
        .from(slaTargets)
        .where(
          and(
            eq(slaTargets.slaPolicyId, policy.id),
            eq(slaTargets.priority, ticket.priority)
          )
        )
        .limit(1);

      if (!target) continue;

      const businessDays = policy.businessDays && policy.businessDays.length > 0
        ? policy.businessDays
        : ["1", "2", "3", "4", "5"];
      const startStr = policy.businessHoursStart || "09:00:00";
      const endStr = policy.businessHoursEnd || "18:00:00";

      if (!ticket.createdAt) continue;

      // Calculate escalation (at-risk) due date from createdAt using escalateAfterHours
      const escalateDueAt = calculateDeadline(
        ticket.createdAt,
        target.escalateAfterHours,
        businessDays,
        startStr,
        endStr
      );

      let computedState: "on-track" | "at-risk" | "breached" = "on-track";

      // 3. Determine if breached
      const isResponseBreached = !ticket.firstRespondedAt && ticket.slaResponseDueAt && now.getTime() >= new Date(ticket.slaResponseDueAt).getTime();
      const isResolutionBreached = !ticket.resolvedAt && ticket.slaResolutionDueAt && now.getTime() >= new Date(ticket.slaResolutionDueAt).getTime();

      if (isResponseBreached || isResolutionBreached) {
        computedState = "breached";
      } else if (now.getTime() >= escalateDueAt.getTime()) {
        computedState = "at-risk";
      }

      // If state has progressed (we only transition forwards: on-track -> at-risk -> breached)
      let stateChanged = false;
      if (ticket.slaState === "on-track" && (computedState === "at-risk" || computedState === "breached")) {
        stateChanged = true;
      } else if (ticket.slaState === "at-risk" && computedState === "breached") {
        stateChanged = true;
      }

      if (stateChanged) {
        console.log(`⏱️ [SLA Monitor] Ticket #${ticket.code} transitioning from ${ticket.slaState} to ${computedState}`);

        // Update database
        await db
          .update(tickets)
          .set({
            slaState: computedState,
            updatedAt: now,
          })
          .where(eq(tickets.id, ticket.id));

        // Create audit log
        await db.insert(ticketAuditLogs).values({
          ticketId: ticket.id,
          action: "sla_state_change",
          previousValue: ticket.slaState,
          newValue: computedState,
          createdAt: now,
        });

        // Trigger notifications
        const title = computedState === "breached"
          ? `🔴 Ticket #${ticket.code} BREACHED SLA`
          : `⚠️ Ticket #${ticket.code} is AT-RISK of SLA Breach`;

        const message = computedState === "breached"
          ? `Ticket #${ticket.code} ("${ticket.subject}") has breached its SLA targets.`
          : `Ticket #${ticket.code} ("${ticket.subject}") has passed its warning threshold and requires attention.`;

        const tenantBaseUrl = await getTenantUrlByOrgId(ticket.orgId);

        // Determine user IDs to notify
        const userIdsToNotify: string[] = [];
        if (ticket.assigneeId) {
          userIdsToNotify.push(ticket.assigneeId);
        }

        // Always notify organization admins
        const orgAdmins = await db
          .select({ id: users.id })
          .from(users)
          .where(
            and(
              eq(users.orgId, ticket.orgId),
              eq(users.role, "admin")
            )
          );
        
        for (const admin of orgAdmins) {
          if (!userIdsToNotify.includes(admin.id)) {
            userIdsToNotify.push(admin.id);
          }
        }

        // Queue in-app notifications
        for (const userId of userIdsToNotify) {
          await db.insert(inAppNotifications).values({
            orgId: ticket.orgId,
            userId,
            title,
            message,
            ticketId: ticket.id,
            isRead: false,
          });
        }

        // Queue email jobs for assignee / admins
        const notifyUsers = await db
          .select({ email: users.email })
          .from(users)
          .where(
            and(
              eq(users.orgId, ticket.orgId),
              eq(users.role, "admin")
            )
          );

        const emailAddresses = notifyUsers.map(u => u.email);
        if (ticket.assigneeId) {
          const [assigneeUser] = await db
            .select({ email: users.email })
            .from(users)
            .where(eq(users.id, ticket.assigneeId))
            .limit(1);
          if (assigneeUser && !emailAddresses.includes(assigneeUser.email)) {
            emailAddresses.push(assigneeUser.email);
          }
        }

        for (const email of emailAddresses) {
          await db.insert(jobs).values({
            queueName: "email",
            payload: JSON.stringify({
              orgId: ticket.orgId,
              to: email,
              subject: title,
              html: `
                <div style="font-family: sans-serif; padding: 20px;">
                  <h2>${title}</h2>
                  <p>${message}</p>
                  <p><strong>Priority:</strong> ${ticket.priority}</p>
                  <p><strong>Status:</strong> ${ticket.status}</p>
                  <br/>
                  <a href="${tenantBaseUrl}/inbox?ticket=${ticket.id}" style="padding: 10px 15px; background: #ef4444; color: white; text-decoration: none; border-radius: 5px;">View Ticket</a>
                </div>
              `
            }),
            status: "pending",
          });
        }

        // Queue Slack job
        await db.insert(jobs).values({
          queueName: "slack",
          payload: JSON.stringify({
            orgId: ticket.orgId,
            text: `*${title}*\n${message}\nPriority: _${ticket.priority}_\nStatus: _${ticket.status}_\n<${tenantBaseUrl}/inbox?ticket=${ticket.id}|View Ticket>`
          }),
          status: "pending",
        });
      }
    }
  } catch (error) {
    console.error("❌ [SLA Monitor] Error running SLA check:", error);
  }
}
