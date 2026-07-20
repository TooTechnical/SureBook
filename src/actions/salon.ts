"use server";

import { put } from "@vercel/blob";
import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/db";
import { auditLog, bookings, businessHours, customers, reviews, salons, serviceCategories, services, staff, storefrontImages } from "@/db/schema";
import { requireSession } from "@/lib/session";
import { requireStripe } from "@/lib/stripe";
import { syncStripeConnectStatus } from "@/lib/stripe-connect";
import { env } from "@/lib/env";
import { sendOutcome } from "@/lib/email";
import { scheduleBookingAutomations } from "@/lib/automation";

const optionalUrl = z.string().trim().url().optional().or(z.literal(""));
const optionalUuid = z.string().uuid().optional().or(z.literal(""));

async function revalidateBusiness(salonId: string) {
  const salon = await db.query.salons.findFirst({ where: eq(salons.id, salonId) });
  revalidatePath("/dashboard/settings");
  revalidatePath("/dashboard/staff");
  revalidatePath("/dashboard/services");
  revalidatePath("/discover");
  if (salon) revalidatePath(`/book/${salon.slug}`);
}

function assertImage(file: FormDataEntryValue | null, label = "image"): asserts file is File {
  if (!(file instanceof File) || file.size === 0) throw new Error(`Choose a ${label} to upload.`);
  if (!file.type.startsWith("image/")) throw new Error("Only image files are supported.");
  if (file.size > 5 * 1024 * 1024) throw new Error("Images must be smaller than 5 MB.");
}

export async function createServiceAction(formData: FormData) {
  const session = await requireSession();
  const input = z.object({ name: z.string().min(2), description: z.string().optional(), categoryId: optionalUuid, durationMinutes: z.coerce.number().int().min(5).max(600), price: z.coerce.number().min(0), deposit: z.coerce.number().min(0) }).parse(Object.fromEntries(formData));
  await db.insert(services).values({ salonId: session.salonId, categoryId: input.categoryId || null, name: input.name, description: input.description, durationMinutes: input.durationMinutes, priceCents: Math.round(input.price * 100), depositCents: Math.round(input.deposit * 100) });
  await revalidateBusiness(session.salonId);
}

export async function createServiceCategoryAction(formData: FormData) {
  const session = await requireSession();
  const input = z.object({ name: z.string().trim().min(2).max(120), description: z.string().trim().max(500).optional() }).parse(Object.fromEntries(formData));
  const rows = await db.query.serviceCategories.findMany({ where: eq(serviceCategories.salonId, session.salonId) });
  await db.insert(serviceCategories).values({ salonId: session.salonId, name: input.name, description: input.description || null, sortOrder: rows.length });
  await revalidateBusiness(session.salonId);
}

export async function createStaffAction(formData: FormData) {
  const session = await requireSession();
  const input = z.object({ name: z.string().min(2), title: z.string().trim().max(160).optional(), bio: z.string().trim().max(2000).optional(), email: z.string().email().optional().or(z.literal("")), phone: z.string().optional(), photoUrl: optionalUrl }).parse(Object.fromEntries(formData));
  await db.insert(staff).values({ salonId: session.salonId, name: input.name, title: input.title || null, bio: input.bio || null, photoUrl: input.photoUrl || null, email: input.email || null, phone: input.phone || null });
  await revalidateBusiness(session.salonId);
}

export async function updateStaffProfileAction(formData: FormData) {
  const session = await requireSession();
  const input = z.object({ staffId: z.string().uuid(), title: z.string().trim().max(160).optional(), bio: z.string().trim().max(2000).optional() }).parse(Object.fromEntries(formData));
  await db.update(staff).set({ title: input.title || null, bio: input.bio || null }).where(and(eq(staff.id, input.staffId), eq(staff.salonId, session.salonId)));
  await revalidateBusiness(session.salonId);
}

