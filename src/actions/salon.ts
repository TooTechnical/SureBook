"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/db";
import { auditLog, bookings, customers, salons, services, staff, storefrontImages } from "@/db/schema";
import { requireSession } from "@/lib/session";
import { requireStripe } from "@/lib/stripe";
import { syncStripeConnectStatus } from "@/lib/stripe-connect";
import { env } from "@/lib/env";
import { sendOutcome } from "@/lib/email";

const optionalUrl = z.string().trim().url().optional().or(z.literal(""));

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

export async function updateStorefrontAction(formData: FormData) {
  const session = await requireSession();
  const input = z.object({
    businessCategory: z.string().trim().min(2).max(80),
    tagline: z.string().trim().max(180).optional(),
    description: z.string().trim().max(4000).optional(),
    logoUrl: optionalUrl,
    coverImageUrl: optionalUrl,
    accentColor: z.string().regex(/^#[0-9a-fA-F]{6}$/),
    instagramUrl: optionalUrl,
    facebookUrl: optionalUrl,
    tiktokUrl: optionalUrl,
    websiteUrl: optionalUrl,
    seoTitle: z.string().trim().max(180).optional(),
    seoDescription: z.string().trim().max(320).optional(),
    storefrontPublished: z.enum(["on"]).optional(),
  }).parse(Object.fromEntries(formData));

  await db.update(salons).set({
    businessCategory: input.businessCategory,
    tagline: input.tagline || null,
    description: input.description || null,
    logoUrl: input.logoUrl || null,
    coverImageUrl: input.coverImageUrl || null,
    accentColor: input.accentColor,
    instagramUrl: input.instagramUrl || null,
    facebookUrl: input.facebookUrl || null,
    tiktokUrl: input.tiktokUrl || null,
    websiteUrl: input.websiteUrl || null,
    seoTitle: input.seoTitle || null,
    seoDescription: input.seoDescription || null,
    storefrontPublished: input.storefrontPublished === "on",
    updatedAt: new Date(),
  }).where(eq(salons.id, session.salonId));

  const salon = await db.query.salons.findFirst({ where: eq(salons.id, session.salonId) });
  revalidatePath("/dashboard/settings");
  if (salon) revalidatePath(`/book/${salon.slug}`);
}

export async function addStorefrontImageAction(formData: FormData) {
  const session = await requireSession();
  const input = z.object({ imageUrl: z.string().trim().url(), altText: z.string().trim().max(180).optional() }).parse(Object.fromEntries(formData));
  const existing = await db.query.storefrontImages.findMany({ where: eq(storefrontImages.salonId, session.salonId) });
  if (existing.length >= 12) throw new Error("A storefront can have up to 12 gallery images.");
  await db.insert(storefrontImages).values({ salonId: session.salonId, imageUrl: input.imageUrl, altText: input.altText || null, sortOrder: existing.length });
  const salon = await db.query.salons.findFirst({ where: eq(salons.id, session.salonId) });
  revalidatePath("/dashboard/settings");
  if (salon) revalidatePath(`/book/${salon.slug}`);
}

export async function removeStorefrontImageAction(formData: FormData) {
  const session = await requireSession();
  const imageId = z.string().uuid().parse(formData.get("imageId"));
  await db.delete(storefrontImages).where(and(eq(storefrontImages.id, imageId), eq(storefrontImages.salonId, session.salonId)));
  const salon = await db.query.salons.findFirst({ where: eq(salons.id, session.salonId) });
  revalidatePath("/dashboard/settings");
  if (salon) revalidatePath(`/book/${salon.slug}`);
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
        product_description: `${salon.businessCategory} appointment deposits`,
      },
      metadata: { salonId: salon.id },
    });

    accountId = account.id;
    await db.update(salons).set({ stripeAccountId: accountId, updatedAt: new Date() }).where(eq(salons.id, salon.id));
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
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/bookings");
}