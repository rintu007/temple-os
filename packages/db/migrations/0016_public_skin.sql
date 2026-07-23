CREATE TYPE "public"."facility_booking_status" AS ENUM('requested', 'confirmed', 'cancelled');--> statement-breakpoint
CREATE TABLE "facilities" (
	"id" uuid PRIMARY KEY NOT NULL,
	"organization_id" uuid NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"capacity" integer,
	"rent_amount" numeric(12, 2) NOT NULL,
	"currency" "currency" NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "facility_bookings" (
	"id" uuid PRIMARY KEY NOT NULL,
	"organization_id" uuid NOT NULL,
	"facility_id" uuid NOT NULL,
	"facility_name" text NOT NULL,
	"booker_name" text NOT NULL,
	"phone" text,
	"email" text,
	"event_date" date NOT NULL,
	"purpose" text,
	"amount" numeric(12, 2) NOT NULL,
	"currency" "currency" NOT NULL,
	"status" "facility_booking_status" DEFAULT 'requested' NOT NULL,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "facilities" ADD CONSTRAINT "facilities_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "facility_bookings" ADD CONSTRAINT "facility_bookings_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "facility_bookings" ADD CONSTRAINT "facility_bookings_facility_id_facilities_id_fk" FOREIGN KEY ("facility_id") REFERENCES "public"."facilities"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "facilities_org_idx" ON "facilities" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "facility_bookings_org_status_idx" ON "facility_bookings" USING btree ("organization_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "facility_bookings_confirmed_slot_uq" ON "facility_bookings" USING btree ("facility_id","event_date") WHERE "facility_bookings"."status" = 'confirmed';