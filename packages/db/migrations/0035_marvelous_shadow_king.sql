CREATE TYPE "public"."in_kind_category" AS ENUM('gold', 'silver', 'jewellery', 'grain', 'cloth', 'other');--> statement-breakpoint
CREATE TYPE "public"."in_kind_disposition" AS ENUM('in_stock', 'sold', 'used', 'returned');--> statement-breakpoint
CREATE TABLE "in_kind_donations" (
	"id" uuid PRIMARY KEY NOT NULL,
	"organization_id" uuid NOT NULL,
	"temple_id" uuid,
	"devotee_id" uuid,
	"donor_name" text NOT NULL,
	"category" "in_kind_category" NOT NULL,
	"item" text NOT NULL,
	"quantity" numeric(14, 3),
	"unit" text,
	"estimated_value" numeric(14, 2),
	"currency" "currency" NOT NULL,
	"received_on" date NOT NULL,
	"disposition" "in_kind_disposition" DEFAULT 'in_stock' NOT NULL,
	"disposal_note" text,
	"note" text,
	"recorded_by_user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "in_kind_donations" ADD CONSTRAINT "in_kind_donations_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "in_kind_donations" ADD CONSTRAINT "in_kind_donations_temple_id_temples_id_fk" FOREIGN KEY ("temple_id") REFERENCES "public"."temples"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "in_kind_donations" ADD CONSTRAINT "in_kind_donations_devotee_id_devotees_id_fk" FOREIGN KEY ("devotee_id") REFERENCES "public"."devotees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "in_kind_donations_org_disposition_idx" ON "in_kind_donations" USING btree ("organization_id","disposition");--> statement-breakpoint
CREATE INDEX "in_kind_donations_devotee_idx" ON "in_kind_donations" USING btree ("devotee_id");