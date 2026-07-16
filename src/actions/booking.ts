"use server";

import { addMinutes } from "date-fns";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { bookingDiscounts } from "@/db/discount-schema";
import { discountCodes } from "@/db/marketing-schema";
import { bookings, customers, salons, services, staff } from "@/db/schema";
import { env } from "@/lib/env";
import { isSlotAvailable } from "@/lib/availability";
import { requireStripe } from "@/lib/stripe";

const inputSchema = z.object({
  slug: z.string(), serviceId: z.string().uuid(), staffId: z.string().uuid(), startsAt: z.string().datetime(),
  name: z.string().min(2), phone: z.string().min(6), email: z.string().email(), marketingConsent: z.boolean().default(false),
  discountCode: z.string().trim().max(40).optional().default(""),
});

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

  let discount: typeof discountCodes.$inferSelect | null = null;
  let discountAmountCents = 0;
  const normalizedCode = data.discountCode.trim().toUpperCase();
  if (normalizedCode) {
    discount = await db.query.discountCodes.findFirst({ where: and(eq(discountCodes.salonId, salon.id), eq(discountCodes.code, normalizedCode), eq(discountCodes.active, true)) }) || null;
    if (!discount) throw new Error("That discount code is invalid or inactive.");
    const now = new Date();
    if (discount.startsAt && discount.startsAt > now) throw new Error("That discount code is not active yet.");
    if (discount.endsAt && discount.endsAt < now) throw new Error("That discount code has expired.");
    if (discount.maximumRedemptions && discount.redemptionCount >= discount.maximumRedemptions) throw new Error("That discount code has reached its usage limit.");
    if (service.priceCents < discount.minimumSpendCents) throw new Error(`This code requires a minimum service value of €${(discount.minimumSpendCents / 100).toFixed(2)}.`);
    discountAmountCents = discount.type === "percent" ? Math.round(service.priceCents * (discount.amount / 100)) : discount.amount;
    discountAmountCents = Math.min(discountAmountCents, service.priceCents);
  }

  const depositCents = service.depositCents;
  const booking = await db.transaction(async (tx) => {
    const [customer] = await tx.insert(customers).values({ salonId: salon.id, name: data.name, phone: data.phone, email: data.email, marketingConsent: data.marketingConsent }).onConflictDoUpdate({ target: [customers.salonId, customers.phone], set: { name: data.name, email: data.email, marketingConsent: data.marketingConsent, updatedAt: new Date() } }).returning();
    const [created] = await tx.insert(bookings).values({ salonId: salon.id, customerId: customer.id, staffId: teamMember.id, serviceId: service.id, startsAt, endsAt, depositCents, status: depositCents > 0 ? "pending_payment" : "confirmed", paymentStatus: depositCents > 0 ? "pending" : "not_required", internalNotes: discount ? `Discount ${discount.code}: €${(discountAmountCents / 100).toFixed(2)} credit against service total.` : null }).returning();
    if (discount) {
      await tx.insert(bookingDiscounts).values({ bookingId: created.id, discountCodeId: discount.id, code: discount.code, discountAmountCents });
      await tx.update(discountCodes).set({ redemptionCount: discount.redemptionCount + 1 }).where(eq(discountCodes.id, discount.id));
    }
    return created;
  });

  if (depositCents === 0) return { bookingId: booking.id, clientSecret: null, discountAmountCents };
  if (!salon.stripeAccountId || !salon.stripeChargesEnabled) throw new Error("This salon is not ready to accept online deposits");
  const stripe = requireStripe();
  const applicationFee = Math.round(depositCents * (env.PLATFORM_FEE_PERCENT / 100));
  const intent = await stripe.paymentIntents.create({ amount: depositCents, currency: "eur", automatic_payment_methods: { enabled: true }, application_fee_amount: applicationFee, transfer_data: { destination: salon.stripeAccountId }, on_behalf_of: salon.stripeAccountId, receipt_email: data.email, description: `${salon.name}: ${service.name} deposit`, metadata: { bookingId: booking.id, salonId: salon.id, serviceId: service.id, discountCode: discount?.code || "", discountAmountCents: String(discountAmountCents) } }, { idempotencyKey: `booking:${booking.id}:deposit` });
  await db.update(bookings).set({ stripePaymentIntentId: intent.id }).where(eq(bookings.id, booking.id));
  return { bookingId: booking.id, clientSecret: intent.client_secret, discountAmountCents };
}
