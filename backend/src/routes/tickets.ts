import { Router, Request, Response } from "express";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { db } from "../db/connection";
import {
  tickets,
  users,
  clients,
  slaPolicies,
  slaTargets,
  ticketMessages,
  ticketAuditLogs,
  ticketMerges,
  ticketFeedback,
  teams,
  organizations,
  ticketAttachments,
} from "../schema";
import { eq, and, or, sql, ilike, desc, asc, notInArray, isNull } from "drizzle-orm";
import { authenticateToken, requireRole } from "../middleware/auth";
import { calculateDeadline } from "../utils/sla";
import { routeTicket } from "../utils/routing";
import { queueNotification, alertOrgAdmins } from "../utils/notifications";
import { createSupportTicket } from "../services/ticketCreationService";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const router = Router();

/**
 * GET /api/tickets
 * 
 * Lists tickets for the authenticated organization context.
 * Filters by: status, priority, assigneeId, teamId, clientId, and search (subject/code/description).
 * Scopes data by role:
 * - Admin/Agent: Access to all tickets in the Org.
 * - Client User: Limited exclusively to their company's tickets.
 */
router.get(
  "/",
  authenticateToken,
  async (req: Request, res: Response) => {
    const { status, priority, assigneeId, teamId, clientId, search } = req.query;

    try {
      const conditions = [eq(tickets.orgId, req.user!.orgId)];

      // 1. Enforce Client isolation vs Agent scoping
      if (req.user!.role === "client_user") {
        if (!req.user!.clientId) {
          return res.status(403).json({ error: "Client user not mapped to a company" });
        }
        conditions.push(eq(tickets.clientId, req.user!.clientId));
      } else if (clientId) {
        conditions.push(eq(tickets.clientId, clientId as string));
      }

      // 2. Apply query filters
      if (status) {
        conditions.push(eq(tickets.status, status as any));
      }
      if (priority) {
        conditions.push(eq(tickets.priority, priority as any));
      }
      if (assigneeId) {
        conditions.push(eq(tickets.assigneeId, assigneeId as string));
      }
      if (teamId) {
        conditions.push(eq(tickets.teamId, teamId as string));
      }

      // 3. Apply search conditions (matching subject, description, or code)
      if (search) {
        const searchPattern = `%${search}%`;
        const codeNum = parseInt(search as string, 10);
        if (!isNaN(codeNum)) {
          conditions.push(
            or(
              ilike(tickets.subject, searchPattern),
              ilike(tickets.description, searchPattern),
              eq(tickets.code, codeNum)
            ) as any
          );
        } else {
          conditions.push(
            or(
              ilike(tickets.subject, searchPattern),
              ilike(tickets.description, searchPattern)
            ) as any
          );
        }
      }

      // 4. Query list with joins to display metadata details
      const list = await db
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
          assignee: {
            firstName: users.firstName,
            lastName: users.lastName,
            initials: users.initials,
          },
        })
        .from(tickets)
        .leftJoin(clients, eq(tickets.clientId, clients.id))
        .leftJoin(users, eq(tickets.assigneeId, users.id))
        .where(and(...conditions))
        .orderBy(desc(tickets.createdAt));

      return res.json(list);
    } catch (error) {
      console.error("List tickets failed:", error);
      return res.status(500).json({ error: "Failed to retrieve tickets" });
    }
  }
);

/**
 * POST /api/tickets
 * 
 * Creates a new ticket.
 * Computes and assigns response/resolution SLA deadlines based on the resolved SLA policy.
 * Invokes the automated routing engine to assign the ticket to a Support Team and/or Agent.
 * Records creation in the audit log.
 */
router.post(
  "/",
  authenticateToken,
  async (req: Request, res: Response) => {
    const { subject, description, priority, workstream, clientId, attachments } = req.body;

    if (!subject || !description || !priority) {
      return res.status(400).json({ error: "Missing required fields (subject, description, priority)" });
    }

    try {
      // 1. Resolve client company ID context
      let targetClientId = clientId;
      if (req.user!.role === "client_user") {
        if (!req.user!.clientId) {
          return res.status(403).json({ error: "Client user not mapped to a company" });
        }
        targetClientId = req.user!.clientId;
      }

      if (!targetClientId) {
        return res.status(400).json({ error: "Client company ID is required" });
      }

      const routedTicket = await createSupportTicket({
        orgId: req.user!.orgId,
        requesterId: req.user!.userId,
        clientId: targetClientId,
        subject,
        description,
        priority,
        workstream,
        attachments: Array.isArray(attachments) ? attachments : [],
        actorId: req.user!.userId,
        source: "portal",
      });

      return res.status(201).json(routedTicket);
    } catch (error: any) {
      console.error("Create ticket failed:", error);
      if (error?.statusCode) {
        return res.status(error.statusCode).json({ error: error.message });
      }
      if (error?.message?.includes("attachment")) {
        return res.status(400).json({ error: error.message });
      }
      return res.status(500).json({ error: "Failed to create ticket" });
    }
  }
);

