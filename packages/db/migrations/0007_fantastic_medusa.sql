CREATE TYPE "public"."puja_booking_status" AS ENUM('pending', 'confirmed', 'completed', 'cancelled');--> statement-breakpoint
CREATE TABLE "puja_bookings" (
	"id" uuid PRIMARY KEY NOT NULL,
	"organization_id" uuid NOT NULL,
	"puja_type_id" uuid,
	"puja_name" text NOT NULL,
	"devotee_id" uuid,
	"devotee_name" text NOT NULL,
	"email" text,
	"phone" text,
	"amount" numeric(12, 2) NOT NULL,
	"currency" "currency" NOT NULL,
	"preferred_date" date,
	"note" text,
	"status" "puja_booking_status" DEFAULT 'pending' NOT NULL,
	"provider" text,
	"provider_order_id" text,
	"provider_payment_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "puja_types" (
	"id" uuid PRIMARY KEY NOT NULL,
	"organization_id" uuid NOT NULL,
	"temple_id" uuid,
	"name" text NOT NULL,
	"description" text,
	"price" numeric(12, 2) NOT NULL,
	"currency" "currency" NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "puja_bookings" ADD CONSTRAINT "puja_bookings_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "puja_bookings" ADD CONSTRAINT "puja_bookings_puja_type_id_puja_types_id_fk" FOREIGN KEY ("puja_type_id") REFERENCES "public"."puja_types"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "puja_bookings" ADD CONSTRAINT "puja_bookings_devotee_id_devotees_id_fk" FOREIGN KEY ("devotee_id") REFERENCES "public"."devotees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "puja_types" ADD CONSTRAINT "puja_types_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "puja_types" ADD CONSTRAINT "puja_types_temple_id_temples_id_fk" FOREIGN KEY ("temple_id") REFERENCES "public"."temples"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "puja_bookings_org_status_idx" ON "puja_bookings" USING btree ("organization_id","status");--> statement-breakpoint
CREATE INDEX "puja_bookings_provider_order_idx" ON "puja_bookings" USING btree ("provider_order_id");--> statement-breakpoint
CREATE INDEX "puja_types_org_idx" ON "puja_types" USING btree ("organization_id");