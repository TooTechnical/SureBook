import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { searchMarketplace } from "@/lib/discovery";

const booleanParam = z.enum(["true", "false"]).optional().transform((value) => value === "true");

const querySchema = z.object({
  q: z.string().trim().max(120).optional(),
  lat: z.coerce.number().min(-90).max(90).optional(),
  lng: z.coerce.number().min(-180).max(180).optional(),
  radiusKm: z.coerce.number().min(1).max(250).default(50),
  maxPrice: z.coerce.number().min(0).max(10000).default(250),
  minRating: z.coerce.number().min(0).max(5).default(0),
  availableToday: booleanParam,
  openNow: booleanParam,
  femaleTherapist: booleanParam,
  maleTherapist: booleanParam,
  mobileService: booleanParam,
  wheelchairAccess: booleanParam,
  homeVisits: booleanParam,
});

export async function GET(request: NextRequest) {
  const parsed = querySchema.safeParse(Object.fromEntries(request.nextUrl.searchParams));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid marketplace filters", details: parsed.error.flatten() }, { status: 400 });
  }

  const input = parsed.data;
  const businesses = await searchMarketplace({
    query: input.q,
    latitude: input.lat,
    longitude: input.lng,
    radiusKm: input.radiusKm,
    maxPriceCents: Math.round(input.maxPrice * 100),
    minRating: input.minRating,
    availableToday: input.availableToday,
    openNow: input.openNow,
    femaleTherapist: input.femaleTherapist,
    maleTherapist: input.maleTherapist,
    mobileService: input.mobileService,
    wheelchairAccess: input.wheelchairAccess,
    homeVisits: input.homeVisits,
  });

  return NextResponse.json({ businesses }, {
    headers: { "Cache-Control": "private, max-age=30, stale-while-revalidate=60" },
  });
}
