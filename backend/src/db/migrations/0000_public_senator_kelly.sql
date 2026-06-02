DO $$ BEGIN
 CREATE TYPE "public"."job_status" AS ENUM('pending', 'processing', 'completed', 'failed');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."message_role" AS ENUM('client', 'agent', 'system');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."sla_state" AS ENUM('on-track', 'at-risk', 'breached');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."ticket_priority" AS ENUM('low', 'normal', 'high', 'urgent');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."ticket_status" AS ENUM('new', 'open', 'pending', 'resolved', 'closed');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."user_role" AS ENUM('admin', 'agent', 'client_user');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "agent_team_mapping" (
	"agent_id" uuid NOT NULL,
	"team_id" uuid NOT NULL,
	"is_lead" boolean DEFAULT false,
	CONSTRAINT "agent_team_mapping_agent_id_team_id_pk" PRIMARY KEY("agent_id","team_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "clients" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"name" varchar(150) NOT NULL,
	"domain" varchar(100),
	"sla_policy_id" uuid,
	"client_tier" varchar(50) DEFAULT 'trial' NOT NULL,
	"owner_id" uuid,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "clients_name_org_unique" UNIQUE("org_id","name")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"queue_name" varchar(50) NOT NULL,
	"payload" text NOT NULL,
	"status" "job_status" DEFAULT 'pending' NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"max_attempts" integer DEFAULT 3 NOT NULL,
	"error_message" text,
	"run_at" timestamp with time zone DEFAULT now(),
	"locked_until" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "kb_articles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"title" varchar(255) NOT NULL,
	"category" varchar(100) NOT NULL,
	"content" text NOT NULL,
	"is_published" boolean DEFAULT false,
	"author_id" uuid,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "kb_embeddings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"kb_article_id" uuid NOT NULL,
	"chunk_index" integer NOT NULL,
	"content_chunk" text NOT NULL,
	"embedding" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "kb_embeddings_article_chunk_unique" UNIQUE("kb_article_id","chunk_index")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "organizations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(150) NOT NULL,
	"subdomain" varchar(100) NOT NULL,
	"subscription_tier" varchar(50) DEFAULT 'trial' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "organizations_subdomain_unique" UNIQUE("subdomain")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "sla_policies" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"name" varchar(100) NOT NULL,
	"description" text,
	"is_default" boolean DEFAULT false,
	"business_hours_start" time DEFAULT '09:00:00',
	"business_hours_end" time DEFAULT '18:00:00',
	"business_days" varchar(10)[],
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "sla_policies_name_org_unique" UNIQUE("org_id","name")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "sla_targets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"sla_policy_id" uuid NOT NULL,
	"priority" "ticket_priority" NOT NULL,
	"response_time_hours" integer NOT NULL,
	"resolution_time_hours" integer NOT NULL,
	"escalate_after_hours" integer NOT NULL,
	CONSTRAINT "sla_targets_policy_priority_unique" UNIQUE("sla_policy_id","priority")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "teams" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"name" varchar(100) NOT NULL,
	"description" text,
	"created_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "teams_name_org_unique" UNIQUE("org_id","name")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "ticket_assignment_rules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"name" varchar(100) NOT NULL,
	"priority_order" integer NOT NULL,
	"criteria_field" varchar(50) NOT NULL,
	"criteria_value" varchar(255) NOT NULL,
	"target_team_id" uuid,
	"target_agent_id" uuid,
	"assignment_mode" varchar(50) DEFAULT 'direct' NOT NULL,
	"is_active" boolean DEFAULT true,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "assignment_rules_priority_org_unique" UNIQUE("org_id","priority_order")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "ticket_attachments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"message_id" uuid NOT NULL,
	"file_name" varchar(255) NOT NULL,
	"file_size" integer NOT NULL,
	"file_path" varchar(512) NOT NULL,
	"mime_type" varchar(100),
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "ticket_audit_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"ticket_id" uuid NOT NULL,
	"actor_id" uuid,
	"action" varchar(100) NOT NULL,
	"previous_value" text,
	"new_value" text,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "ticket_feedback" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"ticket_id" uuid NOT NULL,
	"rating" integer NOT NULL,
	"comment" text,
	"created_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "ticket_feedback_ticket_unique" UNIQUE("ticket_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "ticket_merges" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"parent_ticket_id" uuid NOT NULL,
	"child_ticket_id" uuid NOT NULL,
	"merged_by_id" uuid NOT NULL,
	"merged_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "ticket_merges_child_unique" UNIQUE("child_ticket_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "ticket_messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"ticket_id" uuid NOT NULL,
	"sender_id" uuid NOT NULL,
	"sender_role" "message_role" NOT NULL,
	"body" text NOT NULL,
	"is_internal" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "tickets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"code" serial NOT NULL,
	"subject" varchar(255) NOT NULL,
	"description" text NOT NULL,
	"status" "ticket_status" DEFAULT 'new' NOT NULL,
	"priority" "ticket_priority" DEFAULT 'normal' NOT NULL,
	"workstream" varchar(100),
	"client_id" uuid NOT NULL,
	"requester_id" uuid NOT NULL,
	"assignee_id" uuid,
	"team_id" uuid,
	"sla_policy_id" uuid,
	"sla_state" "sla_state" DEFAULT 'on-track' NOT NULL,
	"sla_response_due_at" timestamp with time zone,
	"sla_resolution_due_at" timestamp with time zone,
	"first_responded_at" timestamp with time zone,
	"resolved_at" timestamp with time zone,
	"tags" varchar(50)[],
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "tickets_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"client_id" uuid,
	"email" varchar(255) NOT NULL,
	"password_hash" varchar(255) NOT NULL,
	"first_name" varchar(100) NOT NULL,
	"last_name" varchar(100) NOT NULL,
	"role" "user_role" DEFAULT 'client_user' NOT NULL,
	"job_title" varchar(100),
	"initials" varchar(4) NOT NULL,
	"is_active" boolean DEFAULT true,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "users_email_org_unique" UNIQUE("org_id","email")
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "agent_team_mapping" ADD CONSTRAINT "agent_team_mapping_agent_id_users_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "agent_team_mapping" ADD CONSTRAINT "agent_team_mapping_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "clients" ADD CONSTRAINT "clients_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "clients" ADD CONSTRAINT "clients_sla_policy_id_sla_policies_id_fk" FOREIGN KEY ("sla_policy_id") REFERENCES "public"."sla_policies"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "kb_articles" ADD CONSTRAINT "kb_articles_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "kb_articles" ADD CONSTRAINT "kb_articles_author_id_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "kb_embeddings" ADD CONSTRAINT "kb_embeddings_kb_article_id_kb_articles_id_fk" FOREIGN KEY ("kb_article_id") REFERENCES "public"."kb_articles"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "sla_policies" ADD CONSTRAINT "sla_policies_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "sla_targets" ADD CONSTRAINT "sla_targets_sla_policy_id_sla_policies_id_fk" FOREIGN KEY ("sla_policy_id") REFERENCES "public"."sla_policies"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "teams" ADD CONSTRAINT "teams_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "ticket_assignment_rules" ADD CONSTRAINT "ticket_assignment_rules_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "ticket_assignment_rules" ADD CONSTRAINT "ticket_assignment_rules_target_team_id_teams_id_fk" FOREIGN KEY ("target_team_id") REFERENCES "public"."teams"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "ticket_assignment_rules" ADD CONSTRAINT "ticket_assignment_rules_target_agent_id_users_id_fk" FOREIGN KEY ("target_agent_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "ticket_attachments" ADD CONSTRAINT "ticket_attachments_message_id_ticket_messages_id_fk" FOREIGN KEY ("message_id") REFERENCES "public"."ticket_messages"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "ticket_audit_logs" ADD CONSTRAINT "ticket_audit_logs_ticket_id_tickets_id_fk" FOREIGN KEY ("ticket_id") REFERENCES "public"."tickets"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "ticket_audit_logs" ADD CONSTRAINT "ticket_audit_logs_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "ticket_feedback" ADD CONSTRAINT "ticket_feedback_ticket_id_tickets_id_fk" FOREIGN KEY ("ticket_id") REFERENCES "public"."tickets"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "ticket_merges" ADD CONSTRAINT "ticket_merges_parent_ticket_id_tickets_id_fk" FOREIGN KEY ("parent_ticket_id") REFERENCES "public"."tickets"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "ticket_merges" ADD CONSTRAINT "ticket_merges_child_ticket_id_tickets_id_fk" FOREIGN KEY ("child_ticket_id") REFERENCES "public"."tickets"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "ticket_merges" ADD CONSTRAINT "ticket_merges_merged_by_id_users_id_fk" FOREIGN KEY ("merged_by_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "ticket_messages" ADD CONSTRAINT "ticket_messages_ticket_id_tickets_id_fk" FOREIGN KEY ("ticket_id") REFERENCES "public"."tickets"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "ticket_messages" ADD CONSTRAINT "ticket_messages_sender_id_users_id_fk" FOREIGN KEY ("sender_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "tickets" ADD CONSTRAINT "tickets_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "tickets" ADD CONSTRAINT "tickets_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "tickets" ADD CONSTRAINT "tickets_requester_id_users_id_fk" FOREIGN KEY ("requester_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "tickets" ADD CONSTRAINT "tickets_assignee_id_users_id_fk" FOREIGN KEY ("assignee_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "tickets" ADD CONSTRAINT "tickets_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "tickets" ADD CONSTRAINT "tickets_sla_policy_id_sla_policies_id_fk" FOREIGN KEY ("sla_policy_id") REFERENCES "public"."sla_policies"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "users" ADD CONSTRAINT "users_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "users" ADD CONSTRAINT "users_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_jobs_scheduler" ON "jobs" ("status","run_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_kb_articles_org" ON "kb_articles" ("org_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_assignment_rules_order" ON "ticket_assignment_rules" ("priority_order");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_attachments_message" ON "ticket_attachments" ("message_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_audit_ticket" ON "ticket_audit_logs" ("ticket_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_messages_ticket" ON "ticket_messages" ("ticket_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_tickets_org" ON "tickets" ("org_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_tickets_client" ON "tickets" ("client_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_tickets_requester" ON "tickets" ("requester_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_tickets_assignee" ON "tickets" ("assignee_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_tickets_status" ON "tickets" ("status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_tickets_priority" ON "tickets" ("priority");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_users_org" ON "users" ("org_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_users_client" ON "users" ("client_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_users_email" ON "users" ("email");