/**
 * GET /api/tickets/:id
 * 
 * Returns detailed fields for a specific ticket, including the message history,
 * audit logs, and CSAT feedback.
 * Enforces strict client scope.
 */
router.get(
  "/:id",
  authenticateToken,
  async (req: Request, res: Response) => {
    const { id } = req.params;

    try {
      // 1. Fetch primary ticket record with client name details
      const [ticketObj] = await db
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
          slaPolicyId: tickets.slaPolicyId,
          slaState: tickets.slaState,
          slaResponseDueAt: tickets.slaResponseDueAt,
          slaResolutionDueAt: tickets.slaResolutionDueAt,
          firstRespondedAt: tickets.firstRespondedAt,
          resolvedAt: tickets.resolvedAt,
          createdAt: tickets.createdAt,
          updatedAt: tickets.updatedAt,
          clientName: clients.name,
          requester: {
            firstName: users.firstName,
            lastName: users.lastName,
            email: users.email,
          },
          teamName: teams.name,
        })
        .from(tickets)
        .leftJoin(clients, eq(tickets.clientId, clients.id))
        .leftJoin(users, eq(tickets.requesterId, users.id))
        .leftJoin(teams, eq(tickets.teamId, teams.id))
        .where(
          and(
            eq(tickets.id, id),
            eq(tickets.orgId, req.user!.orgId)
          )
        )
        .limit(1);

      if (!ticketObj) {
        return res.status(404).json({ error: "Ticket not found" });
      }

      // Enforce client scoping
      if (req.user!.role === "client_user" && ticketObj.clientId !== req.user!.clientId) {
        return res.status(403).json({ error: "Access denied to this ticket" });
      }

      // 2. Fetch ticket messages thread
      const msgConditions = [eq(ticketMessages.ticketId, id)];
      if (req.user!.role === "client_user") {
        msgConditions.push(eq(ticketMessages.isInternal, false)); // Hide internal notes for clients
      }

      const thread = await db
        .select({
          id: ticketMessages.id,
          body: ticketMessages.body,
          senderRole: ticketMessages.senderRole,
          isInternal: ticketMessages.isInternal,
          createdAt: ticketMessages.createdAt,
          sender: {
            firstName: users.firstName,
            lastName: users.lastName,
            email: users.email,
            initials: users.initials,
          },
        })
        .from(ticketMessages)
        .leftJoin(users, eq(ticketMessages.senderId, users.id))
        .where(and(...msgConditions))
        .orderBy(asc(ticketMessages.createdAt));

      // 3. Fetch audit logs (Only available to internal agents/admins)
      let logs: any[] = [];
      if (req.user!.role !== "client_user") {
        logs = await db
          .select({
            id: ticketAuditLogs.id,
            action: ticketAuditLogs.action,
            previousValue: ticketAuditLogs.previousValue,
            newValue: ticketAuditLogs.newValue,
            createdAt: ticketAuditLogs.createdAt,
            actor: {
              firstName: users.firstName,
              lastName: users.lastName,
              initials: users.initials,
            },
          })
          .from(ticketAuditLogs)
          .leftJoin(users, eq(ticketAuditLogs.actorId, users.id))
          .where(eq(ticketAuditLogs.ticketId, id))
          .orderBy(asc(ticketAuditLogs.createdAt));
      }

      // 4. Fetch CSAT feedback rating (if resolved/closed)
      const [feedback] = await db
        .select()
        .from(ticketFeedback)
        .where(eq(ticketFeedback.ticketId, id))
        .limit(1);

      // 5. Fetch all attachments for this ticket
      const allAttachments = await db
        .select()
        .from(ticketAttachments)
        .where(eq(ticketAttachments.ticketId, id));

      // Separate into ticket description attachments (where messageId is null)
      const ticketDescriptionAttachments = allAttachments.filter(att => !att.messageId);

      // Map message-level attachments to their respective messages
      const threadWithAttachments = thread.map(msg => ({
        ...msg,
        attachments: allAttachments.filter(att => att.messageId === msg.id),
      }));

      return res.json({
        ...ticketObj,
        attachments: ticketDescriptionAttachments,
        messages: threadWithAttachments,
        auditLogs: logs,
        feedback: feedback || null,
      });
    } catch (error) {
      console.error("Fetch ticket failed:", error);
      return res.status(500).json({ error: "Failed to retrieve ticket details" });
    }
  }
);

