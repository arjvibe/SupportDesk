import bcrypt from "bcryptjs";
import { randomUUID } from "crypto";
import { and, desc, eq, ilike, or } from "drizzle-orm";
import { db } from "../db/connection";
import {
  clients,
  inboundEmails,
  jobs,
  supportMailboxes,
  ticketAuditLogs,
  ticketAttachments,
  ticketEmailThreads,
  ticketMessages,
  tickets,
  users,
} from "../schema";
import { createSupportTicket, TicketAttachmentInput } from "./ticketCreationService";
import { alertOrgAdmins, queueNotification } from "../utils/notifications";

export type NormalizedInboundEmail = {
  provider: string;
  providerMessageId: string;
  fromEmail: string;
  fromName?: string | null;
  toEmail: string;
  cc?: string | null;
  subject: string;
  textBody?: string | null;
  htmlBody?: string | null;
  messageIdHeader?: string | null;
  inReplyToHeader?: string | null;
  referencesHeader?: string | null;
  attachments?: TicketAttachmentInput[];
  rawPayload?: Record<string, unknown>;
};

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function extractEmailAddress(value: string) {
  const match = value.match(/<([^>]+)>/);
  return normalizeEmail(match ? match[1] : value);
}

function stripHtml(html: string) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function bodyToText(email: NormalizedInboundEmail) {
  const text = email.textBody?.trim();
  if (text) return text;
  if (email.htmlBody) return stripHtml(email.htmlBody);
  return "(No email body)";
}

function validateAttachmentPaths(orgId: string, attachments?: TicketAttachmentInput[]) {
  if (!attachments) return;
  for (const att of attachments) {
    const isLocalMatch = att.filePath?.startsWith(`/uploads/${orgId}/attachments/`);
    const isS3Match = att.filePath?.includes(`/${orgId}/attachments/`);
    if (!att.fileName || !att.filePath || (!isLocalMatch && !isS3Match)) {
      throw new Error(`Unauthorized path for file attachment: ${att.fileName || "unknown"}`);
    }
  }
}

