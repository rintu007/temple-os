CREATE TABLE "funds" (
	"id" uuid PRIMARY KEY NOT NULL,
	"organization_id" uuid NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"recorded_by_user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "donations" ADD COLUMN "fund_id" uuid;--> statement-breakpoint
ALTER TABLE "expenses" ADD COLUMN "fund_id" uuid;--> statement-breakpoint
ALTER TABLE "funds" ADD CONSTRAINT "funds_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "funds_org_active_idx" ON "funds" USING btree ("organization_id","is_active");--> statement-breakpoint
ALTER TABLE "donations" ADD CONSTRAINT "donations_fund_id_funds_id_fk" FOREIGN KEY ("fund_id") REFERENCES "public"."funds"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_fund_id_funds_id_fk" FOREIGN KEY ("fund_id") REFERENCES "public"."funds"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "donations_fund_idx" ON "donations" USING btree ("fund_id");--> statement-breakpoint
CREATE INDEX "expenses_fund_idx" ON "expenses" USING btree ("fund_id");