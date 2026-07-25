CREATE TYPE "public"."darshan_token_status" AS ENUM('booked', 'used', 'cancelled');--> statement-breakpoint
CREATE TABLE "darshan_slots" (
	"id" uuid PRIMARY KEY NOT NULL,
	"organization_id" uuid NOT NULL,
	"temple_id" uuid,
	"name" text NOT NULL,
	"slot_date" date NOT NULL,
	"start_time" time NOT NULL,
	"end_time" time,
	"capacity" integer NOT NULL,
	"note" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "darshan_tokens" (
	"id" uuid PRIMARY KEY NOT NULL,
	"organization_id" uuid NOT NULL,
	"slot_id" uuid NOT NULL,
	"token_number" integer NOT NULL,
	"devotee_name" text NOT NULL,
	"phone" text,
	"email" text,
	"party_size" integer DEFAULT 1 NOT NULL,
	"status" "darshan_token_status" DEFAULT 'booked' NOT NULL,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "darshan_slots" ADD CONSTRAINT "darshan_slots_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "darshan_slots" ADD CONSTRAINT "darshan_slots_temple_id_temples_id_fk" FOREIGN KEY ("temple_id") REFERENCES "public"."temples"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "darshan_tokens" ADD CONSTRAINT "darshan_tokens_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "darshan_tokens" ADD CONSTRAINT "darshan_tokens_slot_id_darshan_slots_id_fk" FOREIGN KEY ("slot_id") REFERENCES "public"."darshan_slots"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "darshan_slots_org_date_idx" ON "darshan_slots" USING btree ("organization_id","slot_date");--> statement-breakpoint
CREATE INDEX "darshan_tokens_slot_idx" ON "darshan_tokens" USING btree ("slot_id","status");