CREATE TABLE "plan_catalog" (
	"key" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"price_usd" integer,
	"description" text NOT NULL,
	"features" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"modules" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"is_purchasable" boolean DEFAULT false NOT NULL,
	"stripe_price_id" text,
	"is_trial_default" boolean DEFAULT false NOT NULL,
	"is_fallback_default" boolean DEFAULT false NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
-- Seed the catalog BEFORE the platform_subscriptions FK below is added, so any
-- existing 'trial'/'starter'/'growth'/'pro' subscription rows still satisfy it.
-- Trial's module set is intentionally Growth's, not every module — a limited,
-- not full-feature, trial (see docs/SAAS-LAUNCH-PLAN.md §3).
INSERT INTO "plan_catalog"
  ("key", "name", "price_usd", "description", "features", "modules", "is_purchasable", "is_trial_default", "is_fallback_default", "sort_order")
VALUES
  (
    'trial', 'Trial', NULL,
    '14-day trial — worship, community, and fundraising tools included.',
    '["Worship, community & fundraising modules","Up to 2 staff accounts","Upgrade anytime to add full accounting"]'::jsonb,
    '["worship","community","finance-basic"]'::jsonb,
    false, true, false, 0
  ),
  (
    'starter', 'Starter', 0,
    'Core temple operations, free forever — what a trial falls back to.',
    '["Devotees, donations, events, public website","Up to 2 staff accounts"]'::jsonb,
    '[]'::jsonb,
    false, false, true, 1
  ),
  (
    'growth', 'Growth', 29,
    'Starter plus worship bookings, community tools, and fundraising.',
    '["Everything in Starter","Puja booking, sevas, prasadam, darshan, facilities","Membership, volunteers, officers, communications","Campaigns, pledges, hundi, in-kind, recurring donations","Unlimited staff accounts"]'::jsonb,
    '["worship","community","finance-basic"]'::jsonb,
    true, false, false, 2
  ),
  (
    'pro', 'Pro', 79,
    'Everything TempleOS offers, including full fund accounting.',
    '["Everything in Growth","Accounts, payroll, budgets, statements, reconciliation","Inventory, assets, vendors, loans, investments, grants","80G/tax receipts, annual report, custom roles","Priority support"]'::jsonb,
    '["worship","community","finance-basic","accounting"]'::jsonb,
    true, false, false, 3
  );
--> statement-breakpoint
ALTER TABLE "platform_subscriptions" ALTER COLUMN "plan" SET DATA TYPE text USING "plan"::text;--> statement-breakpoint
ALTER TABLE "platform_subscriptions" ALTER COLUMN "plan" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "platform_subscriptions" ADD CONSTRAINT "platform_subscriptions_plan_plan_catalog_key_fk" FOREIGN KEY ("plan") REFERENCES "public"."plan_catalog"("key") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
DROP TYPE "public"."platform_plan";
