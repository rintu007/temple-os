CREATE TABLE "fund_transfers" (
	"id" uuid PRIMARY KEY NOT NULL,
	"organization_id" uuid NOT NULL,
	"from_fund_id" uuid NOT NULL,
	"to_fund_id" uuid NOT NULL,
	"amount" numeric(12, 2) NOT NULL,
	"transferred_on" date NOT NULL,
	"reference" text,
	"note" text,
	"recorded_by_user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "fund_transfers" ADD CONSTRAINT "fund_transfers_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fund_transfers" ADD CONSTRAINT "fund_transfers_from_fund_id_funds_id_fk" FOREIGN KEY ("from_fund_id") REFERENCES "public"."funds"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fund_transfers" ADD CONSTRAINT "fund_transfers_to_fund_id_funds_id_fk" FOREIGN KEY ("to_fund_id") REFERENCES "public"."funds"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "fund_transfers_org_date_idx" ON "fund_transfers" USING btree ("organization_id","transferred_on");--> statement-breakpoint
CREATE INDEX "fund_transfers_from_idx" ON "fund_transfers" USING btree ("from_fund_id");--> statement-breakpoint
CREATE INDEX "fund_transfers_to_idx" ON "fund_transfers" USING btree ("to_fund_id");