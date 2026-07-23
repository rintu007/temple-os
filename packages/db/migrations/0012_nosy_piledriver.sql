CREATE TABLE "priests" (
	"id" uuid PRIMARY KEY NOT NULL,
	"organization_id" uuid NOT NULL,
	"temple_id" uuid,
	"name" text NOT NULL,
	"phone" text,
	"specialty" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "puja_bookings" ADD COLUMN "priest_id" uuid;--> statement-breakpoint
ALTER TABLE "puja_bookings" ADD COLUMN "scheduled_on" date;--> statement-breakpoint
ALTER TABLE "puja_bookings" ADD COLUMN "scheduled_time" time;--> statement-breakpoint
ALTER TABLE "priests" ADD CONSTRAINT "priests_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "priests" ADD CONSTRAINT "priests_temple_id_temples_id_fk" FOREIGN KEY ("temple_id") REFERENCES "public"."temples"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "priests_org_idx" ON "priests" USING btree ("organization_id");--> statement-breakpoint
ALTER TABLE "puja_bookings" ADD CONSTRAINT "puja_bookings_priest_id_priests_id_fk" FOREIGN KEY ("priest_id") REFERENCES "public"."priests"("id") ON DELETE no action ON UPDATE no action;