/**
 * POST /api/tickets/:id/messages
 * 
 * Adds a new message response to a ticket thread.
 * Client users cannot write internal-only agent notes.
 * Tracks SLA first response compliance.
 */
router.post(
  "/:id/messages",
  authenticateToken,
  async (req: Request, res: Response) => {
    const { id } = req.params;
    const { body, isInternal, attachments } = req.body;

    if (!body || body.trim() === "") {
      return res.status(400).json({ error: "Message body cannot be empty" });
    }

    // Validate attachments file paths for security
    if (attachments && Array.isArray(attachments)) {
      for (const att of attachments) {
        if (!att.fileName || !att.filePath) {
          return res.status(400).json({ error: "Invalid attachment metadata structure" });
        }
        const isLocalMatch = att.filePath.startsWith(`/uploads/${req.user!.orgId}/attachments/`);
        const isS3Match = att.filePath.includes(`/${req.user!.orgId}/attachments/`);
        if (!isLocalMatch && !isS3Match) {
          return res.status(400).json({ error: `Unauthorized path for file attachment: ${att.fileName}` });
        }
      }
    }

    try {
      // 1. Fetch ticket details
      const [ticketObj] = await db
        .select()
        .from(tickets)
        .where(
          and(
            eq(tickets.id, id),
            eq(tickets.orgId, req.user!.orgId)
          )
        )
        .limit(1);

      if (!ticketObj) {
        return res.status(404).json({ error: "Ticket not found" });
      }

      // Enforce client company validation
      if (req.user!.role === "client_user") {
        if (ticketObj.clientId !== req.user!.clientId) {
          return res.status(403).json({ error: "Access denied" });
        }
        if (isInternal === true) {
          return res.status(403).json({ error: "Client users cannot post internal notes" });
        }
      }

      const senderRole = req.user!.role === "client_user" ? "client" : "agent";
      const isInternalNote = isInternal === true;

      // 2. Insert message record
      const [newMsg] = await db
        .insert(ticketMessages)
        .values({
          ticketId: id,
          senderId: req.user!.userId,
          senderRole,
          body,
          isInternal: isInternalNote,
        })
        .returning();

      // Insert message-level attachments if provided
      if (attachments && Array.isArray(attachments)) {
        for (const att of attachments) {
          await db.insert(ticketAttachments).values({
            ticketId: id,
            messageId: newMsg.id,
            fileName: att.fileName,
            fileSize: att.fileSize,
            filePath: att.filePath,
            mimeType: att.mimeType,
          });
        }
      }

      // 3. Auto-resolve SLA response target on first agent response
      let updateFields: any = { updatedAt: new Date() };
      
      if (
        senderRole === "agent" &&
        !isInternalNote &&
        !ticketObj.firstRespondedAt
      ) {
        const now = new Date();
        updateFields.firstRespondedAt = now;

        // Check if response met SLA response deadline
        if (ticketObj.slaResponseDueAt) {
          const isCompliant = now.getTime() <= new Date(ticketObj.slaResponseDueAt).getTime();
          updateFields.slaState = isCompliant ? "on-track" : "breached";
        }
      }

      // Auto-toggle status if a ticket is "new" and an agent replies
      if (senderRole === "agent" && ticketObj.status === "new") {
        updateFields.status = "open";
        
        await db.insert(ticketAuditLogs).values({
          ticketId: id,
          actorId: req.user!.userId,
          action: "status_change",
          previousValue: "new",
          newValue: "open",
        });
      }

      // If client replies to a resolved/closed ticket, optionally reopen it
      if (senderRole === "client" && (ticketObj.status === "resolved" || ticketObj.status === "closed")) {
        updateFields.status = "open";
        updateFields.resolvedAt = null;

        await db.insert(ticketAuditLogs).values({
          ticketId: id,
          actorId: req.user!.userId,
          action: "reopen",
          previousValue: ticketObj.status,
          newValue: "open",
        });
      }

      await db
        .update(tickets)
        .set(updateFields)
        .where(eq(tickets.id, id));

      // 4. Return message detail
      const [messageDetails] = await db
        .select({
          id: ticketMessages.id,
          body: ticketMessages.body,
          senderRole: ticketMessages.senderRole,
          isInternal: ticketMessages.isInternal,
          createdAt: ticketMessages.createdAt,
          sender: {
            firstName: users.firstName,
            lastName: users.lastName,
            email: users.email,
            initials: users.initials,
          },
        })
        .from(ticketMessages)
        .leftJoin(users, eq(ticketMessages.senderId, users.id))
        .where(eq(ticketMessages.id, newMsg.id))
        .limit(1);

      // Queue notifications
      const snippet = body.length > 60 ? body.substring(0, 60) + "..." : body;
      if (senderRole === "client") {
        if (ticketObj.assigneeId) {
          await queueNotification({
            orgId: req.user!.orgId,
            ticketId: ticketObj.id,
            ticketCode: ticketObj.code,
            ticketSubject: ticketObj.subject,
            userId: ticketObj.assigneeId,
            title: `New Reply on Ticket #${ticketObj.code}`,
            message: `Client ${req.user!.email} replied: "${snippet}"`,
          });
        } else {
          await alertOrgAdmins(
            req.user!.orgId,
            ticketObj.id,
            ticketObj.code,
            ticketObj.subject,
            `New Reply on Ticket #${ticketObj.code}`,
            `Client ${req.user!.email} replied to unassigned ticket #${ticketObj.code}: "${snippet}"`
          );
        }
      } else if (senderRole === "agent" && !isInternalNote) {
        await queueNotification({
          orgId: req.user!.orgId,
          ticketId: ticketObj.id,
          ticketCode: ticketObj.code,
          ticketSubject: ticketObj.subject,
          userId: ticketObj.requesterId,
          title: `New Update on Ticket #${ticketObj.code}`,
          message: `Agent ${req.user!.email} replied: "${snippet}"`,
        });
      }

      const msgAttachments = await db
        .select()
        .from(ticketAttachments)
        .where(eq(ticketAttachments.messageId, newMsg.id));

      return res.status(201).json({
        ...messageDetails,
        attachments: msgAttachments,
      });
    } catch (error) {
      console.error("Post message failed:", error);
      return res.status(500).json({ error: "Failed to post message response" });
    }
  }
);

