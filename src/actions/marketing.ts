"use server";

import { randomBytes } from "crypto";
import { addDays, addYears } from "date-fns";
import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/db";
import { discountCodes, giftVouchers, memberships, referralCampaigns, servicePackages } from "@/db/marketing-schema";
import { services } from "@/db/schema";
import { requireSession } from "@/lib/session";

const optionalDate = z.string().optional().transform((value) => value ? new Date(value) : null);
const optionalUuid = z.string().uuid().optional().or(z.literal(""));

export async function createDiscountCodeAction(formData: FormData) {
  const session = await requireSession();
  const input = z.object({
    code: z.string().trim().min(3).max(40).transform((value) => value.toUpperCase().replace(/[^A-Z0-9_-]/g, "")),
    description: z.string().trim().max(220).optional(), type: z.enum(["percent", "fixed"]), amount: z.coerce.number().positive(),
    minimumSpend: z.coerce.number().min(0).default(0), maximumRedemptions: z.coerce.number().int().positive().optional(),
    startsAt: optionalDate, endsAt: optionalDate,
  }).parse(Object.fromEntries(formData));
  const amount = input.type === "percent" ? Math.round(input.amount) : Math.round(input.amount * 100);
  if (input.type === "percent" && amount > 100) throw new Error("Percentage discounts cannot exceed 100%.");
  if (input.startsAt && input.endsAt && input.endsAt <= input.startsAt) throw new Error("End date must be after the start date.");
  await db.insert(discountCodes).values({ salonId: session.salonId, code: input.code, description: input.description || null, type: input.type, amount, minimumSpendCents: Math.round(input.minimumSpend * 100), maximumRedemptions: input.maximumRedemptions || null, startsAt: input.startsAt, endsAt: input.endsAt });
  revalidatePath("/dashboard/marketing");
}

export async function toggleDiscountCodeAction(formData: FormData) {
  const session = await requireSession();
  const id = z.string().uuid().parse(formData.get("id"));
  const active = z.enum(["true", "false"]).parse(formData.get("active")) === "true";
  await db.update(discountCodes).set({ active }).where(and(eq(discountCodes.id, id), eq(discountCodes.salonId, session.salonId)));
  revalidatePath("/dashboard/marketing");
}

export async function createReferralCampaignAction(formData: FormData) {
  const session = await requireSession();
  const input = z.object({ name: z.string().trim().min(3).max(160), advocateReward: z.coerce.number().min(0), friendReward: z.coerce.number().min(0), terms: z.string().trim().max(1500).optional() }).parse(Object.fromEntries(formData));
  await db.insert(referralCampaigns).values({ salonId: session.salonId, name: input.name, advocateRewardCents: Math.round(input.advocateReward * 100), friendRewardCents: Math.round(input.friendReward * 100), terms: input.terms || null });
  revalidatePath("/dashboard/marketing");
}

export async function createGiftVoucherAction(formData: FormData) {
  const session = await requireSession();
  const input = z.object({ amount: z.coerce.number().positive(), recipientName: z.string().trim().min(2).max(160), recipientEmail: z.string().email().optional().or(z.literal("")), purchaserName: z.string().trim().max(160).optional(), purchaserEmail: z.string().email().optional().or(z.literal("")), message: z.string().trim().max(500).optional(), expiresAt: optionalDate }).parse(Object.fromEntries(formData));
  const code = `SB-${randomBytes(5).toString("hex").toUpperCase()}`;
  const amountCents = Math.round(input.amount * 100);
  await db.insert(giftVouchers).values({ salonId: session.salonId, code, purchaserName: input.purchaserName || null, purchaserEmail: input.purchaserEmail || null, recipientName: input.recipientName, recipientEmail: input.recipientEmail || null, message: input.message || null, amountCents, balanceCents: amountCents, expiresAt: input.expiresAt || addYears(new Date(), 5) });
  revalidatePath("/dashboard/marketing");
}

export async function redeemGiftVoucherAction(formData: FormData) {
  const session = await requireSession();
  const input = z.object({ id: z.string().uuid(), amount: z.coerce.number().positive() }).parse(Object.fromEntries(formData));
  const voucher = await db.query.giftVouchers.findFirst({ where: and(eq(giftVouchers.id, input.id), eq(giftVouchers.salonId, session.salonId)) });
  if (!voucher || voucher.status !== "active") throw new Error("Voucher is not active.");
  const redemption = Math.round(input.amount * 100);
  if (redemption > voucher.balanceCents) throw new Error("Redemption exceeds the voucher balance.");
  const balanceCents = voucher.balanceCents - redemption;
  await db.update(giftVouchers).set({ balanceCents, status: balanceCents === 0 ? "redeemed" : "active" }).where(eq(giftVouchers.id, voucher.id));
  revalidatePath("/dashboard/marketing");
}

export async function createMembershipAction(formData: FormData) {
  const session = await requireSession();
  const input = z.object({ name: z.string().trim().min(3).max(160), description: z.string().trim().max(1500).optional(), price: z.coerce.number().positive(), visitsIncluded: z.coerce.number().int().min(0), priorityBooking: z.enum(["on"]).optional() }).parse(Object.fromEntries(formData));
  await db.insert(memberships).values({ salonId: session.salonId, name: input.name, description: input.description || null, priceCents: Math.round(input.price * 100), visitsIncluded: input.visitsIncluded, priorityBooking: input.priorityBooking === "on" });
  revalidatePath("/dashboard/marketing");
}

export async function createPackageAction(formData: FormData) {
  const session = await requireSession();
  const input = z.object({ serviceId: optionalUuid, name: z.string().trim().min(3).max(160), description: z.string().trim().max(1500).optional(), sessionCount: z.coerce.number().int().min(2).max(100), price: z.coerce.number().positive(), validityDays: z.coerce.number().int().min(1).max(3650) }).parse(Object.fromEntries(formData));
  if (input.serviceId) {
    const service = await db.query.services.findFirst({ where: and(eq(services.id, input.serviceId), eq(services.salonId, session.salonId)) });
    if (!service) throw new Error("Service not found.");
  }
  await db.insert(servicePackages).values({ salonId: session.salonId, serviceId: input.serviceId || null, name: input.name, description: input.description || null, sessionCount: input.sessionCount, priceCents: Math.round(input.price * 100), validityDays: input.validityDays });
  revalidatePath("/dashboard/marketing");
}
