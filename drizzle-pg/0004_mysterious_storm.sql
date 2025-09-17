CREATE TABLE "bookings" (
	"id" serial PRIMARY KEY NOT NULL,
	"trip_id" integer NOT NULL,
	"carrier" text NOT NULL,
	"flight_number" text NOT NULL,
	"origin_city" text NOT NULL,
	"origin_code" text NOT NULL,
	"origin_airport_name" text NOT NULL,
	"destination_city" text NOT NULL,
	"destination_code" text NOT NULL,
	"destination_airport_name" text NOT NULL,
	"depart_at" timestamp NOT NULL,
	"arrive_at" timestamp NOT NULL,
	"price" integer NOT NULL,
	"currency" text DEFAULT 'USD' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "potential_trips" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"destination" text NOT NULL,
	"origin" text,
	"budget" integer,
	"source" text NOT NULL,
	"start_date" timestamp,
	"end_date" timestamp,
	"is_booked" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
