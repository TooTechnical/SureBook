CREATE EXTENSION IF NOT EXISTS postgis;

ALTER TABLE "salons"
  ADD COLUMN IF NOT EXISTS "latitude" double precision,
  ADD COLUMN IF NOT EXISTS "longitude" double precision,
  ADD COLUMN IF NOT EXISTS "location" geography(Point, 4326),
  ADD COLUMN IF NOT EXISTS "has_female_therapist" boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "has_male_therapist" boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "mobile_service" boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "wheelchair_access" boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "home_visits" boolean NOT NULL DEFAULT false;

UPDATE "salons"
SET "location" = ST_SetSRID(ST_MakePoint("longitude", "latitude"), 4326)::geography
WHERE "latitude" IS NOT NULL
  AND "longitude" IS NOT NULL
  AND "location" IS NULL;

CREATE OR REPLACE FUNCTION surebook_sync_salon_location()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.latitude IS NULL OR NEW.longitude IS NULL THEN
    NEW.location := NULL;
  ELSE
    IF NEW.latitude < -90 OR NEW.latitude > 90 THEN
      RAISE EXCEPTION 'Latitude must be between -90 and 90';
    END IF;
    IF NEW.longitude < -180 OR NEW.longitude > 180 THEN
      RAISE EXCEPTION 'Longitude must be between -180 and 180';
    END IF;
    NEW.location := ST_SetSRID(ST_MakePoint(NEW.longitude, NEW.latitude), 4326)::geography;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS salons_sync_location ON "salons";
CREATE TRIGGER salons_sync_location
BEFORE INSERT OR UPDATE OF "latitude", "longitude"
ON "salons"
FOR EACH ROW
EXECUTE FUNCTION surebook_sync_salon_location();

CREATE INDEX IF NOT EXISTS salons_location_gix
ON "salons"
USING GIST ("location");

CREATE INDEX IF NOT EXISTS salons_marketplace_capabilities_idx
ON "salons" ("storefront_published", "mobile_service", "wheelchair_access", "home_visits");
