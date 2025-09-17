-- Add optional image_url to bookings table
ALTER TABLE "bookings"
ADD COLUMN IF NOT EXISTS "image_url" text;


