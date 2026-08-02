CREATE TABLE "health_checks" (
	"service" text PRIMARY KEY NOT NULL,
	"status" text NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
