CREATE TYPE "public"."account_type" AS ENUM('bank', 'cash');--> statement-breakpoint
CREATE TABLE "financial_accounts" (
	"id" uuid PRIMARY KEY NOT NULL,
	"organization_id" uuid NOT NULL,
	"name" text NOT NULL,
	"type" "account_type" DEFAULT 'bank' NOT NULL,
	"bank_name" text,
	"account_number" text,
	"opening_balance" numeric(12, 2) DEFAULT '0' NOT NULL,
	"opening_date" date,
	"note" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"recorded_by_user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "donations" ADD COLUMN "account_id" uuid;--> statement-breakpoint
ALTER TABLE "expenses" ADD COLUMN "account_id" uuid;--> statement-breakpoint
ALTER TABLE "financial_accounts" ADD CONSTRAINT "financial_accounts_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "financial_accounts_org_active_idx" ON "financial_accounts" USING btree ("organization_id","is_active");--> statement-breakpoint
ALTER TABLE "donations" ADD CONSTRAINT "donations_account_id_financial_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."financial_accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_account_id_financial_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."financial_accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "donations_account_idx" ON "donations" USING btree ("account_id");--> statement-breakpoint
CREATE INDEX "expenses_account_idx" ON "expenses" USING btree ("account_id");