CREATE TYPE "inbound_email_status" AS ENUM ('received', 'processed', 'ignored', 'failed', 'quarantined');--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "support_mailboxes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"email_address" varchar(255) NOT NULL,
	"provider" varchar(50) DEFAULT 'dev' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"default_client_id" uuid,
	"default_team_id" uuid,
	"default_priority" "ticket_priority" DEFAULT 'normal' NOT NULL,
	"unknown_sender_policy" varchar(50) DEFAULT 'quarantine' NOT NULL,
	"reply_behavior" varchar(50) DEFAULT 'reopen_resolved' NOT NULL,
	"auto_ack_enabled" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "support_mailboxes_email_unique" UNIQUE("email_address")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "inbound_emails" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"mailbox_id" uuid,
	"provider" varchar(50) NOT NULL,
	"provider_message_id" varchar(255) NOT NULL,
	"from_email" varchar(255) NOT NULL,
	"from_name" varchar(255),
	"to_email" varchar(255) NOT NULL,
	"cc" text,
	"subject" varchar(255) NOT NULL,
	"text_body" text,
	"html_body" text,
	"raw_payload" jsonb,
	"status" "inbound_email_status" DEFAULT 'received' NOT NULL,
	"ticket_id" uuid,
	"error_message" text,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "inbound_emails_provider_message_unique" UNIQUE("provider","provider_message_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "ticket_email_threads" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"ticket_id" uuid NOT NULL,
	"inbound_email_id" uuid,
	"message_id_header" varchar(512),
	"in_reply_to_header" varchar(512),
	"references_header" text,
	"subject_fingerprint" varchar(255),
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "support_mailboxes" ADD CONSTRAINT "support_mailboxes_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "support_mailboxes" ADD CONSTRAINT "support_mailboxes_default_client_id_clients_id_fk" FOREIGN KEY ("default_client_id") REFERENCES "clients"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "support_mailboxes" ADD CONSTRAINT "support_mailboxes_default_team_id_teams_id_fk" FOREIGN KEY ("default_team_id") REFERENCES "teams"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "inbound_emails" ADD CONSTRAINT "inbound_emails_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "inbound_emails" ADD CONSTRAINT "inbound_emails_mailbox_id_support_mailboxes_id_fk" FOREIGN KEY ("mailbox_id") REFERENCES "support_mailboxes"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "inbound_emails" ADD CONSTRAINT "inbound_emails_ticket_id_tickets_id_fk" FOREIGN KEY ("ticket_id") REFERENCES "tickets"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "ticket_email_threads" ADD CONSTRAINT "ticket_email_threads_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "ticket_email_threads" ADD CONSTRAINT "ticket_email_threads_ticket_id_tickets_id_fk" FOREIGN KEY ("ticket_id") REFERENCES "tickets"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "ticket_email_threads" ADD CONSTRAINT "ticket_email_threads_inbound_email_id_inbound_emails_id_fk" FOREIGN KEY ("inbound_email_id") REFERENCES "inbound_emails"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_support_mailboxes_org" ON "support_mailboxes" ("org_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_inbound_emails_org" ON "inbound_emails" ("org_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_inbound_emails_mailbox" ON "inbound_emails" ("mailbox_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_inbound_emails_status" ON "inbound_emails" ("status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_ticket_email_threads_org" ON "ticket_email_threads" ("org_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_ticket_email_threads_ticket" ON "ticket_email_threads" ("ticket_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_ticket_email_threads_message_id" ON "ticket_email_threads" ("message_id_header");
