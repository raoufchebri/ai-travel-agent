-- Rename trips to potential_trips
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'trips'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'potential_trips'
  ) THEN
    ALTER TABLE "trips" RENAME TO "potential_trips";
  END IF;
END $$;

-- Add is_booked column if missing
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'potential_trips' AND column_name = 'is_booked'
  ) THEN
    ALTER TABLE "potential_trips" ADD COLUMN "is_booked" boolean NOT NULL DEFAULT false;
  END IF;
END $$;

-- Create bookings table if not exists
CREATE TABLE IF NOT EXISTS "bookings" (
  "id" serial PRIMARY KEY,
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
  "currency" text NOT NULL DEFAULT 'USD',
  "created_at" timestamp NOT NULL DEFAULT now(),
  CONSTRAINT "bookings_trip_id_fkey" FOREIGN KEY ("trip_id") REFERENCES "potential_trips"("id") ON DELETE CASCADE
);


