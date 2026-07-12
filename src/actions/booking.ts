"use server";

import { addMinutes } from "date-fns";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { bookings, customers, salons, services, staff } from "@/db/schema";
import { env } from "@/lib/env";
import { isSlotAvailable } from "@/lib/availability";
import { requireStripe } from "@/lib/stripe";

const inputSchema = z.object({ slug: z.string(), serviceId: z.string().uuid(), staffId: z.string().uuid(), startsAt: z.string().datetime(), name: z.string().min(2), phone: z.string().min(6), email: z.string().email(), marketingConsent: z.boolean().default(false) });

export async function createBookingIntent(input: z.infer<typeof inputSchema>) {
  const data = inputSchema.parse(input);
  const salon = await db.query.salons.findFirst({ where: eq(salons.slug, data.slug) });
  if (!salon) throw new Error("Salon not found");
  const service = await db.query.services.findFirst({ where: and(eq(services.id, data.serviceId), eq(services.salonId, salon.id), eq(services.active, true)) });
  const teamMember = await db.query.staff.findFirst({ where: and(eq(staff.id, data.staffId), eq(staff.salonId, salon.id), eq(staff.active, true)) });
  if (!service || !teamMember) throw new Error("Service or staff member is unavailable");
  const startsAt = new Date(data.startsAt);
  if (startsAt.getTime() < Date.now() + 15 * 60_000) throw new Error("Choose a future appointment time");
  const endsAt = addMinutes(startsAt, service.durationMinutes);
  if (!(await isSlotAvailable({ salonId: salon.id, staffId: teamMember.id, startsAt, endsAt }))) throw new Error("That time has just been booked. Please choose another slot.");

  const [customer] = await db.insert(customers).values({ salonId: salon.id, name: data.name, phone: data.phone, email: data.email, marketingConsent: data.marketingConsent }).onConflictDoUpdate({ target: [customers.salonId, customers.phone], set: { name: data.name, email: data.email, marketingConsent: data.marketingConsent, updatedAt: new Date() } }).returning();
  const depositCents = service.depositCents;
  const [booking] = await db.insert(bookings).values({ salonId: salon.id, customerId: customer.id, staffId: teamMember.id, serviceId: service.id, startsAt, endsAt, depositCents, status: depositCents > 0 ? "pending_payment" : "confirmed", paymentStatus: depositCents > 0 ? "pending" : "not_required" }).returning();

  if (depositCents === 0) return { bookingId: booking.id, clientSecret: null };
  if (!salon.stripeAccountId || !salon.stripeChargesEnabled) throw new Error("This salon is not ready to accept online deposits");
  const stripe = requireStripe();
  const applicationFee = Math.round(depositCents * (env.PLATFORM_FEE_PERCENT / 100));
  const intent = await stripe.paymentIntents.create({ amount: depositCents, currency: "eur", automatic_payment_methods: { enabled: true }, application_fee_amount: applicationFee, transfer_data: { destination: salon.stripeAccountId }, on_behalf_of: salon.stripeAccountId, receipt_email: data.email, description: `${salon.name}: ${service.name} deposit`, metadata: { bookingId: booking.id, salonId: salon.id, serviceId: service.id } }, { idempotencyKey: `booking:${booking.id}:deposit` });
  await db.update(bookings).set({ stripePaymentIntentId: intent.id }).where(eq(bookings.id, booking.id));
  return { bookingId: booking.id, clientSecret: intent.client_secret };
}
