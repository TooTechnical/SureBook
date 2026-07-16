"use server";

import { randomBytes } from "crypto";
import { addDays, addYears } from "date-fns";
import { and, eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import Stripe from "stripe";
import { z } from "zod";

import { db } from "@/db";
import {
  giftVouchers,
  memberships,
  membershipSubscriptions,
  packagePurchases,
  servicePackages,
} from "@/db/marketing-schema";
import { customers, salons } from "@/db/schema";
import { env } from "@/lib/env";
import { requireStripe } from "@/lib/stripe";

const buyerSchema = z.object({
  slug: z.string().trim().min(1),
  name: z.string().trim().min(2).max(160),
  email: z.string().trim().email(),
  phone: z.string().trim().min(6).max(40),
});

type BuyerInput = z.infer<typeof buyerSchema>;

async function getCommerceSalon(slug: string) {
  const salon = await db.query.salons.findFirst({
    where: eq(salons.slug, slug),
  });

  if (!salon || !salon.storefrontPublished) {
    throw new Error("Business not found.");
  }

  if (!salon.stripeAccountId || !salon.stripeChargesEnabled) {
    throw new Error(
      "This business is not ready to accept online purchases.",
    );
  }

  return {
    ...salon,
    stripeAccountId: salon.stripeAccountId,
  };
}

async function upsertCustomer(input: BuyerInput, salonId: string) {
  const [customer] = await db
    .insert(customers)
    .values({
      salonId,
      name: input.name,
      phone: input.phone,
      email: input.email,
    })
    .onConflictDoUpdate({
      target: [customers.salonId, customers.phone],
      set: {
        name: input.name,
        email: input.email,
        updatedAt: new Date(),
      },
    })
    .returning();

  if (!customer) {
    throw new Error("Unable to create or update the customer.");
  }

  return customer;
}

function requireCheckoutUrl(session: Stripe.Checkout.Session): string {
  if (!session.url) {
    throw new Error("Stripe Checkout did not return a payment URL.");
  }

  return session.url;
}

export async function startGiftVoucherCheckoutAction(
  formData: FormData,
) {
  const input = buyerSchema
    .extend({
      amount: z.coerce.number().min(10).max(5000),
      recipientName: z.string().trim().min(2).max(160),
      recipientEmail: z
        .string()
        .trim()
        .email()
        .optional()
        .or(z.literal("")),
      message: z.string().trim().max(500).optional(),
    })
    .parse(Object.fromEntries(formData));

  const salon = await getCommerceSalon(input.slug);
  const stripe = requireStripe();

  const code = `SB-${randomBytes(5)
    .toString("hex")
    .toUpperCase()}`;

  const amountCents = Math.round(input.amount * 100);

  const [voucher] = await db
    .insert(giftVouchers)
    .values({
      salonId: salon.id,
      code,
      purchaserName: input.name,
      purchaserEmail: input.email,
      recipientName: input.recipientName,
      recipientEmail: input.recipientEmail || null,
      message: input.message || null,
      amountCents,
      balanceCents: amountCents,
      status: "pending",
      expiresAt: addYears(new Date(), 5),
    })
    .returning();

  if (!voucher) {
    throw new Error("Unable to create the gift voucher.");
  }

  const applicationFeeAmount = Math.round(
    amountCents * (env.PLATFORM_FEE_PERCENT / 100),
  );

  const checkoutParams: Stripe.Checkout.SessionCreateParams = {
    mode: "payment",
    customer_email: input.email,

    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: "eur",
          unit_amount: amountCents,
          product_data: {
            name: `${salon.name} gift voucher`,
            description: `Gift voucher for ${input.recipientName}`,
          },
        },
      },
    ],

    payment_intent_data: {
      application_fee_amount: applicationFeeAmount,
      transfer_data: {
        destination: salon.stripeAccountId,
      },
      on_behalf_of: salon.stripeAccountId,
      metadata: {
        commerceType: "gift_voucher",
        recordId: voucher.id,
        salonId: salon.id,
      },
    },

    metadata: {
      commerceType: "gift_voucher",
      recordId: voucher.id,
      salonId: salon.id,
    },

    success_url: `${env.NEXT_PUBLIC_APP_URL}/offers/${salon.slug}?purchase=success`,
    cancel_url: `${env.NEXT_PUBLIC_APP_URL}/offers/${salon.slug}?purchase=cancelled`,
  };

  const checkoutSession =
    await stripe.checkout.sessions.create(checkoutParams);

  await db
    .update(giftVouchers)
    .set({
      stripeCheckoutSessionId: checkoutSession.id,
    })
    .where(eq(giftVouchers.id, voucher.id));

  redirect(requireCheckoutUrl(checkoutSession));
}

