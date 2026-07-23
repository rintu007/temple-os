CREATE TABLE "hundi_collections" (
	"id" uuid PRIMARY KEY NOT NULL,
	"organization_id" uuid NOT NULL,
	"temple_id" uuid,
	"box_name" text NOT NULL,
	"counted_on" date NOT NULL,
	"denominations" jsonb,
	"total_amount" numeric(12, 2) NOT NULL,
	"currency" "currency" NOT NULL,
	"note" text,
	"donation_id" uuid NOT NULL,
	"counted_by_user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "hundi_collections" ADD CONSTRAINT "hundi_collections_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hundi_collections" ADD CONSTRAINT "hundi_collections_temple_id_temples_id_fk" FOREIGN KEY ("temple_id") REFERENCES "public"."temples"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hundi_collections" ADD CONSTRAINT "hundi_collections_donation_id_donations_id_fk" FOREIGN KEY ("donation_id") REFERENCES "public"."donations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "hundi_collections_org_date_idx" ON "hundi_collections" USING btree ("organization_id","counted_on");