/**
 * PUT /api/tickets/:id
 * 
 * Updates ticket properties (status, priority, assigneeId, teamId, workstream, tags).
 * Audits all updates in ticketAuditLogs.
 * Scoped to Admins and Agents.
 */
router.put(
  "/:id",
  authenticateToken,
  requireRole(["admin", "agent"]),
  async (req: Request, res: Response) => {
    const { id } = req.params;
    const { status, priority, assigneeId, teamId, workstream, tags } = req.body;

    try {
      // 1. Fetch current ticket state
      const [currentTicket] = await db
        .select()
        .from(tickets)
        .where(
          and(
            eq(tickets.id, id),
            eq(tickets.orgId, req.user!.orgId)
          )
        )
        .limit(1);

      if (!currentTicket) {
        return res.status(404).json({ error: "Ticket not found" });
      }

      // Validate assignee belongs to this organization and is staff
      if (assigneeId && assigneeId !== "none" && assigneeId !== "null") {
        const [assigneeUser] = await db
          .select()
          .from(users)
          .where(
            and(
              eq(users.id, assigneeId),
              eq(users.orgId, req.user!.orgId),
              or(eq(users.role, "admin"), eq(users.role, "agent"))
            )
          )
          .limit(1);
        if (!assigneeUser) {
          return res.status(400).json({ error: "Invalid assignee agent selected. Must be an active staff member of this organization." });
        }
      }

      // Validate team belongs to this organization
      if (teamId && teamId !== "none" && teamId !== "null") {
        const [teamRecord] = await db
          .select()
          .from(teams)
          .where(
            and(
              eq(teams.id, teamId),
              eq(teams.orgId, req.user!.orgId)
            )
          )
          .limit(1);
        if (!teamRecord) {
          return res.status(400).json({ error: "Invalid support team selected. Team does not belong to this organization." });
        }
      }

      const updates: any = { updatedAt: new Date() };
      const auditLogPromises = [];

      // 2. Check and stage each field update
      if (status && status !== currentTicket.status) {
        updates.status = status;
        
        // Handle resolution timestamp logic
        if (status === "resolved") {
          updates.resolvedAt = new Date();
        } else if (currentTicket.status === "resolved") {
          updates.resolvedAt = null;
        }

        auditLogPromises.push(
          db.insert(ticketAuditLogs).values({
            ticketId: id,
            actorId: req.user!.userId,
            action: "status_change",
            previousValue: currentTicket.status,
            newValue: status,
          })
        );
      }

      if (priority && priority !== currentTicket.priority) {
        updates.priority = priority;
        auditLogPromises.push(
          db.insert(ticketAuditLogs).values({
            ticketId: id,
            actorId: req.user!.userId,
            action: "priority_change",
            previousValue: currentTicket.priority,
            newValue: priority,
          })
        );
      }

      if (assigneeId !== undefined && assigneeId !== currentTicket.assigneeId) {
        updates.assigneeId = assigneeId || null;
        auditLogPromises.push(
          db.insert(ticketAuditLogs).values({
            ticketId: id,
            actorId: req.user!.userId,
            action: "assignment_change",
            previousValue: currentTicket.assigneeId || "none",
            newValue: assigneeId || "none",
          })
        );
      }

      if (teamId !== undefined && teamId !== currentTicket.teamId) {
        updates.teamId = teamId || null;
        auditLogPromises.push(
          db.insert(ticketAuditLogs).values({
            ticketId: id,
            actorId: req.user!.userId,
            action: "team_change",
            previousValue: currentTicket.teamId || "none",
            newValue: teamId || "none",
          })
        );
      }

      if (workstream !== undefined && workstream !== currentTicket.workstream) {
        updates.workstream = workstream || null;
        auditLogPromises.push(
          db.insert(ticketAuditLogs).values({
            ticketId: id,
            actorId: req.user!.userId,
            action: "workstream_change",
            previousValue: currentTicket.workstream || "none",
            newValue: workstream || "none",
          })
        );
      }

      if (tags !== undefined) {
        updates.tags = tags;
      }

      // 3. Apply DB updates
      await db
        .update(tickets)
        .set(updates)
        .where(
          and(
            eq(tickets.id, id),
            eq(tickets.orgId, req.user!.orgId)
          )
        );

      // 4. Run staged audit logs
      if (auditLogPromises.length > 0) {
        await Promise.all(auditLogPromises);
      }

      // 5. Fetch updated detail
      const [updatedTicket] = await db
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
        .where(
          and(
            eq(tickets.id, id),
            eq(tickets.orgId, req.user!.orgId)
          )
        )
        .limit(1);

      // Queue notifications
      if (assigneeId !== undefined && assigneeId && assigneeId !== currentTicket.assigneeId) {
        await queueNotification({
          orgId: req.user!.orgId,
          ticketId: updatedTicket.id,
          ticketCode: updatedTicket.code,
          ticketSubject: updatedTicket.subject,
          userId: assigneeId,
          title: "Ticket Assigned",
          message: `Ticket #${updatedTicket.code} ("${updatedTicket.subject}") has been assigned to you.`,
        });
      }

      if (status && status !== currentTicket.status) {
        if (status === "resolved") {
          await queueNotification({
            orgId: req.user!.orgId,
            ticketId: updatedTicket.id,
            ticketCode: updatedTicket.code,
            ticketSubject: updatedTicket.subject,
            userId: currentTicket.requesterId,
            title: `Ticket Resolved: #${updatedTicket.code}`,
            message: `Your ticket #${updatedTicket.code} ("${updatedTicket.subject}") has been resolved.`,
          });
        } else if (status === "closed") {
          await queueNotification({
            orgId: req.user!.orgId,
            ticketId: updatedTicket.id,
            ticketCode: updatedTicket.code,
            ticketSubject: updatedTicket.subject,
            userId: currentTicket.requesterId,
            title: `Ticket Closed: #${updatedTicket.code}`,
            message: `Your ticket #${updatedTicket.code} ("${updatedTicket.subject}") has been closed.`,
          });
        }
      }

      return res.json(updatedTicket);
    } catch (error) {
      console.error("Update ticket failed:", error);
      return res.status(500).json({ error: "Failed to update ticket properties" });
    }
  }
);

