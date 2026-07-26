CREATE TYPE "public"."pledge_status" AS ENUM('open', 'cancelled');--> statement-breakpoint
CREATE TABLE "pledges" (
	"id" uuid PRIMARY KEY NOT NULL,
	"organization_id" uuid NOT NULL,
	"devotee_id" uuid,
	"campaign_id" uuid,
	"donor_name" text NOT NULL,
	"amount" numeric(12, 2) NOT NULL,
	"currency" "currency" NOT NULL,
	"pledged_on" date NOT NULL,
	"due_date" date,
	"note" text,
	"status" "pledge_status" DEFAULT 'open' NOT NULL,
	"cancel_reason" text,
	"recorded_by_user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "donations" ADD COLUMN "pledge_id" uuid;--> statement-breakpoint
ALTER TABLE "pledges" ADD CONSTRAINT "pledges_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pledges" ADD CONSTRAINT "pledges_devotee_id_devotees_id_fk" FOREIGN KEY ("devotee_id") REFERENCES "public"."devotees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pledges" ADD CONSTRAINT "pledges_campaign_id_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaigns"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "pledges_org_status_idx" ON "pledges" USING btree ("organization_id","status");--> statement-breakpoint
CREATE INDEX "pledges_devotee_idx" ON "pledges" USING btree ("devotee_id");--> statement-breakpoint
CREATE INDEX "pledges_org_due_idx" ON "pledges" USING btree ("organization_id","due_date");--> statement-breakpoint
ALTER TABLE "donations" ADD CONSTRAINT "donations_pledge_id_pledges_id_fk" FOREIGN KEY ("pledge_id") REFERENCES "public"."pledges"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "donations_pledge_idx" ON "donations" USING btree ("pledge_id");