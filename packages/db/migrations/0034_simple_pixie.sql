CREATE TYPE "public"."seva_frequency" AS ENUM('weekly', 'monthly', 'quarterly', 'annual');--> statement-breakpoint
CREATE TYPE "public"."seva_status" AS ENUM('active', 'paused', 'ended');--> statement-breakpoint
CREATE TABLE "seva_subscriptions" (
	"id" uuid PRIMARY KEY NOT NULL,
	"organization_id" uuid NOT NULL,
	"temple_id" uuid,
	"devotee_id" uuid,
	"sponsor_name" text NOT NULL,
	"seva_name" text NOT NULL,
	"amount" numeric(12, 2) NOT NULL,
	"frequency" "seva_frequency" NOT NULL,
	"occasion" text,
	"start_date" date NOT NULL,
	"end_date" date,
	"status" "seva_status" DEFAULT 'active' NOT NULL,
	"note" text,
	"recorded_by_user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "donations" ADD COLUMN "seva_subscription_id" uuid;--> statement-breakpoint
ALTER TABLE "seva_subscriptions" ADD CONSTRAINT "seva_subscriptions_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "seva_subscriptions" ADD CONSTRAINT "seva_subscriptions_temple_id_temples_id_fk" FOREIGN KEY ("temple_id") REFERENCES "public"."temples"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "seva_subscriptions" ADD CONSTRAINT "seva_subscriptions_devotee_id_devotees_id_fk" FOREIGN KEY ("devotee_id") REFERENCES "public"."devotees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "seva_subscriptions_org_status_idx" ON "seva_subscriptions" USING btree ("organization_id","status");--> statement-breakpoint
CREATE INDEX "seva_subscriptions_devotee_idx" ON "seva_subscriptions" USING btree ("devotee_id");--> statement-breakpoint
ALTER TABLE "donations" ADD CONSTRAINT "donations_seva_subscription_id_seva_subscriptions_id_fk" FOREIGN KEY ("seva_subscription_id") REFERENCES "public"."seva_subscriptions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "donations_seva_idx" ON "donations" USING btree ("seva_subscription_id");