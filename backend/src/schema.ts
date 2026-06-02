import {
  pgTable,
  uuid,
  varchar,
  text,
  boolean,
  timestamp,
  pgEnum,
  integer,
  serial,
  time,
  customType,
  unique,
  primaryKey,
  index,
  jsonb,
} from "drizzle-orm/pg-core";

// =========================================================================
// CUSTOM TYPES & ENUMS
// =========================================================================

/**
 * Custom Drizzle mapping type for pgvector.
 * In local Postgres environments, it defaults to 'text' storing JSON stringified float arrays.
 * This is easily swappable to 'vector(1536)' once pgvector is installed in production.
 */
export const pgVector = customType<{ data: number[] }>({
  dataType() {
    return "text";
  },
  toDriver(value: number[]) {
    return JSON.stringify(value);
  },
  fromDriver(value: unknown) {
    return JSON.parse(value as string) as number[];
  },
});

/**
 * User roles in the workspace.
 * - admin: Full administrative control over the Org settings, SLAs, and teams.
 * - agent: Staff agent handling and triaging client tickets.
 * - client_user: External client contact submitting cases and viewing history.
 */
export const userRoleEnum = pgEnum("user_role", ["admin", "agent", "client_user"]);

/**
 * Ticket status progression states.
 */
export const ticketStatusEnum = pgEnum("ticket_status", ["new", "open", "pending", "resolved", "closed"]);

/**
 * Severity priorities for triage.
 */
export const ticketPriorityEnum = pgEnum("ticket_priority", ["low", "normal", "high", "urgent"]);

/**
 * SLA compliance state tracking.
 */
export const slaStateEnum = pgEnum("sla_state", ["on-track", "at-risk", "breached"]);

/**
 * Sender role types for audit context.
 */
export const messageRoleEnum = pgEnum("message_role", ["client", "agent", "system"]);

/**
 * Outbound job queue processor states.
 */
export const jobStatusEnum = pgEnum("job_status", ["pending", "processing", "completed", "failed"]);

/**
 * Processing state for inbound email ingestion.
 */
export const inboundEmailStatusEnum = pgEnum("inbound_email_status", ["received", "processed", "ignored", "failed", "quarantined"]);

// =========================================================================
// TABLES
// =========================================================================

/**
 * 0. Organizations (Tenants / Orgs)
 * Represents the host support organizations registered on the SaaS platform (e.g. Aura, Acme).
 * Serves as the primary data isolation boundary.
 */
export const organizations = pgTable("organizations", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: varchar("name", { length: 150 }).notNull(),
  subdomain: varchar("subdomain", { length: 100 }).notNull().unique(), // e.g. aura.localhost -> subdomain: "aura"
  subscriptionTier: varchar("subscription_tier", { length: 50 }).default("trial").notNull(), // trial, business, enterprise
  isActive: boolean("is_active").default(true).notNull(),
  ticketCounter: integer("ticket_counter").default(0).notNull(),
  logoUrl: text("logo_url"),
  primaryColor: varchar("primary_color", { length: 7 }),
  secondaryColor: varchar("secondary_color", { length: 7 }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

/**
 * 1. SLA Policies
 * Configured SLA parameters specific to an Org.
 */
export const slaPolicies = pgTable("sla_policies", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id").notNull().references(() => organizations.id, { onDelete: "cascade" }), // Tenant Org reference
  name: varchar("name", { length: 100 }).notNull(),
  description: text("description"),
  isDefault: boolean("is_default").default(false),
  businessHoursStart: time("business_hours_start").default("09:00:00"),
  businessHoursEnd: time("business_hours_end").default("18:00:00"),
  businessDays: varchar("business_days", { length: 10 }).array(), // e.g. ["1", "2", "3", "4", "5"] for Mon-Fri
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
}, (table) => ({
  uniquePolicyName: unique("sla_policies_name_org_unique").on(table.orgId, table.name),
}));

/**
 * 2. Clients (Customer Accounts)
 * Customer companies belonging to a specific Org (e.g. Maison Atelier under Aura).
 */
export const clients = pgTable("clients", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id").notNull().references(() => organizations.id, { onDelete: "cascade" }), // Host Org reference
  name: varchar("name", { length: 150 }).notNull(),
  domain: varchar("domain", { length: 100 }), // domain for auto-matching emails (e.g. maison-atelier.com)
  slaPolicyId: uuid("sla_policy_id").references(() => slaPolicies.id, { onDelete: "set null" }), // Specific client SLA policy
  clientTier: varchar("client_tier", { length: 50 }).default("trial").notNull(), // trial, business, enterprise
  ownerId: uuid("owner_id"), // Account Manager agent (raw UUID to prevent circular type references)
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
}, (table) => ({
  uniqueClientName: unique("clients_name_org_unique").on(table.orgId, table.name),
}));

