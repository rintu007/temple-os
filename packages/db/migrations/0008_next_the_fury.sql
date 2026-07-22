CREATE TYPE "public"."subscription_status" AS ENUM('pending', 'active', 'cancelled');--> statement-breakpoint
CREATE TABLE "membership_plans" (
	"id" uuid PRIMARY KEY NOT NULL,
	"organization_id" uuid NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"price" numeric(12, 2) NOT NULL,
	"currency" "currency" NOT NULL,
	"duration_months" integer NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "membership_subscriptions" (
	"id" uuid PRIMARY KEY NOT NULL,
	"organization_id" uuid NOT NULL,
	"plan_id" uuid,
	"plan_name" text NOT NULL,
	"devotee_id" uuid,
	"member_name" text NOT NULL,
	"email" text,
	"phone" text,
	"amount" numeric(12, 2) NOT NULL,
	"currency" "currency" NOT NULL,
	"starts_on" date,
	"expires_on" date,
	"status" "subscription_status" DEFAULT 'pending' NOT NULL,
	"provider" text,
	"provider_order_id" text,
	"provider_payment_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "membership_plans" ADD CONSTRAINT "membership_plans_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "membership_subscriptions" ADD CONSTRAINT "membership_subscriptions_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "membership_subscriptions" ADD CONSTRAINT "membership_subscriptions_plan_id_membership_plans_id_fk" FOREIGN KEY ("plan_id") REFERENCES "public"."membership_plans"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "membership_subscriptions" ADD CONSTRAINT "membership_subscriptions_devotee_id_devotees_id_fk" FOREIGN KEY ("devotee_id") REFERENCES "public"."devotees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "membership_plans_org_idx" ON "membership_plans" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "membership_subs_org_status_idx" ON "membership_subscriptions" USING btree ("organization_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "membership_subs_provider_order_uq" ON "membership_subscriptions" USING btree ("provider_order_id");