import { sql } from "drizzle-orm";
import { db } from "@/db";

export type MarketplaceFilters = {
  query?: string;
  latitude?: number;
  longitude?: number;
  radiusKm?: number;
  maxPriceCents?: number;
  minRating?: number;
  availableToday?: boolean;
  openNow?: boolean;
  femaleTherapist?: boolean;
  maleTherapist?: boolean;
  mobileService?: boolean;
  wheelchairAccess?: boolean;
  homeVisits?: boolean;
};

export type MarketplaceBusiness = {
  id: string;
  slug: string;
  name: string;
  category: string;
  county: string;
  address: string;
  tagline: string;
  coverImageUrl: string | null;
  minPriceCents: number;
  rating: number;
  reviewCount: number;
  openNow: boolean;
  availableToday: boolean;
  distanceKm: number | null;
  latitude: number | null;
  longitude: number | null;
  hasFemaleTherapist: boolean;
  hasMaleTherapist: boolean;
  mobileService: boolean;
  wheelchairAccess: boolean;
  homeVisits: boolean;
};

type MarketplaceRow = {
  id: string;
  slug: string;
  name: string;
  category: string;
  county: string | null;
  address: string | null;
  tagline: string | null;
  cover_image_url: string | null;
  min_price_cents: number | string | null;
  rating: number | string | null;
  review_count: number | string;
  open_now: boolean;
  available_today: boolean;
  distance_km: number | string | null;
  latitude: number | string | null;
  longitude: number | string | null;
  has_female_therapist: boolean;
  has_male_therapist: boolean;
  mobile_service: boolean;
  wheelchair_access: boolean;
  home_visits: boolean;
};

export async function searchMarketplace(filters: MarketplaceFilters = {}): Promise<MarketplaceBusiness[]> {
  const query = filters.query?.trim() || null;
  const latitude = Number.isFinite(filters.latitude) ? filters.latitude! : null;
  const longitude = Number.isFinite(filters.longitude) ? filters.longitude! : null;
  const radiusMetres = Math.max(1, filters.radiusKm ?? 100) * 1000;
  const maxPriceCents = filters.maxPriceCents ?? 1_000_000;
  const minRating = filters.minRating ?? 0;

  const result = await db.execute(sql`
    SELECT
      s.id,
      s.slug,
      s.name,
      s.business_category AS category,
      s.county,
      s.address,
      s.tagline,
      s.cover_image_url,
      s.latitude,
      s.longitude,
      s.has_female_therapist,
      s.has_male_therapist,
      s.mobile_service,
      s.wheelchair_access,
      s.home_visits,
      COALESCE(service_stats.min_price_cents, 0) AS min_price_cents,
      COALESCE(review_stats.rating, 0) AS rating,
      COALESCE(review_stats.review_count, 0) AS review_count,
      CASE
        WHEN today_hours.closed = false
          AND today_hours.open_time IS NOT NULL
          AND today_hours.close_time IS NOT NULL
          AND to_char(now() AT TIME ZONE COALESCE(s.timezone, 'Europe/Dublin'), 'HH24:MI') BETWEEN today_hours.open_time AND today_hours.close_time
        THEN true ELSE false
      END AS open_now,
      CASE WHEN today_hours.closed = false THEN true ELSE false END AS available_today,
      CASE
        WHEN ${latitude}::double precision IS NOT NULL
          AND ${longitude}::double precision IS NOT NULL
          AND s.location IS NOT NULL
        THEN ST_Distance(
          s.location,
          ST_SetSRID(ST_MakePoint(${longitude}::double precision, ${latitude}::double precision), 4326)::geography
        ) / 1000.0
        ELSE NULL
      END AS distance_km
    FROM salons s
    LEFT JOIN LATERAL (
      SELECT MIN(price_cents) AS min_price_cents
      FROM services
      WHERE salon_id = s.id AND active = true
    ) service_stats ON true
    LEFT JOIN LATERAL (
      SELECT AVG(rating)::double precision AS rating, COUNT(*)::integer AS review_count
      FROM reviews
      WHERE salon_id = s.id AND approved = true
    ) review_stats ON true
    LEFT JOIN business_hours today_hours
      ON today_hours.salon_id = s.id
      AND today_hours.day_of_week = EXTRACT(DOW FROM now() AT TIME ZONE COALESCE(s.timezone, 'Europe/Dublin'))::integer
    WHERE s.storefront_published = true
      AND s.stripe_charges_enabled = true
      AND (${query}::text IS NULL OR (
        s.name ILIKE '%' || ${query}::text || '%'
        OR s.business_category ILIKE '%' || ${query}::text || '%'
        OR COALESCE(s.county, '') ILIKE '%' || ${query}::text || '%'
        OR COALESCE(s.address, '') ILIKE '%' || ${query}::text || '%'
        OR EXISTS (
          SELECT 1 FROM services svc
          WHERE svc.salon_id = s.id
            AND svc.active = true
            AND (svc.name ILIKE '%' || ${query}::text || '%' OR COALESCE(svc.description, '') ILIKE '%' || ${query}::text || '%')
        )
      ))
      AND COALESCE(service_stats.min_price_cents, 0) <= ${maxPriceCents}
      AND COALESCE(review_stats.rating, 0) >= ${minRating}
      AND (${filters.femaleTherapist ?? false} = false OR s.has_female_therapist = true)
      AND (${filters.maleTherapist ?? false} = false OR s.has_male_therapist = true)
      AND (${filters.mobileService ?? false} = false OR s.mobile_service = true)
      AND (${filters.wheelchairAccess ?? false} = false OR s.wheelchair_access = true)
      AND (${filters.homeVisits ?? false} = false OR s.home_visits = true)
      AND (${filters.availableToday ?? false} = false OR today_hours.closed = false)
      AND (${filters.openNow ?? false} = false OR (
        today_hours.closed = false
        AND today_hours.open_time IS NOT NULL
        AND today_hours.close_time IS NOT NULL
        AND to_char(now() AT TIME ZONE COALESCE(s.timezone, 'Europe/Dublin'), 'HH24:MI') BETWEEN today_hours.open_time AND today_hours.close_time
      ))
      AND (
        ${latitude}::double precision IS NULL
        OR ${longitude}::double precision IS NULL
        OR s.location IS NULL
        OR ST_DWithin(
          s.location,
          ST_SetSRID(ST_MakePoint(${longitude}::double precision, ${latitude}::double precision), 4326)::geography,
          ${radiusMetres}
        )
      )
    ORDER BY distance_km ASC NULLS LAST, rating DESC, s.name ASC
    LIMIT 250
  `);

  return (result as unknown as MarketplaceRow[]).map((row) => ({
    id: row.id,
    slug: row.slug,
    name: row.name,
    category: row.category,
    county: row.county || "Ireland",
    address: row.address || "",
    tagline: row.tagline || "",
    coverImageUrl: row.cover_image_url,
    minPriceCents: Number(row.min_price_cents || 0),
    rating: Number(row.rating || 0),
    reviewCount: Number(row.review_count || 0),
    openNow: Boolean(row.open_now),
    availableToday: Boolean(row.available_today),
    distanceKm: row.distance_km == null ? null : Number(row.distance_km),
    latitude: row.latitude == null ? null : Number(row.latitude),
    longitude: row.longitude == null ? null : Number(row.longitude),
    hasFemaleTherapist: Boolean(row.has_female_therapist),
    hasMaleTherapist: Boolean(row.has_male_therapist),
    mobileService: Boolean(row.mobile_service),
    wheelchairAccess: Boolean(row.wheelchair_access),
    homeVisits: Boolean(row.home_visits),
  }));
}
