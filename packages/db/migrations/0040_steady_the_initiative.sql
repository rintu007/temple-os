CREATE TYPE "public"."recurring_frequency" AS ENUM('weekly', 'monthly', 'quarterly', 'annual');--> statement-breakpoint
CREATE TYPE "public"."recurring_status" AS ENUM('active', 'paused', 'ended');--> statement-breakpoint
CREATE TABLE "recurring_expenses" (
	"id" uuid PRIMARY KEY NOT NULL,
	"organization_id" uuid NOT NULL,
	"payee" text NOT NULL,
	"description" text,
	"category" text,
	"amount" numeric(12, 2) NOT NULL,
	"frequency" "recurring_frequency" NOT NULL,
	"account_id" uuid,
	"start_date" date NOT NULL,
	"end_date" date,
	"status" "recurring_status" DEFAULT 'active' NOT NULL,
	"note" text,
	"recorded_by_user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "expenses" ADD COLUMN "recurring_expense_id" uuid;--> statement-breakpoint
ALTER TABLE "recurring_expenses" ADD CONSTRAINT "recurring_expenses_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recurring_expenses" ADD CONSTRAINT "recurring_expenses_account_id_financial_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."financial_accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "recurring_expenses_org_status_idx" ON "recurring_expenses" USING btree ("organization_id","status");--> statement-breakpoint
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_recurring_expense_id_recurring_expenses_id_fk" FOREIGN KEY ("recurring_expense_id") REFERENCES "public"."recurring_expenses"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "expenses_recurring_idx" ON "expenses" USING btree ("recurring_expense_id");