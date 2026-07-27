CREATE TYPE "public"."loan_direction" AS ENUM('given', 'taken');--> statement-breakpoint
CREATE TYPE "public"."loan_status" AS ENUM('active', 'closed', 'written_off');--> statement-breakpoint
CREATE TABLE "loan_repayments" (
	"id" uuid PRIMARY KEY NOT NULL,
	"organization_id" uuid NOT NULL,
	"loan_id" uuid NOT NULL,
	"amount" numeric(14, 2) NOT NULL,
	"paid_on" date NOT NULL,
	"note" text,
	"recorded_by_user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "loans" (
	"id" uuid PRIMARY KEY NOT NULL,
	"organization_id" uuid NOT NULL,
	"direction" "loan_direction" NOT NULL,
	"counterparty" text NOT NULL,
	"employee_id" uuid,
	"title" text,
	"principal" numeric(14, 2) NOT NULL,
	"interest_rate" numeric(6, 3),
	"disbursed_on" date NOT NULL,
	"due_on" date,
	"status" "loan_status" DEFAULT 'active' NOT NULL,
	"note" text,
	"recorded_by_user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "loan_repayments" ADD CONSTRAINT "loan_repayments_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "loan_repayments" ADD CONSTRAINT "loan_repayments_loan_id_loans_id_fk" FOREIGN KEY ("loan_id") REFERENCES "public"."loans"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "loans" ADD CONSTRAINT "loans_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "loans" ADD CONSTRAINT "loans_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "loan_repayments_loan_idx" ON "loan_repayments" USING btree ("loan_id","paid_on");--> statement-breakpoint
CREATE INDEX "loans_org_status_idx" ON "loans" USING btree ("organization_id","status");--> statement-breakpoint
CREATE INDEX "loans_employee_idx" ON "loans" USING btree ("employee_id");--> statement-breakpoint
CREATE INDEX "loans_org_due_idx" ON "loans" USING btree ("organization_id","due_on");