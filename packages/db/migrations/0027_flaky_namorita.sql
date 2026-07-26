CREATE TYPE "public"."expense_approval_status" AS ENUM('not_required', 'pending', 'approved', 'rejected');--> statement-breakpoint
ALTER TABLE "organizations" ADD COLUMN "expense_approval_threshold" numeric(12, 2);--> statement-breakpoint
ALTER TABLE "expenses" ADD COLUMN "approval_status" "expense_approval_status" DEFAULT 'not_required' NOT NULL;--> statement-breakpoint
ALTER TABLE "expenses" ADD COLUMN "approved_by_user_id" uuid;--> statement-breakpoint
ALTER TABLE "expenses" ADD COLUMN "decided_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "expenses" ADD COLUMN "rejection_reason" text;--> statement-breakpoint
CREATE INDEX "expenses_org_approval_idx" ON "expenses" USING btree ("organization_id","approval_status");