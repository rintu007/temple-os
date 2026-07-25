CREATE TABLE "office_bearers" (
	"id" uuid PRIMARY KEY NOT NULL,
	"organization_id" uuid NOT NULL,
	"name" text NOT NULL,
	"designation" text NOT NULL,
	"body" text,
	"phone" text,
	"email" text,
	"term_starts_on" date,
	"term_ends_on" date,
	"is_active" boolean DEFAULT true NOT NULL,
	"note" text,
	"recorded_by_user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "office_bearers" ADD CONSTRAINT "office_bearers_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "office_bearers_org_active_idx" ON "office_bearers" USING btree ("organization_id","is_active");