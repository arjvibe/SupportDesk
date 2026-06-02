ALTER TABLE "tickets" DROP CONSTRAINT "tickets_code_unique";--> statement-breakpoint
ALTER TABLE "tickets" ALTER COLUMN "code" SET DATA TYPE integer;--> statement-breakpoint
ALTER TABLE "tickets" ALTER COLUMN "code" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "organizations" ADD COLUMN "ticket_counter" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
UPDATE "organizations" o SET "ticket_counter" = COALESCE((SELECT MAX("code") FROM "tickets" t WHERE t."org_id" = o."id"), 0);--> statement-breakpoint
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_org_id_code_unique" UNIQUE("org_id","code");