CREATE TYPE "public"."prasadam_meal" AS ENUM('breakfast', 'lunch', 'dinner', 'prasadam');--> statement-breakpoint
CREATE TABLE "prasadam_sessions" (
	"id" uuid PRIMARY KEY NOT NULL,
	"organization_id" uuid NOT NULL,
	"temple_id" uuid,
	"served_on" date NOT NULL,
	"meal" "prasadam_meal" NOT NULL,
	"served_count" integer DEFAULT 0 NOT NULL,
	"sponsor_name" text,
	"sponsor_donation_id" uuid,
	"note" text,
	"recorded_by_user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "prasadam_sessions" ADD CONSTRAINT "prasadam_sessions_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prasadam_sessions" ADD CONSTRAINT "prasadam_sessions_temple_id_temples_id_fk" FOREIGN KEY ("temple_id") REFERENCES "public"."temples"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prasadam_sessions" ADD CONSTRAINT "prasadam_sessions_sponsor_donation_id_donations_id_fk" FOREIGN KEY ("sponsor_donation_id") REFERENCES "public"."donations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "prasadam_sessions_org_date_idx" ON "prasadam_sessions" USING btree ("organization_id","served_on");