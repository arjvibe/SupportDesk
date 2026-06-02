ALTER TABLE "ticket_attachments" ALTER COLUMN "message_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "ticket_attachments" ADD COLUMN "ticket_id" uuid;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "ticket_attachments" ADD CONSTRAINT "ticket_attachments_ticket_id_tickets_id_fk" FOREIGN KEY ("ticket_id") REFERENCES "public"."tickets"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_attachments_ticket" ON "ticket_attachments" ("ticket_id");