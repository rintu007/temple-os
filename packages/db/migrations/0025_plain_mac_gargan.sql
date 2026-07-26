CREATE TYPE "public"."broadcast_segment" AS ENUM('all', 'donors', 'members');--> statement-breakpoint
CREATE TYPE "public"."broadcast_status" AS ENUM('sent', 'partial', 'failed');--> statement-breakpoint
CREATE TABLE "broadcasts" (
	"id" uuid PRIMARY KEY NOT NULL,
	"organization_id" uuid NOT NULL,
	"subject" text NOT NULL,
	"message" text NOT NULL,
	"segment" "broadcast_segment" NOT NULL,
	"recipient_count" integer NOT NULL,
	"sent_count" integer NOT NULL,
	"failed_count" integer NOT NULL,
	"status" "broadcast_status" NOT NULL,
	"sent_by_user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "broadcasts" ADD CONSTRAINT "broadcasts_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "broadcasts_org_created_idx" ON "broadcasts" USING btree ("organization_id","created_at");