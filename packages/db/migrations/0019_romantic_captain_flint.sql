CREATE TYPE "public"."asset_category" AS ENUM('jewelry', 'vessels', 'idols', 'land', 'building', 'vehicle', 'furniture', 'electronics', 'other');--> statement-breakpoint
CREATE TYPE "public"."asset_status" AS ENUM('active', 'disposed');--> statement-breakpoint
CREATE TABLE "assets" (
	"id" uuid PRIMARY KEY NOT NULL,
	"organization_id" uuid NOT NULL,
	"temple_id" uuid,
	"name" text NOT NULL,
	"category" "asset_category" NOT NULL,
	"description" text,
	"quantity" integer DEFAULT 1 NOT NULL,
	"estimated_value" numeric(14, 2),
	"currency" "currency" NOT NULL,
	"acquired_on" date,
	"location" text,
	"status" "asset_status" DEFAULT 'active' NOT NULL,
	"disposal_reason" text,
	"note" text,
	"recorded_by_user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "assets" ADD CONSTRAINT "assets_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assets" ADD CONSTRAINT "assets_temple_id_temples_id_fk" FOREIGN KEY ("temple_id") REFERENCES "public"."temples"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "assets_org_status_idx" ON "assets" USING btree ("organization_id","status");