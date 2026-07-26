CREATE TABLE "tax_profiles" (
	"organization_id" uuid PRIMARY KEY NOT NULL,
	"legal_name" text NOT NULL,
	"pan" text,
	"registration_number" text NOT NULL,
	"valid_from" date,
	"valid_until" date,
	"show_on_receipt" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "donations" ADD COLUMN "donor_pan" text;--> statement-breakpoint
ALTER TABLE "tax_profiles" ADD CONSTRAINT "tax_profiles_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;