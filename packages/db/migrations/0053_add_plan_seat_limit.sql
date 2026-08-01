ALTER TABLE "plan_catalog" ADD COLUMN "seat_limit" integer;--> statement-breakpoint
-- Matches the "Up to 2 staff accounts" / "Unlimited staff accounts" copy seeded
-- in 0052 — growth/pro stay NULL (unlimited), matching their existing bullet text.
UPDATE "plan_catalog" SET "seat_limit" = 2 WHERE "key" IN ('trial', 'starter');