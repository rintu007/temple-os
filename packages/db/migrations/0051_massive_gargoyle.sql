CREATE TYPE "public"."broadcast_channel" AS ENUM('email', 'whatsapp');--> statement-breakpoint
ALTER TABLE "broadcasts" ADD COLUMN "channel" "broadcast_channel" DEFAULT 'email' NOT NULL;