/**
 * POST /api/tickets/merge
 * 
 * Merges a child duplicate ticket into a parent ticket.
 * Clones all child messages into the parent thread.
 * Closes the child ticket and audits the merge on both.
 * Scoped to Admins and Agents.
 */
router.post(
  "/merge",
  authenticateToken,
  requireRole(["admin", "agent"]),
  async (req: Request, res: Response) => {
    const { parentTicketId, childTicketId } = req.body;

    if (!parentTicketId || !childTicketId) {
      return res.status(400).json({ error: "Missing parentTicketId or childTicketId" });
    }

    if (parentTicketId === childTicketId) {
      return res.status(400).json({ error: "Cannot merge a ticket into itself" });
    }

    try {
      // 1. Retrieve parent and child tickets
      const [parent] = await db
        .select()
        .from(tickets)
        .where(
          and(
            eq(tickets.id, parentTicketId),
            eq(tickets.orgId, req.user!.orgId)
          )
        )
        .limit(1);

      const [child] = await db
        .select()
        .from(tickets)
        .where(
          and(
            eq(tickets.id, childTicketId),
            eq(tickets.orgId, req.user!.orgId)
          )
        )
        .limit(1);

      if (!parent || !child) {
        return res.status(404).json({ error: "Parent or duplicate child ticket not found" });
      }

      if (child.status === "closed") {
        return res.status(400).json({ error: "Child ticket is already closed" });
      }

      // 2. Fetch child messages to copy
      const childMessages = await db
        .select()
        .from(ticketMessages)
        .where(eq(ticketMessages.ticketId, childTicketId))
        .orderBy(asc(ticketMessages.createdAt));

      // 3. Run merging database operations inside a transaction
      await db.transaction(async (tx) => {
        // Re-link child ticket description attachments (where messageId IS NULL) to parent ticket ID
        await tx
          .update(ticketAttachments)
          .set({ ticketId: parentTicketId })
          .where(
            and(
              eq(ticketAttachments.ticketId, childTicketId),
              isNull(ticketAttachments.messageId)
            )
          );

        // Clone child messages into parent thread
        for (const msg of childMessages) {
          const [newMsg] = await tx
            .insert(ticketMessages)
            .values({
              ticketId: parentTicketId,
              senderId: msg.senderId,
              senderRole: msg.senderRole,
              body: `[Merged from ticket #${child.code}]: ${msg.body}`,
              isInternal: msg.isInternal,
              createdAt: msg.createdAt,
            })
            .returning();

          // Re-link any attachments from the child message to the new parent message
          await tx
            .update(ticketAttachments)
            .set({
              ticketId: parentTicketId,
              messageId: newMsg.id,
            })
            .where(eq(ticketAttachments.messageId, msg.id));
        }

        // Close the child ticket
        await tx
          .update(tickets)
          .set({ status: "closed", updatedAt: new Date() })
          .where(eq(tickets.id, childTicketId));

        // Create the merge mapping record
        await tx.insert(ticketMerges).values({
          parentTicketId,
          childTicketId,
          mergedById: req.user!.userId,
        });

        // Insert audit log on parent
        await tx.insert(ticketAuditLogs).values({
          ticketId: parentTicketId,
          actorId: req.user!.userId,
          action: "merge_parent",
          newValue: JSON.stringify({
            childTicketId,
            childCode: child.code,
          }),
        });

        // Insert audit log on child
        await tx.insert(ticketAuditLogs).values({
          ticketId: childTicketId,
          actorId: req.user!.userId,
          action: "merge_child",
          newValue: JSON.stringify({
            parentTicketId,
            parentCode: parent.code,
          }),
        });
      });

      return res.json({ message: `Ticket #${child.code} merged successfully into #${parent.code}` });
    } catch (error) {
      console.error("Merge tickets failed:", error);
      return res.status(500).json({ error: "Failed to execute ticket merge" });
    }
  }
);

