CREATE TYPE "public"."devotee_status" AS ENUM('active', 'archived');--> statement-breakpoint
CREATE TYPE "public"."gender" AS ENUM('male', 'female', 'other');--> statement-breakpoint
CREATE TABLE "devotees" (
	"id" uuid PRIMARY KEY NOT NULL,
	"organization_id" uuid NOT NULL,
	"family_id" uuid,
	"full_name" text NOT NULL,
	"email" text,
	"phone" text,
	"gender" "gender",
	"date_of_birth" date,
	"address_line1" text,
	"city" text,
	"state" text,
	"postal_code" text,
	"notes" text,
	"status" "devotee_status" DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "families" (
	"id" uuid PRIMARY KEY NOT NULL,
	"organization_id" uuid NOT NULL,
	"name" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "devotees" ADD CONSTRAINT "devotees_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "devotees" ADD CONSTRAINT "devotees_family_id_families_id_fk" FOREIGN KEY ("family_id") REFERENCES "public"."families"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "families" ADD CONSTRAINT "families_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "devotees_org_name_idx" ON "devotees" USING btree ("organization_id","full_name");--> statement-breakpoint
CREATE INDEX "devotees_org_status_idx" ON "devotees" USING btree ("organization_id","status");--> statement-breakpoint
CREATE INDEX "devotees_family_idx" ON "devotees" USING btree ("family_id");--> statement-breakpoint
CREATE INDEX "families_org_name_idx" ON "families" USING btree ("organization_id","name");