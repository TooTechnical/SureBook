"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/db";
import { auditLog, bookings, customers, salons, services, staff } from "@/db/schema";
import { requireSession } from "@/lib/session";
import { requireStripe } from "@/lib/stripe";
import { syncStripeConnectStatus } from "@/lib/stripe-connect";
import { env } from "@/lib/env";
import { sendOutcome } from "@/lib/email";

export async function createServiceAction(formData: FormData) {
  const session = await requireSession();
  const input = z.object({ name: z.string().min(2), description: z.string().optional(), durationMinutes: z.coerce.number().int().min(5).max(600), price: z.coerce.number().min(0), deposit: z.coerce.number().min(0) }).parse(Object.fromEntries(formData));
  await db.insert(services).values({ salonId: session.salonId, name: input.name, description: input.description, durationMinutes: input.durationMinutes, priceCents: Math.round(input.price * 100), depositCents: Math.round(input.deposit * 100) });
  revalidatePath("/dashboard/services");
}

export async function createStaffAction(formData: FormData) {
  const session = await requireSession();
  const input = z.object({ name: z.string().min(2), email: z.string().email().optional().or(z.literal("")), phone: z.string().optional() }).parse(Object.fromEntries(formData));
  await db.insert(staff).values({ salonId: session.salonId, name: input.name, email: input.email || null, phone: input.phone || null });
  revalidatePath("/dashboard/staff");
}

export async function updateSalonAction(formData: FormData) {
  const session = await requireSession();
  const input = z.object({ name: z.string().min(2), phone: z.string().optional(), address: z.string().optional(), county: z.string().optional(), cancellationWindowHours: z.coerce.number().int().min(1).max(168), defaultDeposit: z.coerce.number().min(0) }).parse(Object.fromEntries(formData));
  await db.update(salons).set({ ...input, defaultDepositCents: Math.round(input.defaultDeposit * 100), updatedAt: new Date() }).where(eq(salons.id, session.salonId));
  revalidatePath("/dashboard/settings");
}

export async function startStripeOnboardingAction() {
  const session = await requireSession();
  const salon = await db.query.salons.findFirst({ where: eq(salons.id, session.salonId) });
  if (!salon) redirect("/login");

  const stripe = requireStripe();
  let accountId = salon.stripeAccountId;

  if (!accountId) {
    const account = await stripe.accounts.create({
      type: "standard",
      country: "IE",
      email: salon.email,
      business_profile: {
        name: salon.name,
        product_description: "Salon appointment deposits",
      },
      metadata: { salonId: salon.id },
    });

    accountId = account.id;
    await db
      .update(salons)
      .set({ stripeAccountId: accountId, updatedAt: new Date() })
      .where(eq(salons.id, salon.id));
  } else {
    await syncStripeConnectStatus(salon.id);
  }

  const link = await stripe.accountLinks.create({
    account: accountId,
    type: "account_onboarding",
    refresh_url: `${env.NEXT_PUBLIC_APP_URL}/dashboard/settings?stripe=refresh`,
    return_url: `${env.NEXT_PUBLIC_APP_URL}/dashboard/settings?stripe=return`,
  });

  redirect(link.url);
}

export async function refreshStripeStatusAction() {
  const session = await requireSession();
  await syncStripeConnectStatus(session.salonId);
  revalidatePath("/dashboard/settings");
  redirect("/dashboard/settings?stripe=checked");
}

export async function recordOutcomeAction(formData: FormData) {
  const session = await requireSession();
  const bookingId = z.string().uuid().parse(formData.get("bookingId"));
  const outcome = z.enum(["completed", "no_show"]).parse(formData.get("outcome"));
  const booking = await db.query.bookings.findFirst({ where: and(eq(bookings.id, bookingId), eq(bookings.salonId, session.salonId)), with: { customer: true, salon: true } });
  if (!booking || booking.status !== "confirmed") return;
  await db.transaction(async (tx) => {
    await tx.update(bookings).set({ status: outcome, outcomeRecordedAt: new Date(), updatedAt: new Date() }).where(and(eq(bookings.id, bookingId), eq(bookings.status, "confirmed")));
    if (outcome === "no_show") await tx.update(customers).set({ noShowCount: booking.customer.noShowCount + 1, updatedAt: new Date() }).where(eq(customers.id, booking.customerId));
    await tx.insert(auditLog).values({ salonId: session.salonId, action: `booking.${outcome}`, entityType: "booking", entityId: booking.id });
  });
  if (booking.customer.email) await sendOutcome({ to: booking.customer.email, salon: booking.salon.name, outcome, depositCents: booking.depositCents });
  revalidatePath("/dashboard"); revalidatePath("/dashboard/bookings");
}