export async function updateSalonAction(formData: FormData) {
  const session = await requireSession();
  const input = z.object({ name: z.string().min(2), phone: z.string().optional(), address: z.string().optional(), county: z.string().optional(), eircode: z.string().optional(), cancellationWindowHours: z.coerce.number().int().min(1).max(168), defaultDeposit: z.coerce.number().min(0) }).parse(Object.fromEntries(formData));
  await db.update(salons).set({ name: input.name, phone: input.phone || null, address: input.address || null, county: input.county || null, eircode: input.eircode || null, cancellationWindowHours: input.cancellationWindowHours, defaultDepositCents: Math.round(input.defaultDeposit * 100), updatedAt: new Date() }).where(eq(salons.id, session.salonId));
  await revalidateBusiness(session.salonId);
}

export async function updateStorefrontAction(formData: FormData) {
  const session = await requireSession();
  const input = z.object({ businessCategory: z.string().trim().min(2).max(80), tagline: z.string().trim().max(180).optional(), description: z.string().trim().max(4000).optional(), logoUrl: optionalUrl, coverImageUrl: optionalUrl, accentColor: z.string().regex(/^#[0-9a-fA-F]{6}$/), storefrontTheme: z.enum(["modern", "luxury", "wellness", "barber"]), instagramUrl: optionalUrl, facebookUrl: optionalUrl, tiktokUrl: optionalUrl, websiteUrl: optionalUrl, seoTitle: z.string().trim().max(180).optional(), seoDescription: z.string().trim().max(320).optional(), storefrontPublished: z.enum(["on"]).optional() }).parse(Object.fromEntries(formData));
  await db.update(salons).set({ businessCategory: input.businessCategory, tagline: input.tagline || null, description: input.description || null, logoUrl: input.logoUrl || null, coverImageUrl: input.coverImageUrl || null, accentColor: input.accentColor, storefrontTheme: input.storefrontTheme, instagramUrl: input.instagramUrl || null, facebookUrl: input.facebookUrl || null, tiktokUrl: input.tiktokUrl || null, websiteUrl: input.websiteUrl || null, seoTitle: input.seoTitle || null, seoDescription: input.seoDescription || null, storefrontPublished: input.storefrontPublished === "on", updatedAt: new Date() }).where(eq(salons.id, session.salonId));
  await revalidateBusiness(session.salonId);
}

export async function uploadStorefrontMediaAction(formData: FormData) {
  const session = await requireSession();
  const target = z.enum(["logo", "cover", "gallery", "before_after", "staff"]).parse(formData.get("target"));
  const existing = await db.query.storefrontImages.findMany({ where: eq(storefrontImages.salonId, session.salonId) });
  if ((target === "gallery" || target === "before_after") && existing.length >= 12) throw new Error("A storefront can have up to 12 gallery items.");

  if (target === "before_after") {
    const beforeFile = formData.get("beforeFile");
    const afterFile = formData.get("afterFile");
    assertImage(beforeFile, "before image");
    assertImage(afterFile, "after image");
    const [beforeBlob, afterBlob] = await Promise.all([
      put(`surebook/${session.salonId}/before-${beforeFile.name}`, beforeFile, { access: "public", addRandomSuffix: true }),
      put(`surebook/${session.salonId}/after-${afterFile.name}`, afterFile, { access: "public", addRandomSuffix: true }),
    ]);
    await db.insert(storefrontImages).values({ salonId: session.salonId, imageUrl: beforeBlob.url, comparisonImageUrl: afterBlob.url, imageType: "before_after", altText: String(formData.get("altText") || "Before and after result") || null, sortOrder: existing.length });
    await revalidateBusiness(session.salonId);
    return;
  }

  const file = formData.get("file");
  assertImage(file);
  const blob = await put(`surebook/${session.salonId}/${target}-${file.name}`, file, { access: "public", addRandomSuffix: true });
  if (target === "logo") await db.update(salons).set({ logoUrl: blob.url, updatedAt: new Date() }).where(eq(salons.id, session.salonId));
  if (target === "cover") await db.update(salons).set({ coverImageUrl: blob.url, updatedAt: new Date() }).where(eq(salons.id, session.salonId));
  if (target === "gallery") await db.insert(storefrontImages).values({ salonId: session.salonId, imageUrl: blob.url, imageType: "gallery", altText: String(formData.get("altText") || "") || null, sortOrder: existing.length });
  if (target === "staff") {
    const staffId = z.string().uuid().parse(formData.get("staffId"));
    await db.update(staff).set({ photoUrl: blob.url }).where(and(eq(staff.id, staffId), eq(staff.salonId, session.salonId)));
  }
  await revalidateBusiness(session.salonId);
}

export async function addStorefrontImageAction(formData: FormData) {
  const session = await requireSession();
  const input = z.object({ imageUrl: z.string().trim().url(), altText: z.string().trim().max(180).optional() }).parse(Object.fromEntries(formData));
  const existing = await db.query.storefrontImages.findMany({ where: eq(storefrontImages.salonId, session.salonId) });
  if (existing.length >= 12) throw new Error("A storefront can have up to 12 gallery images.");
  await db.insert(storefrontImages).values({ salonId: session.salonId, imageUrl: input.imageUrl, imageType: "gallery", altText: input.altText || null, sortOrder: existing.length });
  await revalidateBusiness(session.salonId);
}

export async function removeStorefrontImageAction(formData: FormData) {
  const session = await requireSession();
  const imageId = z.string().uuid().parse(formData.get("imageId"));
  await db.delete(storefrontImages).where(and(eq(storefrontImages.id, imageId), eq(storefrontImages.salonId, session.salonId)));
  await revalidateBusiness(session.salonId);
}

export async function updateBusinessHoursAction(formData: FormData) {
  const session = await requireSession();
  await db.transaction(async (tx) => {
    for (let day = 0; day < 7; day += 1) {
      const closed = formData.get(`closed_${day}`) === "on";
      const openTime = String(formData.get(`open_${day}`) || "09:00");
      const closeTime = String(formData.get(`close_${day}`) || "17:00");
      const existing = await tx.query.businessHours.findFirst({ where: and(eq(businessHours.salonId, session.salonId), eq(businessHours.dayOfWeek, day)) });
      const values = { closed, openTime: closed ? null : openTime, closeTime: closed ? null : closeTime };
      if (existing) await tx.update(businessHours).set(values).where(eq(businessHours.id, existing.id));
      else await tx.insert(businessHours).values({ salonId: session.salonId, dayOfWeek: day, ...values });
    }
  });
  await revalidateBusiness(session.salonId);
}

export async function moderateReviewAction(formData: FormData) {
  const session = await requireSession();
  const reviewId = z.string().uuid().parse(formData.get("reviewId"));
  const approved = formData.get("approved") === "true";
  await db.update(reviews).set({ approved }).where(and(eq(reviews.id, reviewId), eq(reviews.salonId, session.salonId)));
  await revalidateBusiness(session.salonId);
}

export async function startStripeOnboardingAction() {
  const session = await requireSession();
  const salon = await db.query.salons.findFirst({ where: eq(salons.id, session.salonId) });
  if (!salon) redirect("/login");
  const stripe = requireStripe();
  let accountId = salon.stripeAccountId;
  if (!accountId) {
    const account = await stripe.accounts.create({ type: "standard", country: "IE", email: salon.email, business_profile: { name: salon.name, product_description: `${salon.businessCategory} appointment deposits` }, metadata: { salonId: salon.id } });
    accountId = account.id;
    await db.update(salons).set({ stripeAccountId: accountId, updatedAt: new Date() }).where(eq(salons.id, salon.id));
  } else await syncStripeConnectStatus(salon.id);
  const link = await stripe.accountLinks.create({ account: accountId, type: "account_onboarding", refresh_url: `${env.NEXT_PUBLIC_APP_URL}/dashboard/settings?stripe=refresh`, return_url: `${env.NEXT_PUBLIC_APP_URL}/dashboard/settings?stripe=return` });
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
  if (booking.customer.email) await sendOutcome({ to: booking.customer.email, salon: booking.salon.name, outcome, depositCents: booking.depositCents, reviewUrl: outcome === "completed" ? `${env.NEXT_PUBLIC_APP_URL}/review/${booking.id}` : undefined });
  await scheduleBookingAutomations({ salonId: booking.salonId, bookingId: booking.id, triggers: outcome === "completed" ? ["appointment_completed"] : ["appointment_no_show"], appointmentTime: booking.startsAt });
  revalidatePath("/dashboard"); revalidatePath("/dashboard/bookings");
}
