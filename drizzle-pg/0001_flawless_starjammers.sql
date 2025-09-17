CREATE TABLE IF NOT EXISTS "user_profiles" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"location" text,
	"adult_companions" integer DEFAULT 0 NOT NULL,
	"kids_companion_ages" integer[],
	"budget_per_person" integer,
	"created_at" timestamp DEFAULT now() NOT NULL
);