export async function startPackageCheckoutAction(
  formData: FormData,
) {
  const input = buyerSchema
    .extend({
      packageId: z.string().uuid(),
    })
    .parse(Object.fromEntries(formData));

  const salon = await getCommerceSalon(input.slug);
  const stripe = requireStripe();

  const packageRow =
    await db.query.servicePackages.findFirst({
      where: and(
        eq(servicePackages.id, input.packageId),
        eq(servicePackages.salonId, salon.id),
        eq(servicePackages.active, true),
      ),
    });

  if (!packageRow) {
    throw new Error("Package not found.");
  }

  const customer = await upsertCustomer(input, salon.id);

  const [purchase] = await db
    .insert(packagePurchases)
    .values({
      packageId: packageRow.id,
      salonId: salon.id,
      customerId: customer.id,
      sessionsRemaining: packageRow.sessionCount,
      amountPaidCents: packageRow.priceCents,
      status: "pending",
      expiresAt: addDays(
        new Date(),
        packageRow.validityDays,
      ),
    })
    .returning();

  if (!purchase) {
    throw new Error("Unable to create the package purchase.");
  }

  const applicationFeeAmount = Math.round(
    packageRow.priceCents *
    (env.PLATFORM_FEE_PERCENT / 100),
  );

  const checkoutParams: Stripe.Checkout.SessionCreateParams = {
    mode: "payment",
    customer_email: input.email,

    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: "eur",
          unit_amount: packageRow.priceCents,
          product_data: {
            name: packageRow.name,
            description:
              packageRow.description ||
              `${packageRow.sessionCount} service sessions`,
          },
        },
      },
    ],

    payment_intent_data: {
      application_fee_amount: applicationFeeAmount,
      transfer_data: {
        destination: salon.stripeAccountId,
      },
      on_behalf_of: salon.stripeAccountId,
      metadata: {
        commerceType: "package",
        recordId: purchase.id,
        salonId: salon.id,
      },
    },

    metadata: {
      commerceType: "package",
      recordId: purchase.id,
      salonId: salon.id,
    },

    success_url: `${env.NEXT_PUBLIC_APP_URL}/offers/${salon.slug}?purchase=success`,
    cancel_url: `${env.NEXT_PUBLIC_APP_URL}/offers/${salon.slug}?purchase=cancelled`,
  };

  const checkoutSession =
    await stripe.checkout.sessions.create(checkoutParams);

  await db
    .update(packagePurchases)
    .set({
      stripeCheckoutSessionId: checkoutSession.id,
    })
    .where(eq(packagePurchases.id, purchase.id));

  redirect(requireCheckoutUrl(checkoutSession));
}

export async function startMembershipCheckoutAction(
  formData: FormData,
) {
  const input = buyerSchema
    .extend({
      membershipId: z.string().uuid(),
    })
    .parse(Object.fromEntries(formData));

  const salon = await getCommerceSalon(input.slug);
  const stripe = requireStripe();

  const membership =
    await db.query.memberships.findFirst({
      where: and(
        eq(memberships.id, input.membershipId),
        eq(memberships.salonId, salon.id),
        eq(memberships.active, true),
      ),
    });

  if (!membership) {
    throw new Error("Membership not found.");
  }

  const customer = await upsertCustomer(input, salon.id);

  const [subscriptionRecord] = await db
    .insert(membershipSubscriptions)
    .values({
      membershipId: membership.id,
      salonId: salon.id,
      customerId: customer.id,
      status: "pending",
      visitsRemaining: membership.visitsIncluded,
    })
    .returning();

  if (!subscriptionRecord) {
    throw new Error(
      "Unable to create the membership subscription.",
    );
  }

  const checkoutParams: Stripe.Checkout.SessionCreateParams = {
    mode: "subscription",
    customer_email: input.email,

    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: "eur",
          unit_amount: membership.priceCents,
          recurring: {
            interval: "month",
          },
          product_data: {
            name: membership.name,
            description:
              membership.description ||
              `${membership.visitsIncluded} visits per month`,
          },
        },
      },
    ],

    subscription_data: {
      application_fee_percent:
        env.PLATFORM_FEE_PERCENT,
      transfer_data: {
        destination: salon.stripeAccountId,
      },
      metadata: {
        commerceType: "membership",
        recordId: subscriptionRecord.id,
        salonId: salon.id,
      },
    },

    metadata: {
      commerceType: "membership",
      recordId: subscriptionRecord.id,
      salonId: salon.id,
    },

    success_url: `${env.NEXT_PUBLIC_APP_URL}/offers/${salon.slug}?purchase=success`,
    cancel_url: `${env.NEXT_PUBLIC_APP_URL}/offers/${salon.slug}?purchase=cancelled`,
  };

  const checkoutSession =
    await stripe.checkout.sessions.create(checkoutParams);

  redirect(requireCheckoutUrl(checkoutSession));
}