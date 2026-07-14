CREATE TABLE "daily_schedules" (
	"id" uuid PRIMARY KEY NOT NULL,
	"organization_id" uuid NOT NULL,
	"temple_id" uuid NOT NULL,
	"title" text NOT NULL,
	"start_time" time NOT NULL,
	"end_time" time,
	"description" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "daily_schedules" ADD CONSTRAINT "daily_schedules_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "daily_schedules" ADD CONSTRAINT "daily_schedules_temple_id_temples_id_fk" FOREIGN KEY ("temple_id") REFERENCES "public"."temples"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "daily_schedules_org_idx" ON "daily_schedules" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "daily_schedules_temple_idx" ON "daily_schedules" USING btree ("temple_id","start_time");