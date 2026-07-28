CREATE TABLE "devotee_login_tokens" (
	"id" uuid PRIMARY KEY NOT NULL,
	"organization_id" uuid NOT NULL,
	"devotee_id" uuid NOT NULL,
	"token" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"consumed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "devotee_sessions" (
	"id" uuid PRIMARY KEY NOT NULL,
	"organization_id" uuid NOT NULL,
	"devotee_id" uuid NOT NULL,
	"token" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "devotee_login_tokens" ADD CONSTRAINT "devotee_login_tokens_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "devotee_login_tokens" ADD CONSTRAINT "devotee_login_tokens_devotee_id_devotees_id_fk" FOREIGN KEY ("devotee_id") REFERENCES "public"."devotees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "devotee_sessions" ADD CONSTRAINT "devotee_sessions_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "devotee_sessions" ADD CONSTRAINT "devotee_sessions_devotee_id_devotees_id_fk" FOREIGN KEY ("devotee_id") REFERENCES "public"."devotees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "devotee_login_tokens_token_uq" ON "devotee_login_tokens" USING btree ("token");--> statement-breakpoint
CREATE INDEX "devotee_login_tokens_org_idx" ON "devotee_login_tokens" USING btree ("organization_id");--> statement-breakpoint
CREATE UNIQUE INDEX "devotee_sessions_token_uq" ON "devotee_sessions" USING btree ("token");--> statement-breakpoint
CREATE INDEX "devotee_sessions_org_idx" ON "devotee_sessions" USING btree ("organization_id");