/**
 * POST /api/tickets/:id/feedback
 * 
 * Submits CSAT feedback rating (1-5 stars) and comments on a resolved ticket.
 * Scoped to Client Users.
 */
router.post(
  "/:id/feedback",
  authenticateToken,
  requireRole(["client_user"]),
  async (req: Request, res: Response) => {
    const { id } = req.params;
    const { rating, comment } = req.body;

    const parsedRating = parseInt(rating, 10);
    if (isNaN(parsedRating) || parsedRating < 1 || parsedRating > 5) {
      return res.status(400).json({ error: "CSAT Rating must be an integer between 1 and 5" });
    }

    try {
      // 1. Fetch ticket and verify ownership
      const [ticketObj] = await db
        .select()
        .from(tickets)
        .where(
          and(
            eq(tickets.id, id),
            eq(tickets.orgId, req.user!.orgId)
          )
        )
        .limit(1);

      if (!ticketObj) {
        return res.status(404).json({ error: "Ticket not found" });
      }

      if (ticketObj.clientId !== req.user!.clientId) {
        return res.status(403).json({ error: "Access denied to this ticket" });
      }

      if (ticketObj.status !== "resolved" && ticketObj.status !== "closed") {
        return res.status(400).json({ error: "Feedback can only be submitted for resolved or closed tickets" });
      }

      // Check if feedback already submitted
      const [existingFeedback] = await db
        .select()
        .from(ticketFeedback)
        .where(eq(ticketFeedback.ticketId, id))
        .limit(1);

      if (existingFeedback) {
        return res.status(400).json({ error: "Feedback has already been submitted for this ticket" });
      }

      // 2. Insert feedback rating
      await db.insert(ticketFeedback).values({
        ticketId: id,
        rating: parsedRating,
        comment: comment || null,
      });

      // 3. Log CSAT submission in audit logs
      await db.insert(ticketAuditLogs).values({
        ticketId: id,
        actorId: req.user!.userId,
        action: "csat_feedback",
        newValue: JSON.stringify({ rating: parsedRating, comment }),
      });

      return res.status(201).json({ message: "CSAT Feedback submitted successfully" });
    } catch (error) {
      console.error("CSAT Feedback submission failed:", error);
      return res.status(500).json({ error: "Failed to submit CSAT feedback rating" });
    }
  }
);