/**
 * 3. Users
 * Members registered under an Org. 
 * - Agents/Admins have clientId = null (they represent host Org staff).
 * - Client Users have clientId referencing the client company they represent.
 */
export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id").notNull().references(() => organizations.id, { onDelete: "cascade" }), // Host Org reference
  clientId: uuid("client_id").references(() => clients.id, { onDelete: "set null" }), // Client Account reference (null for internal staff)
  email: varchar("email", { length: 255 }).notNull(),
  passwordHash: varchar("password_hash", { length: 255 }).notNull(),
  firstName: varchar("first_name", { length: 100 }).notNull(),
  lastName: varchar("last_name", { length: 100 }).notNull(),
  role: userRoleEnum("role").default("client_user").notNull(), // admin, agent, client_user
  jobTitle: varchar("job_title", { length: 100 }),
  initials: varchar("initials", { length: 4 }).notNull(), // initials for avatars (e.g. "MT")
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
}, (table) => ({
  uniqueUserEmail: unique("users_email_org_unique").on(table.orgId, table.email), // Email unique within the Org
  orgIdx: index("idx_users_org").on(table.orgId),
  clientIdx: index("idx_users_client").on(table.clientId),
  emailIdx: index("idx_users_email").on(table.email),
}));

/**
 * 4. Teams
 * Internal specialty support groups within an Org (e.g. Billing, Motion).
 */
export const teams = pgTable("teams", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id").notNull().references(() => organizations.id, { onDelete: "cascade" }), // Host Org reference
  name: varchar("name", { length: 100 }).notNull(),
  description: text("description"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
}, (table) => ({
  uniqueTeamName: unique("teams_name_org_unique").on(table.orgId, table.name),
}));

/**
 * 5. Agent-Team Mapping
 * Maps which agents belong to which support teams.
 */
