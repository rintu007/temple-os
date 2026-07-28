CREATE TABLE "recurring_donations" (
	"id" uuid PRIMARY KEY NOT NULL,
	"organization_id" uuid NOT NULL,
	"devotee_id" uuid,
	"donor_name" text NOT NULL,
	"amount" numeric(12, 2) NOT NULL,
	"frequency" "recurring_frequency" NOT NULL,
	"fund_id" uuid,
	"start_date" date NOT NULL,
	"end_date" date,
	"status" "recurring_status" DEFAULT 'active' NOT NULL,
	"note" text,
	"recorded_by_user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "donations" ADD COLUMN "recurring_donation_id" uuid;--> statement-breakpoint
ALTER TABLE "recurring_donations" ADD CONSTRAINT "recurring_donations_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recurring_donations" ADD CONSTRAINT "recurring_donations_devotee_id_devotees_id_fk" FOREIGN KEY ("devotee_id") REFERENCES "public"."devotees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recurring_donations" ADD CONSTRAINT "recurring_donations_fund_id_funds_id_fk" FOREIGN KEY ("fund_id") REFERENCES "public"."funds"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "recurring_donations_org_status_idx" ON "recurring_donations" USING btree ("organization_id","status");--> statement-breakpoint
ALTER TABLE "donations" ADD CONSTRAINT "donations_recurring_donation_id_recurring_donations_id_fk" FOREIGN KEY ("recurring_donation_id") REFERENCES "public"."recurring_donations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "donations_recurring_donation_idx" ON "donations" USING btree ("recurring_donation_id");