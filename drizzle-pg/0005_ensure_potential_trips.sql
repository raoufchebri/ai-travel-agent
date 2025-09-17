-- Ensure potential_trips exists (create if missing)
CREATE TABLE IF NOT EXISTS "potential_trips" (
  "id" serial PRIMARY KEY,
  "name" text NOT NULL,
  "destination" text NOT NULL,
  "origin" text,
  "budget" integer,
  "source" text NOT NULL,
  "start_date" timestamp,
  "end_date" timestamp,
  "is_booked" boolean NOT NULL DEFAULT false,
  "created_at" timestamp NOT NULL DEFAULT now()
);

-- If trips exists and potential_trips is empty, copy rows across preserving ids
DO $$
DECLARE
  has_trips boolean;
  has_any boolean;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'trips'
  ) INTO has_trips;
  SELECT EXISTS (SELECT 1 FROM potential_trips) INTO has_any;
  IF has_trips AND NOT has_any THEN
    EXECUTE 'INSERT INTO potential_trips (id, name, destination, origin, budget, source, start_date, end_date, created_at)
             SELECT id, name, destination, origin, budget, source, start_date, end_date, created_at FROM trips';
    -- Align sequence with max id
    PERFORM setval(pg_get_serial_sequence('potential_trips','id'), COALESCE((SELECT MAX(id) FROM potential_trips), 1), true);
  END IF;
END $$;


