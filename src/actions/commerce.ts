"use server";

import { randomBytes } from "crypto";
import { addDays, addYears } from "date-fns";
import { and, eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/db";
import { giftVouchers, memberships, membershipSubscriptions, packagePurchases, servicePackages } from "@/db/marketing-schema";
import { customers, salons } from "@/db/schema";
import { env } from "@/lib/env";
import { requireStripe } from "@/lib/stripe";

const buyer = z.object({
  slug: z.string().min(1), name: z.string().trim().min(2).max(160), email: z.string().email(), phone: z.string().trim().min(6).max(40),
});

async function getCommerceSalon(slug: string) {
  const salon = await db.query.salons.findFirst({ where: eq(salons.slug, slug) });
  if (!salon || !salon.storefrontPublished) throw new Error("Business not found.");
  if (!salon.stripeAccountId || !salon.stripeChargesEnabled) throw new Error("This business is not ready to accept online purchases.");
  return salon;
}

async function upsertCustomer(input: z.infer<typeof buyer>, salonId: string) {
  const [customer] = await db.insert(customers).values({ salonId, name: input.name, phone: input.phone, email: input.email }).onConflictDoUpdate({ target: [customers.salonId, customers.phone], set: { name: input.name, email: input.email, updatedAt: new Date() } }).returning();
  return customer;
}

export async function startGiftVoucherCheckoutAction(formData: FormData) {
  const input = buyer.extend({ amount: z.coerce.number().min(10).max(5000), recipientName: z.string().trim().min(2).max(160), recipientEmail: z.string().email().optional().or(z.literal("")), message: z.string().trim().max(500).optional() }).parse(Object.fromEntries(formData));
  const salon = await getCommerceSalon(input.slug);
  const code = `SB-${randomBytes(5).toString("hex").toUpperCase()}`;
  const amountCents = Math.round(input.amount * 100);
  const [voucher] = await db.insert(giftVouchers).values({ salonId: salon.id, code, purchaserName: input.name, purchaserEmail: input.email, recipientName: input.recipientName, recipientEmail: input.recipientEmail || null, message: input.message || null, amountCents, balanceCents: amountCents, status: "pending", expiresAt: addYears(new Date(), 5) }).returning();
  const fee = Math.round(amountCents * (env.PLATFORM_FEE_PERCENT / 100));
  const session = await requireStripe().checkout.sessions.create({
    mode: "payment", customer_email: input.email,
    line_items: [{ quantity: 1, price_data: { currency: "eur", unit_amount: amountCents, product_data: { name: `${salon.name} gift voucher`, description: `Gift voucher for ${input.recipientName}` } } }],
    payment_intent_data: { application_fee_amount: fee, transfer_data: { destination: salon.stripeAccountId }, on_behalf_of: salon.stripeAccountId, metadata: { commerceType: "gift_voucher", recordId: voucher.id, salonId: salon.id } },
    metadata: { commerceType: "gift_voucher", recordId: voucher.id, salonId: salon.id },
    success_url: `${env.NEXT_PUBLIC_APP_URL}/offers/${salon.slug}?purchase=success`, cancel_url: `${env.NEXT_PUBLIC_APP_URL}/offers/${salon.slug}?purchase=cancelled`,
  });
  await db.update(giftVouchers).set({ stripeCheckoutSessionId: session.id }).where(eq(giftVouchers.id, voucher.id));
  redirect(session.url!);
}

export async function startPackageCheckoutAction(formData: FormData) {
  const input = buyer.extend({ packageId: z.string().uuid() }).parse(Object.fromEntries(formData));
  const salon = await getCommerceSalon(input.slug);
  const packageRow = await db.query.servicePackages.findFirst({ where: and(eq(servicePackages.id, input.packageId), eq(servicePackages.salonId, salon.id), eq(servicePackages.active, true)) });
  if (!packageRow) throw new Error("Package not found.");
  const customer = await upsertCustomer(input, salon.id);
  const [purchase] = await db.insert(packagePurchases).values({ packageId: packageRow.id, salonId: salon.id, customerId: customer.id, sessionsRemaining: packageRow.sessionCount, amountPaidCents: packageRow.priceCents, status: "pending", expiresAt: addDays(new Date(), packageRow.validityDays) }).returning();
  const fee = Math.round(packageRow.priceCents * (env.PLATFORM_FEE_PERCENT / 100));
  const session = await requireStripe().checkout.sessions.create({
    mode: "payment", customer_email: input.email,
    line_items: [{ quantity: 1, price_data: { currency: "eur", unit_amount: packageRow.priceCents, product_data: { name: packageRow.name, description: packageRow.description || `${packageRow.sessionCount} service sessions` } } }],
    payment_intent_data: { application_fee_amount: fee, transfer_data: { destination: salon.stripeAccountId }, on_behalf_of: salon.stripeAccountId, metadata: { commerceType: "package", recordId: purchase.id, salonId: salon.id } },
    metadata: { commerceType: "package", recordId: purchase.id, salonId: salon.id },
    success_url: `${env.NEXT_PUBLIC_APP_URL}/offers/${salon.slug}?purchase=success`, cancel_url: `${env.NEXT_PUBLIC_APP_URL}/offers/${salon.slug}?purchase=cancelled`,
  });
  await db.update(packagePurchases).set({ stripeCheckoutSessionId: session.id }).where(eq(packagePurchases.id, purchase.id));
  redirect(session.url!);
}

export async function startMembershipCheckoutAction(formData: FormData) {
  const input = buyer.extend({ membershipId: z.string().uuid() }).parse(Object.fromEntries(formData));
  const salon = await getCommerceSalon(input.slug);
  const membership = await db.query.memberships.findFirst({ where: and(eq(memberships.id, input.membershipId), eq(memberships.salonId, salon.id), eq(memberships.active, true)) });
  if (!membership) throw new Error("Membership not found.");
  const customer = await upsertCustomer(input, salon.id);
  const [subscription] = await db.insert(membershipSubscriptions).values({ membershipId: membership.id, salonId: salon.id, customerId: customer.id, status: "pending", visitsRemaining: membership.visitsIncluded }).returning();
  const session = await requireStripe().checkout.sessions.create({
    mode: "subscription", customer_email: input.email,
    line_items: [{ quantity: 1, price_data: { currency: "eur", unit_amount: membership.priceCents, recurring: { interval: "month" }, product_data: { name: membership.name, description: membership.description || `${membership.visitsIncluded} visits per month` } } }],
    subscription_data: { application_fee_percent: env.PLATFORM_FEE_PERCENT, transfer_data: { destination: salon.stripeAccountId }, metadata: { commerceType: "membership", recordId: subscription.id, salonId: salon.id } },
    metadata: { commerceType: "membership", recordId: subscription.id, salonId: salon.id },
    success_url: `${env.NEXT_PUBLIC_APP_URL}/offers/${salon.slug}?purchase=success`, cancel_url: `${env.NEXT_PUBLIC_APP_URL}/offers/${salon.slug}?purchase=cancelled`,
  });
  redirect(session.url!);
}
