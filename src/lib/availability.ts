import { formatInTimeZone } from "date-fns-tz";
import { and, eq, gt, isNull, lt, ne, or } from "drizzle-orm";
import { db } from "@/db";
import { bookings } from "@/db/schema";
import { availabilityRules, calendarBlocks } from "@/db/calendar-schema";

export async function isSlotAvailable(input: { salonId: string; staffId: string; startsAt: Date; endsAt: Date; excludeBookingId?: string }) {
  const conditions = [eq(bookings.salonId, input.salonId), eq(bookings.staffId, input.staffId), lt(bookings.startsAt, input.endsAt), gt(bookings.endsAt, input.startsAt)];
  if (input.excludeBookingId) conditions.push(ne(bookings.id, input.excludeBookingId));
  const conflicts = await db.select({ id: bookings.id }).from(bookings).where(and(...conditions)).limit(1);
  if (conflicts.length) return false;

  const blocks = await db.select({ id: calendarBlocks.id }).from(calendarBlocks).where(and(eq(calendarBlocks.salonId, input.salonId), or(isNull(calendarBlocks.staffId), eq(calendarBlocks.staffId, input.staffId)), lt(calendarBlocks.startsAt, input.endsAt), gt(calendarBlocks.endsAt, input.startsAt))).limit(1);
  if (blocks.length) return false;

  const dayOfWeek = Number(formatInTimeZone(input.startsAt, "Europe/Dublin", "i")) % 7;
  const startTime = formatInTimeZone(input.startsAt, "Europe/Dublin", "HH:mm");
  const endTime = formatInTimeZone(input.endsAt, "Europe/Dublin", "HH:mm");
  const rules = await db.select().from(availabilityRules).where(and(eq(availabilityRules.salonId, input.salonId), eq(availabilityRules.dayOfWeek, dayOfWeek), eq(availabilityRules.active, true), or(isNull(availabilityRules.staffId), eq(availabilityRules.staffId, input.staffId))));
  const working = rules.filter((rule) => rule.ruleType === "working");
  if (working.length && !working.some((rule) => startTime >= rule.startTime && endTime <= rule.endTime)) return false;
  const breaks = rules.filter((rule) => rule.ruleType === "lunch");
  if (breaks.some((rule) => startTime < rule.endTime && endTime > rule.startTime)) return false;
  return true;
}
