import { and, eq, sql } from "drizzle-orm";
import { db } from "../db/connection";
import {
  clients,
  organizations,
  slaPolicies,
  slaTargets,
  ticketAttachments,
  ticketAuditLogs,
  tickets,
} from "../schema";
import { calculateDeadline } from "../utils/sla";
import { routeTicket } from "../utils/routing";
import { alertOrgAdmins, queueNotification } from "../utils/notifications";

export type TicketAttachmentInput = {
  fileName: string;
  fileSize?: number;
  filePath: string;
  mimeType?: string;
};

type CreateTicketInput = {
  orgId: string;
  requesterId: string;
  clientId: string;
  subject: string;
  description: string;
  priority: "low" | "normal" | "high" | "urgent";
  workstream?: string | null;
  teamId?: string | null;
  attachments?: TicketAttachmentInput[];
  actorId?: string | null;
  source?: "portal" | "email" | "api";
  skipNotifications?: boolean;
};

function validateAttachmentPaths(orgId: string, attachments?: TicketAttachmentInput[]) {
  if (!attachments) return;

  for (const att of attachments) {
    if (!att.fileName || !att.filePath) {
      throw new Error("Invalid attachment metadata structure");
    }

    const isLocalMatch = att.filePath.startsWith(`/uploads/${orgId}/attachments/`);
    const isS3Match = att.filePath.includes(`/${orgId}/attachments/`);
    if (!isLocalMatch && !isS3Match) {
      throw new Error(`Unauthorized path for file attachment: ${att.fileName}`);
    }
  }
}

export async function createSupportTicket(input: CreateTicketInput) {
  validateAttachmentPaths(input.orgId, input.attachments);

  const [clientObj] = await db
    .select()
    .from(clients)
    .where(
      and(
        eq(clients.id, input.clientId),
        eq(clients.orgId, input.orgId)
      )
    )
    .limit(1);

  if (!clientObj) {
    const error = new Error("Client company not found");
    (error as any).statusCode = 404;
    throw error;
  }

  let policyId = clientObj.slaPolicyId;
  let policyObj = null;

  if (policyId) {
    [policyObj] = await db
      .select()
      .from(slaPolicies)
      .where(
        and(
          eq(slaPolicies.id, policyId),
          eq(slaPolicies.orgId, input.orgId)
        )
      )
      .limit(1);
  }

  if (!policyObj) {
    [policyObj] = await db
      .select()
      .from(slaPolicies)
      .where(
        and(
          eq(slaPolicies.orgId, input.orgId),
          eq(slaPolicies.isDefault, true)
        )
      )
      .limit(1);
  }

  let slaResponseDueAt: Date | null = null;
  let slaResolutionDueAt: Date | null = null;

  if (policyObj) {
    const [targetObj] = await db
      .select()
      .from(slaTargets)
      .where(
        and(
          eq(slaTargets.slaPolicyId, policyObj.id),
          eq(slaTargets.priority, input.priority)
        )
      )
      .limit(1);

    if (targetObj) {
      const now = new Date();
      const businessDays = policyObj.businessDays && policyObj.businessDays.length > 0
        ? policyObj.businessDays
        : ["1", "2", "3", "4", "5"];
      const startStr = policyObj.businessHoursStart || "09:00:00";
      const endStr = policyObj.businessHoursEnd || "18:00:00";

      slaResponseDueAt = calculateDeadline(now, targetObj.responseTimeHours, businessDays, startStr, endStr);
      slaResolutionDueAt = calculateDeadline(now, targetObj.resolutionTimeHours, businessDays, startStr, endStr);
    }
  }

  const newTicket = await db.transaction(async (tx) => {
    const [org] = await tx
      .update(organizations)
      .set({ ticketCounter: sql`${organizations.ticketCounter} + 1` })
      .where(eq(organizations.id, input.orgId))
      .returning({ newCode: organizations.ticketCounter });

    const [ticketRecord] = await tx
      .insert(tickets)
      .values({
        orgId: input.orgId,
        code: org.newCode,
        subject: input.subject,
        description: input.description,
        status: "new",
        priority: input.priority,
        workstream: input.workstream || null,
        clientId: input.clientId,
        requesterId: input.requesterId,
        teamId: input.teamId || null,
        slaPolicyId: policyObj?.id || null,
        slaState: "on-track",
        slaResponseDueAt,
        slaResolutionDueAt,
      })
      .returning();

    if (input.attachments && input.attachments.length > 0) {
      for (const att of input.attachments) {
        await tx.insert(ticketAttachments).values({
          ticketId: ticketRecord.id,
          messageId: null,
          fileName: att.fileName,
          fileSize: att.fileSize || 0,
          filePath: att.filePath,
          mimeType: att.mimeType,
        });
      }
    }

    return ticketRecord;
  });

  await routeTicket(newTicket.id);

  await db.insert(ticketAuditLogs).values({
    ticketId: newTicket.id,
    actorId: input.actorId || null,
    action: input.source === "email" ? "email_ticket_created" : "create",
    newValue: JSON.stringify({
      subject: input.subject,
      priority: input.priority,
      workstream: input.workstream,
      clientId: input.clientId,
      slaPolicyId: policyObj?.id || null,
      source: input.source || "api",
    }),
  });

  const [routedTicket] = await db
    .select({
      id: tickets.id,
      code: tickets.code,
      subject: tickets.subject,
      description: tickets.description,
      status: tickets.status,
      priority: tickets.priority,
      workstream: tickets.workstream,
      clientId: tickets.clientId,
      assigneeId: tickets.assigneeId,
      teamId: tickets.teamId,
      slaState: tickets.slaState,
      slaResponseDueAt: tickets.slaResponseDueAt,
      slaResolutionDueAt: tickets.slaResolutionDueAt,
      createdAt: tickets.createdAt,
      updatedAt: tickets.updatedAt,
      clientName: clients.name,
    })
    .from(tickets)
    .leftJoin(clients, eq(tickets.clientId, clients.id))
    .where(eq(tickets.id, newTicket.id))
    .limit(1);

  if (!input.skipNotifications) {
    if (routedTicket.assigneeId) {
      await queueNotification({
        orgId: input.orgId,
        ticketId: routedTicket.id,
        ticketCode: routedTicket.code,
        ticketSubject: routedTicket.subject,
        userId: routedTicket.assigneeId,
        title: "New Ticket Assigned",
        message: `Ticket #${routedTicket.code} ("${routedTicket.subject}") has been assigned to you.`,
      });
    } else {
      await alertOrgAdmins(
        input.orgId,
        routedTicket.id,
        routedTicket.code,
        routedTicket.subject,
        "New Unassigned Ticket Submitted",
        `A new ticket #${routedTicket.code} ("${routedTicket.subject}") was submitted and remains unassigned.`
      );
    }
  }

  return routedTicket;
}