/**
 * GET /api/tickets/:ticketId/attachments/:id/download
 * 
 * Securely downloads an attachment. Verifies that the user has access to the ticket,
 * and that the attachment belongs to the ticket. Resolves and streams local file.
 */
router.get(
  "/:ticketId/attachments/:id/download",
  authenticateToken,
  async (req: Request, res: Response) => {
    const { ticketId, id } = req.params;

    try {
      // 1. Fetch ticket and verify tenant scope
      const [ticketObj] = await db
        .select()
        .from(tickets)
        .where(
          and(
            eq(tickets.id, ticketId),
            eq(tickets.orgId, req.user!.orgId)
          )
        )
        .limit(1);

      if (!ticketObj) {
        return res.status(404).json({ error: "Ticket not found" });
      }

      // 2. Enforce client user scope
      if (req.user!.role === "client_user" && ticketObj.clientId !== req.user!.clientId) {
        return res.status(403).json({ error: "Access denied to this ticket" });
      }

      // 3. Fetch attachment and verify it belongs to this ticket
      const [attachment] = await db
        .select()
        .from(ticketAttachments)
        .where(
          and(
            eq(ticketAttachments.id, id),
            eq(ticketAttachments.ticketId, ticketId)
          )
        )
        .limit(1);

      if (!attachment) {
        return res.status(404).json({ error: "Attachment not found" });
      }

      // 4. Handle storage download (S3 vs local)
      if (attachment.filePath.startsWith("http://") || attachment.filePath.startsWith("https://")) {
        // Fallback redirect for S3/CDN paths
        return res.redirect(attachment.filePath);
      }

      // Local storage path resolution
      let relativePath = attachment.filePath;
      if (relativePath.startsWith("/uploads/")) {
        relativePath = relativePath.replace("/uploads/", "");
      } else if (relativePath.startsWith("uploads/")) {
        relativePath = relativePath.replace("uploads/", "");
      }

      const absolutePath = path.resolve(__dirname, "../../uploads", relativePath);

      if (!fs.existsSync(absolutePath)) {
        return res.status(404).json({ error: "Attachment file not found on disk" });
      }

      return res.download(absolutePath, attachment.fileName);
    } catch (error) {
      console.error("Download attachment failed:", error);
      return res.status(500).json({ error: "Failed to download attachment" });
    }
  }
);

export default router;
