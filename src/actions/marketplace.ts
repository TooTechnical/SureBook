"use server";

import { sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/db";
import { requireSession } from "@/lib/session";

const optionalCoordinate = z.preprocess(
  (value) => value === "" || value == null ? undefined : value,
  z.coerce.number().optional(),
);

export async function updateMarketplaceProfileAction(formData: FormData) {
  const session = await requireSession();
  const input = z.object({
    latitude: optionalCoordinate.refine((value) => value == null || (value >= -90 && value <= 90), "Invalid latitude"),
    longitude: optionalCoordinate.refine((value) => value == null || (value >= -180 && value <= 180), "Invalid longitude"),
  }).parse(Object.fromEntries(formData));

  if ((input.latitude == null) !== (input.longitude == null)) {
    throw new Error("Enter both latitude and longitude, or leave both empty.");
  }

  await db.execute(sql`
    UPDATE salons
    SET
      latitude = ${input.latitude ?? null},
      longitude = ${input.longitude ?? null},
      has_female_therapist = ${formData.get("hasFemaleTherapist") === "on"},
      has_male_therapist = ${formData.get("hasMaleTherapist") === "on"},
      mobile_service = ${formData.get("mobileService") === "on"},
      wheelchair_access = ${formData.get("wheelchairAccess") === "on"},
      home_visits = ${formData.get("homeVisits") === "on"},
      updated_at = now()
    WHERE id = ${session.salonId}::uuid
  `);

  revalidatePath("/discover");
  revalidatePath("/dashboard/marketplace");
}