function subjectFingerprint(subject: string) {
  return subject
    .toLowerCase()
    .replace(/\bre:\s*/g, "")
    .replace(/\bfwd:\s*/g, "")
    .replace(/\[ticket\s*#?\d+\]/gi, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .slice(0, 255);
}

function extractTicketCode(subject: string) {
  const match = subject.match(/\[ticket\s*#?(\d+)\]/i) || subject.match(/\b#(\d{2,})\b/);
  return match ? Number(match[1]) : null;
}

function initialsFromName(email: string, name?: string | null) {
  const source = name?.trim() || email.split("@")[0].replace(/[._-]+/g, " ");
  const parts = source.split(/\s+/).filter(Boolean);
  return (parts[0]?.[0] || "U").toUpperCase() + (parts[1]?.[0] || "").toUpperCase();
}

async function findOrCreateRequester(orgId: string, mailbox: typeof supportMailboxes.$inferSelect, email: NormalizedInboundEmail) {
  const senderEmail = extractEmailAddress(email.fromEmail);
  const [existingUser] = await db
    .select()
    .from(users)
    .where(and(eq(users.orgId, orgId), eq(users.email, senderEmail)))
    .limit(1);

  if (existingUser) {
    return { user: existingUser, clientId: existingUser.clientId };
  }

  const domain = senderEmail.split("@")[1];
  const [matchedClient] = await db
    .select()
    .from(clients)
    .where(and(eq(clients.orgId, orgId), ilike(clients.domain, domain)))
    .limit(1);

  if (!matchedClient) {
    if (mailbox.unknownSenderPolicy === "reject") {
      throw new Error(`Rejected unknown sender domain: ${domain}`);
    }
    if (mailbox.defaultClientId && mailbox.unknownSenderPolicy !== "quarantine") {
      const user = await createClientUser(orgId, mailbox.defaultClientId, senderEmail, email.fromName);
      return { user, clientId: mailbox.defaultClientId };
    }
    const error = new Error(`Unknown sender domain requires review: ${domain}`);
    (error as any).quarantine = true;
    throw error;
  }

  const user = await createClientUser(orgId, matchedClient.id, senderEmail, email.fromName);
  return { user, clientId: matchedClient.id };
}

async function createClientUser(orgId: string, clientId: string, email: string, fromName?: string | null) {
  const name = fromName?.trim() || email.split("@")[0].replace(/[._-]+/g, " ");
  const [firstNameRaw, ...rest] = name.split(/\s+/).filter(Boolean);
  const firstName = firstNameRaw || "Email";
  const lastName = rest.join(" ") || "Contact";
  const passwordHash = await bcrypt.hash(`email-only-${randomUUID()}`, 10);

  const [user] = await db
    .insert(users)
    .values({
      orgId,
      clientId,
      email,
      passwordHash,
      firstName,
      lastName,
      role: "client_user",
      initials: initialsFromName(email, fromName),
      isActive: true,
    })
    .returning();

  return user;
}

async function findThreadedTicket(orgId: string, email: NormalizedInboundEmail, requesterClientId: string | null) {
  const headerCandidates = [
    email.inReplyToHeader,
    ...(email.referencesHeader?.split(/\s+/) || []),
  ].filter(Boolean) as string[];

  if (headerCandidates.length > 0) {
    const [thread] = await db
      .select({ ticketId: ticketEmailThreads.ticketId })
      .from(ticketEmailThreads)
      .where(
        and(
          eq(ticketEmailThreads.orgId, orgId),
          or(...headerCandidates.map((header) => eq(ticketEmailThreads.messageIdHeader, header))) as any
        )
      )
      .limit(1);

    if (thread) return thread.ticketId;
  }

  const code = extractTicketCode(email.subject);
  if (code) {
    const [ticket] = await db
      .select({ id: tickets.id })
      .from(tickets)
      .where(and(eq(tickets.orgId, orgId), eq(tickets.code, code)))
      .limit(1);
    if (ticket) return ticket.id;
  }

  const fingerprint = subjectFingerprint(email.subject);
  if (fingerprint && requesterClientId) {
    const [thread] = await db
      .select({ ticketId: ticketEmailThreads.ticketId })
      .from(ticketEmailThreads)
      .innerJoin(tickets, eq(ticketEmailThreads.ticketId, tickets.id))
      .where(
        and(
          eq(ticketEmailThreads.orgId, orgId),
          eq(ticketEmailThreads.subjectFingerprint, fingerprint),
          eq(tickets.clientId, requesterClientId)
        )
      )
      .orderBy(desc(ticketEmailThreads.createdAt))
      .limit(1);

    if (thread) return thread.ticketId;
  }

  return null;
}

async function recordThread(orgId: string, ticketId: string, inboundEmailId: string, email: NormalizedInboundEmail) {
  await db.insert(ticketEmailThreads).values({
    orgId,
    ticketId,
    inboundEmailId,
    messageIdHeader: email.messageIdHeader || email.providerMessageId,
    inReplyToHeader: email.inReplyToHeader || null,
    referencesHeader: email.referencesHeader || null,
    subjectFingerprint: subjectFingerprint(email.subject) || null,
  });
}

export async function enqueueInboundEmail(email: NormalizedInboundEmail) {
  const toEmail = extractEmailAddress(email.toEmail);
  const [mailbox] = await db
    .select()
    .from(supportMailboxes)
    .where(and(eq(supportMailboxes.emailAddress, toEmail), eq(supportMailboxes.isActive, true)))
    .limit(1);

  if (!mailbox) {
    throw new Error(`No active support mailbox configured for ${toEmail}`);
  }

  const provider = email.provider || mailbox.provider;
  const providerMessageId = email.providerMessageId || `${provider}-${Date.now()}`;
  const [existing] = await db
    .select()
    .from(inboundEmails)
    .where(and(eq(inboundEmails.provider, provider), eq(inboundEmails.providerMessageId, providerMessageId)))
    .limit(1);

  if (existing) {
    return existing;
  }

  const [inbound] = await db
    .insert(inboundEmails)
    .values({
      orgId: mailbox.orgId,
      mailboxId: mailbox.id,
      provider,
      providerMessageId,
      fromEmail: extractEmailAddress(email.fromEmail),
      fromName: email.fromName || null,
      toEmail,
      cc: email.cc || null,
      subject: email.subject || "(No subject)",
      textBody: email.textBody || null,
      htmlBody: email.htmlBody || null,
      rawPayload: {
        ...email.rawPayload,
        messageIdHeader: email.messageIdHeader,
        inReplyToHeader: email.inReplyToHeader,
        referencesHeader: email.referencesHeader,
        attachments: email.attachments || [],
      },
      status: "received",
    })
    .returning();

  await db.insert(jobs).values({
    queueName: "inbound_email",
    payload: JSON.stringify({ orgId: mailbox.orgId, inboundEmailId: inbound.id }),
    status: "pending",
  });

  return inbound;
}

export async function processInboundEmail(inboundEmailId: string) {
  const [inbound] = await db
    .select()
    .from(inboundEmails)
    .where(eq(inboundEmails.id, inboundEmailId))
    .limit(1);

  if (!inbound || inbound.status === "processed" || inbound.status === "ignored") {
    return;
  }

  const [mailbox] = await db
    .select()
    .from(supportMailboxes)
    .where(eq(supportMailboxes.id, inbound.mailboxId || "00000000-0000-0000-0000-000000000000"))
    .limit(1);

  if (!mailbox || !mailbox.isActive) {
    await db.update(inboundEmails).set({ status: "ignored", errorMessage: "Mailbox is inactive or missing", updatedAt: new Date() }).where(eq(inboundEmails.id, inbound.id));
    return;
  }

  const rawPayload = (inbound.rawPayload || {}) as Record<string, any>;
  const email: NormalizedInboundEmail = {
    provider: inbound.provider,
    providerMessageId: inbound.providerMessageId,
    fromEmail: inbound.fromEmail,
    fromName: inbound.fromName,
    toEmail: inbound.toEmail,
    cc: inbound.cc,
    subject: inbound.subject,
    textBody: inbound.textBody,
    htmlBody: inbound.htmlBody,
    messageIdHeader: rawPayload.messageIdHeader || inbound.providerMessageId,
    inReplyToHeader: rawPayload.inReplyToHeader || null,
    referencesHeader: rawPayload.referencesHeader || null,
    attachments: Array.isArray(rawPayload.attachments) ? rawPayload.attachments : [],
    rawPayload,
  };

  try {
    const requester = await findOrCreateRequester(inbound.orgId, mailbox, email);
    if (!requester.clientId) {
      const error = new Error("Matched sender is not associated with a client account");
      (error as any).quarantine = true;
      throw error;
    }

    const matchedTicketId = await findThreadedTicket(inbound.orgId, email, requester.clientId);

    if (matchedTicketId) {
      const replyResult = await addEmailReply(inbound.id, inbound.orgId, matchedTicketId, requester.user.id, mailbox, email);
      if (replyResult === "ignored") return;
      await recordThread(inbound.orgId, matchedTicketId, inbound.id, email);
      await db.update(inboundEmails).set({ status: "processed", ticketId: matchedTicketId, updatedAt: new Date() }).where(eq(inboundEmails.id, inbound.id));
      return;
    }

    const ticket = await createSupportTicket({
      orgId: inbound.orgId,
      requesterId: requester.user.id,
      clientId: requester.clientId,
      subject: email.subject || "(No subject)",
      description: bodyToText(email),
      priority: mailbox.defaultPriority,
      teamId: mailbox.defaultTeamId,
      attachments: email.attachments,
      actorId: null,
      source: "email",
    });

    await recordThread(inbound.orgId, ticket.id, inbound.id, email);
    await db.update(inboundEmails).set({ status: "processed", ticketId: ticket.id, updatedAt: new Date() }).where(eq(inboundEmails.id, inbound.id));

    if (mailbox.autoAckEnabled) {
      await db.insert(jobs).values({
        queueName: "email",
        payload: JSON.stringify({
          orgId: inbound.orgId,
          to: inbound.fromEmail,
          subject: `Ticket #${ticket.code} received: ${ticket.subject}`,
          html: `<p>We received your request and created ticket #${ticket.code}.</p>`,
        }),
        status: "pending",
      });
    }
  } catch (error: any) {
    const status = error?.quarantine ? "quarantined" : "failed";
    await db
      .update(inboundEmails)
      .set({
        status,
        errorMessage: error?.message || String(error),
        updatedAt: new Date(),
      })
      .where(eq(inboundEmails.id, inbound.id));
    if (!error?.quarantine) throw error;
  }
}

async function addEmailReply(
  inboundEmailId: string,
  orgId: string,
  ticketId: string,
  senderId: string,
  mailbox: typeof supportMailboxes.$inferSelect,
  email: NormalizedInboundEmail
) {
  const [ticket] = await db.select().from(tickets).where(and(eq(tickets.id, ticketId), eq(tickets.orgId, orgId))).limit(1);
  if (!ticket) throw new Error("Matched ticket not found");

  if (ticket.status === "closed" && mailbox.replyBehavior === "ignore_closed") {
    await db.update(inboundEmails).set({ status: "ignored", errorMessage: "Reply ignored because ticket is closed", updatedAt: new Date() }).where(eq(inboundEmails.id, inboundEmailId));
    return "ignored";
  }

  const [message] = await db
    .insert(ticketMessages)
    .values({
      ticketId,
      senderId,
      senderRole: "client",
      body: bodyToText(email),
      isInternal: false,
    })
    .returning();

  validateAttachmentPaths(orgId, email.attachments);
  if (email.attachments && email.attachments.length > 0) {
    for (const att of email.attachments) {
      await db.insert(ticketAttachments).values({
        ticketId,
        messageId: message.id,
        fileName: att.fileName,
        fileSize: att.fileSize || 0,
        filePath: att.filePath,
        mimeType: att.mimeType,
      });
    }
  }

  if (ticket.status === "resolved" && mailbox.replyBehavior === "reopen_resolved") {
    await db.update(tickets).set({ status: "open", resolvedAt: null, updatedAt: new Date() }).where(eq(tickets.id, ticketId));
  } else {
    await db.update(tickets).set({ updatedAt: new Date() }).where(eq(tickets.id, ticketId));
  }

  await db.insert(ticketAuditLogs).values({
    ticketId,
    actorId: senderId,
    action: "email_reply_received",
    newValue: JSON.stringify({ inboundEmailId, messageId: message.id }),
  });

  if (ticket.assigneeId) {
    await queueNotification({
      orgId,
      ticketId,
      ticketCode: ticket.code,
      ticketSubject: ticket.subject,
      userId: ticket.assigneeId,
      title: "Customer Replied By Email",
      message: `Ticket #${ticket.code} received a customer email reply.`,
    });
  } else {
    await alertOrgAdmins(orgId, ticketId, ticket.code, ticket.subject, "Customer Email Reply", `Ticket #${ticket.code} received a customer email reply.`);
  }

  return "processed";
}
