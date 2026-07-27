CREATE TABLE "account_transfers" (
	"id" uuid PRIMARY KEY NOT NULL,
	"organization_id" uuid NOT NULL,
	"from_account_id" uuid NOT NULL,
	"to_account_id" uuid NOT NULL,
	"amount" numeric(12, 2) NOT NULL,
	"transferred_on" date NOT NULL,
	"reference" text,
	"note" text,
	"from_cleared_at" timestamp with time zone,
	"to_cleared_at" timestamp with time zone,
	"recorded_by_user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "account_transfers" ADD CONSTRAINT "account_transfers_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "account_transfers" ADD CONSTRAINT "account_transfers_from_account_id_financial_accounts_id_fk" FOREIGN KEY ("from_account_id") REFERENCES "public"."financial_accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "account_transfers" ADD CONSTRAINT "account_transfers_to_account_id_financial_accounts_id_fk" FOREIGN KEY ("to_account_id") REFERENCES "public"."financial_accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "account_transfers_org_date_idx" ON "account_transfers" USING btree ("organization_id","transferred_on");--> statement-breakpoint
CREATE INDEX "account_transfers_from_idx" ON "account_transfers" USING btree ("from_account_id");--> statement-breakpoint
CREATE INDEX "account_transfers_to_idx" ON "account_transfers" USING btree ("to_account_id");