import { and, eq, gt, lt } from "drizzle-orm";
import { db } from "@/db";
import { bookings } from "@/db/schema";

export async function isSlotAvailable(input: { salonId: string; staffId: string; startsAt: Date; endsAt: Date; excludeBookingId?: string }) {
  const rows = await db.select({ id: bookings.id }).from(bookings).where(and(
    eq(bookings.salonId, input.salonId),
    eq(bookings.staffId, input.staffId),
    lt(bookings.startsAt, input.endsAt),
    gt(bookings.endsAt, input.startsAt),
  )).limit(5);
  return input.excludeBookingId ? rows.every((r) => r.id === input.excludeBookingId) : rows.length === 0;
}