export const agentTeamMapping = pgTable("agent_team_mapping", {
  agentId: uuid("agent_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  teamId: uuid("team_id").notNull().references(() => teams.id, { onDelete: "cascade" }),
  isLead: boolean("is_lead").default(false), // Indicates if they manage/lead this team
}, (table) => ({
  pk: primaryKey({ columns: [table.agentId, table.teamId] }),
}));

/**
 * 6. SLA Targets
 * Defines reaction/resolution times for each priority tier in an SLA policy.
 */
export const slaTargets = pgTable("sla_targets", {
  id: uuid("id").primaryKey().defaultRandom(),
  slaPolicyId: uuid("sla_policy_id").notNull().references(() => slaPolicies.id, { onDelete: "cascade" }),
  priority: ticketPriorityEnum("priority").notNull(),
  responseTimeHours: integer("response_time_hours").notNull(),
  resolutionTimeHours: integer("resolution_time_hours").notNull(),
  escalateAfterHours: integer("escalate_after_hours").notNull(),
}, (table) => ({
  uniquePolicyPriority: unique("sla_targets_policy_priority_unique").on(table.slaPolicyId, table.priority),
}));

/**
 * 7. Tickets
 * Support cases opened by clients and processed by agents.
 */
export const tickets = pgTable("tickets", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id").notNull().references(() => organizations.id, { onDelete: "cascade" }), // Host Org reference
  code: integer("code").notNull(), // User-friendly sequential ticket code (e.g. 101)
  subject: varchar("subject", { length: 255 }).notNull(),
  description: text("description").notNull(),
  status: ticketStatusEnum("status").default("new").notNull(),
  priority: ticketPriorityEnum("priority").default("normal").notNull(),
  workstream: varchar("workstream", { length: 100 }), // category/topic tag (e.g. billing)
  
  clientId: uuid("client_id").notNull().references(() => clients.id, { onDelete: "restrict" }), // Submitting Client reference
  requesterId: uuid("requester_id").notNull().references(() => users.id, { onDelete: "restrict" }), // Submitting user reference
  assigneeId: uuid("assignee_id").references(() => users.id, { onDelete: "set null" }), // Assigned agent
  teamId: uuid("team_id").references(() => teams.id, { onDelete: "set null" }), // Assigned support team
  
  slaPolicyId: uuid("sla_policy_id").references(() => slaPolicies.id, { onDelete: "set null" }),
  slaState: slaStateEnum("sla_state").default("on-track").notNull(),
  slaResponseDueAt: timestamp("sla_response_due_at", { withTimezone: true }),
  slaResolutionDueAt: timestamp("sla_resolution_due_at", { withTimezone: true }),
  firstRespondedAt: timestamp("first_responded_at", { withTimezone: true }),
  resolvedAt: timestamp("resolved_at", { withTimezone: true }),
  
  tags: varchar("tags", { length: 50 }).array(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
}, (table) => ({
  orgIdx: index("idx_tickets_org").on(table.orgId),
  clientIdx: index("idx_tickets_client").on(table.clientId),
  reqIdx: index("idx_tickets_requester").on(table.requesterId),
  assIdx: index("idx_tickets_assignee").on(table.assigneeId),
  statusIdx: index("idx_tickets_status").on(table.status),
  priorityIdx: index("idx_tickets_priority").on(table.priority),
  uniqueOrgCode: unique("tickets_org_id_code_unique").on(table.orgId, table.code),
}));

/**
 * 8. Ticket Messages
 * Communication logs inside a ticket (public replies and internal notes).
 */
export const ticketMessages = pgTable("ticket_messages", {
  id: uuid("id").primaryKey().defaultRandom(),
  ticketId: uuid("ticket_id").notNull().references(() => tickets.id, { onDelete: "cascade" }),
  senderId: uuid("sender_id").notNull().references(() => users.id, { onDelete: "restrict" }),
  senderRole: messageRoleEnum("sender_role").notNull(), // client, agent, system
  body: text("body").notNull(),
  isInternal: boolean("is_internal").default(false).notNull(), // True for agents-only notes
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
}, (table) => ({
  ticketIdx: index("idx_messages_ticket").on(table.ticketId),
}));

/**
 * 9. Ticket Attachments
 * Files uploaded to support messages.
 */
export const ticketAttachments = pgTable("ticket_attachments", {
  id: uuid("id").primaryKey().defaultRandom(),
  messageId: uuid("message_id").references(() => ticketMessages.id, { onDelete: "cascade" }),
  ticketId: uuid("ticket_id").references(() => tickets.id, { onDelete: "cascade" }),
  fileName: varchar("file_name", { length: 255 }).notNull(),
  fileSize: integer("file_size").notNull(),
  filePath: varchar("file_path", { length: 512 }).notNull(), // Storage URL/Path reference
  mimeType: varchar("mime_type", { length: 100 }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
}, (table) => ({
  msgIdx: index("idx_attachments_message").on(table.messageId),
  ticketIdx: index("idx_attachments_ticket").on(table.ticketId),
}));

/**
 * 10. Ticket Merges
 * Audit tracking when redundant tickets are merged.
 */
export const ticketMerges = pgTable("ticket_merges", {
  id: uuid("id").primaryKey().defaultRandom(),
  parentTicketId: uuid("parent_ticket_id").notNull().references(() => tickets.id, { onDelete: "cascade" }),
  childTicketId: uuid("child_ticket_id").notNull().references(() => tickets.id, { onDelete: "cascade" }),
  mergedById: uuid("merged_by_id").notNull().references(() => users.id, { onDelete: "restrict" }),
  mergedAt: timestamp("merged_at", { withTimezone: true }).defaultNow(),
}, (table) => ({
  uniqueChild: unique("ticket_merges_child_unique").on(table.childTicketId),
}));

/**
 * 11. Ticket Feedback
 * CSAT customer satisfaction ratings for resolved tickets.
 */
export const ticketFeedback = pgTable("ticket_feedback", {
  id: uuid("id").primaryKey().defaultRandom(),
  ticketId: uuid("ticket_id").notNull().references(() => tickets.id, { onDelete: "cascade" }),
  rating: integer("rating").notNull(), // Scale 1 to 5
  comment: text("comment"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
}, (table) => ({
  uniqueTicket: unique("ticket_feedback_ticket_unique").on(table.ticketId),
}));

/**
 * 12. Ticket Audit Logs
 * Granular modification logs for ticket state progression.
 */
export const ticketAuditLogs = pgTable("ticket_audit_logs", {
  id: uuid("id").primaryKey().defaultRandom(),
  ticketId: uuid("ticket_id").notNull().references(() => tickets.id, { onDelete: "cascade" }),
  actorId: uuid("actor_id").references(() => users.id, { onDelete: "set null" }), // User triggering modification
  action: varchar("action", { length: 100 }).notNull(), // e.g. "status_change"
  previousValue: text("previous_value"),
  newValue: text("new_value"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
}, (table) => ({
  ticketIdx: index("idx_audit_ticket").on(table.ticketId),
}));

/**
 * 13. KB Articles
 * Knowledge base articles scoped to an Org.
 */
export const kbArticles = pgTable("kb_articles", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id").notNull().references(() => organizations.id, { onDelete: "cascade" }), // Host Org reference
  title: varchar("title", { length: 255 }).notNull(),
  category: varchar("category", { length: 100 }).notNull(),
  content: text("content").notNull(),
  isPublished: boolean("is_published").default(false),
  authorId: uuid("author_id").references(() => users.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
}, (table) => ({
  orgIdx: index("idx_kb_articles_org").on(table.orgId),
}));

/**
 * 14. KB Embeddings
 * Chunked document vector embeddings used for AI RAG searches.
 */
export const kbEmbeddings = pgTable("kb_embeddings", {
  id: uuid("id").primaryKey().defaultRandom(),
  kbArticleId: uuid("kb_article_id").notNull().references(() => kbArticles.id, { onDelete: "cascade" }),
  chunkIndex: integer("chunk_index").notNull(),
  contentChunk: text("content_chunk").notNull(),
  embedding: pgVector("embedding").notNull(), // Vector array stored as text locally
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
}, (table) => ({
  uniqueArticleChunk: unique("kb_embeddings_article_chunk_unique").on(table.kbArticleId, table.chunkIndex),
}));

/**
 * 15. Ticket Assignment Rules
 * Round-robin or direct ticket routing rules.
 */
export const ticketAssignmentRules = pgTable("ticket_assignment_rules", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id").notNull().references(() => organizations.id, { onDelete: "cascade" }), // Host Org reference
  name: varchar("name", { length: 100 }).notNull(),
  priorityOrder: integer("priority_order").notNull(), // Sequential rule priority
  criteriaField: varchar("criteria_field", { length: 50 }).notNull(), // category, organization, priority
  criteriaValue: varchar("criteria_value", { length: 255 }).notNull(),
  targetTeamId: uuid("target_team_id").references(() => teams.id, { onDelete: "set null" }),
  targetAgentId: uuid("target_agent_id").references(() => users.id, { onDelete: "set null" }),
  assignmentMode: varchar("assignment_mode", { length: 50 }).default("direct").notNull(), // direct, round-robin
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
}, (table) => ({
  uniqueRulePriority: unique("assignment_rules_priority_org_unique").on(table.orgId, table.priorityOrder),
  orderIdx: index("idx_assignment_rules_order").on(table.priorityOrder),
}));

/**
 * 16. Background Jobs
 * Queue jobs table for atomic async background operations (outbound emails, Slack alerts, cron events).
 */
export const jobs = pgTable("jobs", {
  id: uuid("id").primaryKey().defaultRandom(),
  queueName: varchar("queue_name", { length: 50 }).notNull(), // email, slack, sla_checks
  payload: text("payload").notNull(), // Stringified JSON body
  status: jobStatusEnum("status").default("pending").notNull(), // pending, processing, completed, failed
  attempts: integer("attempts").default(0).notNull(),
  maxAttempts: integer("max_attempts").default(3).notNull(),
  errorMessage: text("error_message"),
  runAt: timestamp("run_at", { withTimezone: true }).defaultNow(),
  lockedUntil: timestamp("locked_until", { withTimezone: true }),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
}, (table) => ({
  statusRunIdx: index("idx_jobs_scheduler").on(table.status, table.runAt),
}));

/**
 * 17. Organization Notification Settings
 * Configures enabled channels and SMTP/Webhook credentials at the Org level.
 */
export const organizationNotificationSettings = pgTable("organization_notification_settings", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
  channel: varchar("channel", { length: 50 }).notNull(), // "email", "slack", "whatsapp", "in_app"
  enabled: boolean("enabled").default(true).notNull(),
  config: jsonb("config").$type<{
    host?: string;
    port?: number;
    user?: string;
    password?: string;
    secure?: boolean;
    fromEmail?: string;
    webhookUrl?: string;
    apiToken?: string;
    phoneId?: string;
  }>(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
}, (table) => ({
  orgChannelUnique: unique("org_channel_unique").on(table.orgId, table.channel),
}));

/**
 * 18. Support Mailboxes
 * Tenant-level inbound email channel configuration. Platform operators configure provider/DNS,
 * while org admins configure mailbox behavior and default routing in the app.
 */
export const supportMailboxes = pgTable("support_mailboxes", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
  emailAddress: varchar("email_address", { length: 255 }).notNull(),
  provider: varchar("provider", { length: 50 }).default("dev").notNull(),
  isActive: boolean("is_active").default(true).notNull(),
  defaultClientId: uuid("default_client_id").references(() => clients.id, { onDelete: "set null" }),
  defaultTeamId: uuid("default_team_id").references(() => teams.id, { onDelete: "set null" }),
  defaultPriority: ticketPriorityEnum("default_priority").default("normal").notNull(),
  unknownSenderPolicy: varchar("unknown_sender_policy", { length: 50 }).default("quarantine").notNull(),
  replyBehavior: varchar("reply_behavior", { length: 50 }).default("reopen_resolved").notNull(),
  autoAckEnabled: boolean("auto_ack_enabled").default(true).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
}, (table) => ({
  mailboxEmailUnique: unique("support_mailboxes_email_unique").on(table.emailAddress),
  orgIdx: index("idx_support_mailboxes_org").on(table.orgId),
}));

/**
 * 19. Inbound Emails
 * Durable processing log for provider webhooks and local test payloads.
 */
export const inboundEmails = pgTable("inbound_emails", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
  mailboxId: uuid("mailbox_id").references(() => supportMailboxes.id, { onDelete: "set null" }),
  provider: varchar("provider", { length: 50 }).notNull(),
  providerMessageId: varchar("provider_message_id", { length: 255 }).notNull(),
  fromEmail: varchar("from_email", { length: 255 }).notNull(),
  fromName: varchar("from_name", { length: 255 }),
  toEmail: varchar("to_email", { length: 255 }).notNull(),
  cc: text("cc"),
  subject: varchar("subject", { length: 255 }).notNull(),
  textBody: text("text_body"),
  htmlBody: text("html_body"),
  rawPayload: jsonb("raw_payload").$type<Record<string, unknown>>(),
  status: inboundEmailStatusEnum("status").default("received").notNull(),
  ticketId: uuid("ticket_id").references(() => tickets.id, { onDelete: "set null" }),
  errorMessage: text("error_message"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
}, (table) => ({
  providerMessageUnique: unique("inbound_emails_provider_message_unique").on(table.provider, table.providerMessageId),
  orgIdx: index("idx_inbound_emails_org").on(table.orgId),
  mailboxIdx: index("idx_inbound_emails_mailbox").on(table.mailboxId),
  statusIdx: index("idx_inbound_emails_status").on(table.status),
}));

/**
 * 20. Ticket Email Threads
 * Maps email headers/fingerprints to tickets so future replies land in the right conversation.
 */
export const ticketEmailThreads = pgTable("ticket_email_threads", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
  ticketId: uuid("ticket_id").notNull().references(() => tickets.id, { onDelete: "cascade" }),
  inboundEmailId: uuid("inbound_email_id").references(() => inboundEmails.id, { onDelete: "set null" }),
  messageIdHeader: varchar("message_id_header", { length: 512 }),
  inReplyToHeader: varchar("in_reply_to_header", { length: 512 }),
  referencesHeader: text("references_header"),
  subjectFingerprint: varchar("subject_fingerprint", { length: 255 }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
}, (table) => ({
  orgIdx: index("idx_ticket_email_threads_org").on(table.orgId),
  ticketIdx: index("idx_ticket_email_threads_ticket").on(table.ticketId),
  messageIdIdx: index("idx_ticket_email_threads_message_id").on(table.messageIdHeader),
}));

/**
 * 21. In-App Notifications
 * Persisted alerts shown to users in the workspace bell dropdown.
 */
export const inAppNotifications = pgTable("in_app_notifications", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  title: varchar("title", { length: 255 }).notNull(),
  message: text("message").notNull(),
  ticketId: uuid("ticket_id").references(() => tickets.id, { onDelete: "cascade" }),
  isRead: boolean("is_read").default(false).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
}, (table) => ({
  userReadIdx: index("idx_notifications_user_read").on(table.userId, table.isRead),
}));
