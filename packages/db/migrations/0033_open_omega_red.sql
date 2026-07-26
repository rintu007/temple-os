CREATE TYPE "public"."grant_status" AS ENUM('active', 'closed');--> statement-breakpoint
CREATE TABLE "grants" (
	"id" uuid PRIMARY KEY NOT NULL,
	"organization_id" uuid NOT NULL,
	"funder" text NOT NULL,
	"title" text NOT NULL,
	"reference" text,
	"sanctioned_amount" numeric(14, 2) NOT NULL,
	"sanctioned_on" date,
	"purpose" text,
	"status" "grant_status" DEFAULT 'active' NOT NULL,
	"note" text,
	"recorded_by_user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "donations" ADD COLUMN "grant_id" uuid;--> statement-breakpoint
ALTER TABLE "expenses" ADD COLUMN "grant_id" uuid;--> statement-breakpoint
ALTER TABLE "grants" ADD CONSTRAINT "grants_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "grants_org_status_idx" ON "grants" USING btree ("organization_id","status");--> statement-breakpoint
ALTER TABLE "donations" ADD CONSTRAINT "donations_grant_id_grants_id_fk" FOREIGN KEY ("grant_id") REFERENCES "public"."grants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_grant_id_grants_id_fk" FOREIGN KEY ("grant_id") REFERENCES "public"."grants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "donations_grant_idx" ON "donations" USING btree ("grant_id");--> statement-breakpoint
CREATE INDEX "expenses_grant_idx" ON "expenses" USING btree ("grant_id");