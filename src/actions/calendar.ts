"use server";

import { addDays, addMonths, addWeeks } from "date-fns";
import { and, eq, gt, isNull, lt, ne, or } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/db";
import { bookings, services } from "@/db/schema";
import { availabilityRules, bookingSeriesLinks, calendarBlocks, recurringAppointmentSeries } from "@/db/calendar-schema";
import { requireSession } from "@/lib/session";

const optionalUuid = z.string().uuid().optional().or(z.literal(""));

async function assertSlotAvailable(input: { salonId: string; staffId: string; startsAt: Date; endsAt: Date; excludeBookingId?: string }) {
  const bookingConditions = [eq(bookings.salonId, input.salonId), eq(bookings.staffId, input.staffId), lt(bookings.startsAt, input.endsAt), gt(bookings.endsAt, input.startsAt)];
  if (input.excludeBookingId) bookingConditions.push(ne(bookings.id, input.excludeBookingId));
  const conflict = await db.query.bookings.findFirst({ where: and(...bookingConditions) });
  if (conflict) throw new Error("That staff member already has an appointment during this time.");
  const block = await db.select({ id: calendarBlocks.id }).from(calendarBlocks).where(and(
    eq(calendarBlocks.salonId, input.salonId),
    or(isNull(calendarBlocks.staffId), eq(calendarBlocks.staffId, input.staffId)),
    lt(calendarBlocks.startsAt, input.endsAt),
    gt(calendarBlocks.endsAt, input.startsAt),
  )).limit(1);
  if (block.length) throw new Error("This time is blocked by a break, holiday or calendar event.");
}

export async function moveBookingAction(input: { bookingId: string; startsAt: string }) {
  const session = await requireSession();
  const parsed = z.object({ bookingId: z.string().uuid(), startsAt: z.string().datetime() }).parse(input);
  const booking = await db.query.bookings.findFirst({ where: and(eq(bookings.id, parsed.bookingId), eq(bookings.salonId, session.salonId)) });
  if (!booking) throw new Error("Booking not found.");
  const startsAt = new Date(parsed.startsAt);
  const endsAt = new Date(startsAt.getTime() + (booking.endsAt.getTime() - booking.startsAt.getTime()));
  await assertSlotAvailable({ salonId: session.salonId, staffId: booking.staffId, startsAt, endsAt, excludeBookingId: booking.id });
  await db.update(bookings).set({ startsAt, endsAt, updatedAt: new Date() }).where(eq(bookings.id, booking.id));
  revalidatePath("/dashboard/calendar"); revalidatePath("/dashboard/bookings");
  return { ok: true };
}

export async function createCalendarBlockAction(formData: FormData) {
  const session = await requireSession();
  const input = z.object({ title: z.string().trim().min(2).max(180), staffId: optionalUuid, blockType: z.enum(["blocked", "holiday", "lunch", "personal"]), startsAt: z.string().min(1), endsAt: z.string().min(1), allDay: z.enum(["on"]).optional(), recurrence: z.enum(["none", "daily", "weekly"]).default("none"), recurrenceUntil: z.string().optional(), notes: z.string().trim().max(1000).optional() }).parse(Object.fromEntries(formData));
  const firstStart = new Date(input.startsAt); const firstEnd = new Date(input.endsAt);
  if (!(firstEnd > firstStart)) throw new Error("The block must end after it starts.");
  const until = input.recurrenceUntil ? new Date(`${input.recurrenceUntil}T23:59:59`) : firstStart;
  const occurrences: Array<{ startsAt: Date; endsAt: Date }> = [];
  let index = 0;
  while (index < 370) {
    const startsAt = input.recurrence === "daily" ? addDays(firstStart, index) : input.recurrence === "weekly" ? addWeeks(firstStart, index) : firstStart;
    const endsAt = new Date(startsAt.getTime() + (firstEnd.getTime() - firstStart.getTime()));
    if (startsAt > until) break;
    occurrences.push({ startsAt, endsAt });
    if (input.recurrence === "none") break;
    index += 1;
  }
  await db.insert(calendarBlocks).values(occurrences.map((occurrence) => ({ salonId: session.salonId, staffId: input.staffId || null, title: input.title, blockType: input.blockType, startsAt: occurrence.startsAt, endsAt: occurrence.endsAt, allDay: input.allDay === "on", recurrenceRule: input.recurrence === "none" ? null : `FREQ=${input.recurrence.toUpperCase()}`, recurrenceUntil: input.recurrence === "none" ? null : until, notes: input.notes || null })));
  revalidatePath("/dashboard/calendar");
}

