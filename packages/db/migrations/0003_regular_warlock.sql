CREATE TYPE "public"."donation_method" AS ENUM('cash', 'upi', 'bank_transfer', 'card', 'online', 'other');--> statement-breakpoint
CREATE TYPE "public"."donation_status" AS ENUM('recorded', 'void');--> statement-breakpoint
CREATE TABLE "donation_categories" (
	"id" uuid PRIMARY KEY NOT NULL,
	"organization_id" uuid NOT NULL,
	"name" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "donation_counters" (
	"organization_id" uuid PRIMARY KEY NOT NULL,
	"next_number" integer DEFAULT 1 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "donations" (
	"id" uuid PRIMARY KEY NOT NULL,
	"organization_id" uuid NOT NULL,
	"temple_id" uuid,
	"devotee_id" uuid,
	"category_id" uuid,
	"donor_name" text NOT NULL,
	"amount" numeric(12, 2) NOT NULL,
	"currency" "currency" NOT NULL,
	"method" "donation_method" NOT NULL,
	"reference" text,
	"note" text,
	"receipt_number" text NOT NULL,
	"donated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"recorded_by_user_id" uuid,
	"status" "donation_status" DEFAULT 'recorded' NOT NULL,
	"void_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "donation_categories" ADD CONSTRAINT "donation_categories_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "donation_counters" ADD CONSTRAINT "donation_counters_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "donations" ADD CONSTRAINT "donations_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "donations" ADD CONSTRAINT "donations_temple_id_temples_id_fk" FOREIGN KEY ("temple_id") REFERENCES "public"."temples"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "donations" ADD CONSTRAINT "donations_devotee_id_devotees_id_fk" FOREIGN KEY ("devotee_id") REFERENCES "public"."devotees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "donations" ADD CONSTRAINT "donations_category_id_donation_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."donation_categories"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "donation_categories_org_name_idx" ON "donation_categories" USING btree ("organization_id","name");--> statement-breakpoint
CREATE UNIQUE INDEX "donations_org_receipt_uq" ON "donations" USING btree ("organization_id","receipt_number");--> statement-breakpoint
CREATE INDEX "donations_org_date_idx" ON "donations" USING btree ("organization_id","donated_at");--> statement-breakpoint
CREATE INDEX "donations_devotee_idx" ON "donations" USING btree ("devotee_id");