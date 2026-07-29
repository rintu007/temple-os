CREATE TABLE "priest_duty_assignments" (
	"id" uuid PRIMARY KEY NOT NULL,
	"organization_id" uuid NOT NULL,
	"priest_id" uuid NOT NULL,
	"daily_schedule_id" uuid NOT NULL,
	"days_of_week" integer[] DEFAULT '{}' NOT NULL,
	"notes" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "priest_leaves" (
	"id" uuid PRIMARY KEY NOT NULL,
	"organization_id" uuid NOT NULL,
	"priest_id" uuid NOT NULL,
	"start_date" date NOT NULL,
	"end_date" date NOT NULL,
	"reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "priest_duty_assignments" ADD CONSTRAINT "priest_duty_assignments_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "priest_duty_assignments" ADD CONSTRAINT "priest_duty_assignments_priest_id_priests_id_fk" FOREIGN KEY ("priest_id") REFERENCES "public"."priests"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "priest_duty_assignments" ADD CONSTRAINT "priest_duty_assignments_daily_schedule_id_daily_schedules_id_fk" FOREIGN KEY ("daily_schedule_id") REFERENCES "public"."daily_schedules"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "priest_leaves" ADD CONSTRAINT "priest_leaves_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "priest_leaves" ADD CONSTRAINT "priest_leaves_priest_id_priests_id_fk" FOREIGN KEY ("priest_id") REFERENCES "public"."priests"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "priest_duty_assignments_org_idx" ON "priest_duty_assignments" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "priest_duty_assignments_priest_idx" ON "priest_duty_assignments" USING btree ("priest_id");--> statement-breakpoint
CREATE INDEX "priest_duty_assignments_schedule_idx" ON "priest_duty_assignments" USING btree ("daily_schedule_id");--> statement-breakpoint
CREATE INDEX "priest_leaves_org_idx" ON "priest_leaves" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "priest_leaves_priest_idx" ON "priest_leaves" USING btree ("priest_id");