export async function deleteCalendarBlockAction(formData: FormData) {
  const session = await requireSession(); const id = z.string().uuid().parse(formData.get("blockId"));
  await db.delete(calendarBlocks).where(and(eq(calendarBlocks.id, id), eq(calendarBlocks.salonId, session.salonId)));
  revalidatePath("/dashboard/calendar");
}

export async function createAvailabilityRuleAction(formData: FormData) {
  const session = await requireSession();
  const input = z.object({ staffId: optionalUuid, dayOfWeek: z.coerce.number().int().min(0).max(6), startTime: z.string().regex(/^\d{2}:\d{2}$/), endTime: z.string().regex(/^\d{2}:\d{2}$/), ruleType: z.enum(["working", "lunch"]) }).parse(Object.fromEntries(formData));
  if (input.endTime <= input.startTime) throw new Error("End time must be after start time.");
  await db.insert(availabilityRules).values({ salonId: session.salonId, staffId: input.staffId || null, dayOfWeek: input.dayOfWeek, startTime: input.startTime, endTime: input.endTime, ruleType: input.ruleType });
  revalidatePath("/dashboard/calendar");
}

export async function deleteAvailabilityRuleAction(formData: FormData) {
  const session = await requireSession(); const id = z.string().uuid().parse(formData.get("ruleId"));
  await db.delete(availabilityRules).where(and(eq(availabilityRules.id, id), eq(availabilityRules.salonId, session.salonId)));
  revalidatePath("/dashboard/calendar");
}

export async function createRecurringAppointmentsAction(formData: FormData) {
  const session = await requireSession();
  const input = z.object({ customerId: z.string().uuid(), staffId: z.string().uuid(), serviceId: z.string().uuid(), firstStartsAt: z.string().min(1), frequency: z.enum(["weekly", "fortnightly", "monthly"]), occurrenceCount: z.coerce.number().int().min(2).max(52) }).parse(Object.fromEntries(formData));
  const service = await db.query.services.findFirst({ where: and(eq(services.id, input.serviceId), eq(services.salonId, session.salonId)) });
  if (!service) throw new Error("Service not found.");
  const firstStartsAt = new Date(input.firstStartsAt);
  const starts = Array.from({ length: input.occurrenceCount }, (_, index) => input.frequency === "weekly" ? addWeeks(firstStartsAt, index) : input.frequency === "fortnightly" ? addWeeks(firstStartsAt, index * 2) : addMonths(firstStartsAt, index));
  for (const startsAt of starts) await assertSlotAvailable({ salonId: session.salonId, staffId: input.staffId, startsAt, endsAt: new Date(startsAt.getTime() + service.durationMinutes * 60_000) });
  await db.transaction(async (tx) => {
    const [series] = await tx.insert(recurringAppointmentSeries).values({ salonId: session.salonId, customerId: input.customerId, staffId: input.staffId, serviceId: input.serviceId, frequency: input.frequency, interval: input.frequency === "fortnightly" ? 2 : 1, occurrenceCount: input.occurrenceCount, firstStartsAt }).returning({ id: recurringAppointmentSeries.id });
    for (let index = 0; index < starts.length; index += 1) {
      const startsAt = starts[index]; const endsAt = new Date(startsAt.getTime() + service.durationMinutes * 60_000);
      const [booking] = await tx.insert(bookings).values({ salonId: session.salonId, customerId: input.customerId, staffId: input.staffId, serviceId: input.serviceId, startsAt, endsAt, status: "confirmed", paymentStatus: "not_required", depositCents: 0 }).returning({ id: bookings.id });
      await tx.insert(bookingSeriesLinks).values({ bookingId: booking.id, seriesId: series.id, occurrenceIndex: index });
    }
  });
  revalidatePath("/dashboard/calendar"); revalidatePath("/dashboard/bookings");
}
