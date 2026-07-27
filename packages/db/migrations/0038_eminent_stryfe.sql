CREATE TYPE "public"."investment_status" AS ENUM('active', 'matured', 'closed');--> statement-breakpoint
CREATE TYPE "public"."investment_type" AS ENUM('fixed_deposit', 'recurring_deposit', 'bond', 'mutual_fund', 'other');--> statement-breakpoint
CREATE TABLE "investments" (
	"id" uuid PRIMARY KEY NOT NULL,
	"organization_id" uuid NOT NULL,
	"fund_id" uuid,
	"institution" text NOT NULL,
	"type" "investment_type" DEFAULT 'fixed_deposit' NOT NULL,
	"reference" text,
	"principal" numeric(14, 2) NOT NULL,
	"interest_rate" numeric(6, 3),
	"invested_on" date NOT NULL,
	"maturity_date" date,
	"maturity_value" numeric(14, 2),
	"status" "investment_status" DEFAULT 'active' NOT NULL,
	"note" text,
	"recorded_by_user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "investments" ADD CONSTRAINT "investments_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "investments" ADD CONSTRAINT "investments_fund_id_funds_id_fk" FOREIGN KEY ("fund_id") REFERENCES "public"."funds"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "investments_org_status_idx" ON "investments" USING btree ("organization_id","status");--> statement-breakpoint
CREATE INDEX "investments_fund_idx" ON "investments" USING btree ("fund_id");--> statement-breakpoint
CREATE INDEX "investments_org_maturity_idx" ON "investments" USING btree ("organization_id","maturity_date");