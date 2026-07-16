import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import Stripe from "stripe";
import { db } from "@/db";
import { giftVouchers, membershipSubscriptions, packagePurchases } from "@/db/marketing-schema";
import { bookings, salons } from "@/db/schema";
import { env } from "@/lib/env";
import { requireStripe } from "@/lib/stripe";
import { sendBookingConfirmation } from "@/lib/email";

export async function POST(request: Request) {
  if (!env.STRIPE_WEBHOOK_SECRET) return NextResponse.json({ error: "Webhook not configured" }, { status: 503 });
  const body = await request.text();
  const signature = (await headers()).get("stripe-signature");
  if (!signature) return NextResponse.json({ error: "Missing signature" }, { status: 400 });

  let event: Stripe.Event;
  try {
    event = requireStripe().webhooks.constructEvent(body, signature, env.STRIPE_WEBHOOK_SECRET);
  } catch {
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  try {
    if (event.type === "payment_intent.succeeded") {
      const paymentIntent = event.data.object;
      const bookingId = paymentIntent.metadata.bookingId;
      const booking = bookingId ? await db.query.bookings.findFirst({ where: eq(bookings.id, bookingId), with: { customer: true, service: true, salon: true } }) : null;
      if (booking && booking.status === "pending_payment") {
        await db.update(bookings).set({ status: "confirmed", paymentStatus: "paid", stripeChargeId: typeof paymentIntent.latest_charge === "string" ? paymentIntent.latest_charge : null, updatedAt: new Date() }).where(eq(bookings.id, booking.id));
        if (booking.customer.email) await sendBookingConfirmation({ to: booking.customer.email, salon: booking.salon.name, service: booking.service.name, startsAt: booking.startsAt, depositCents: booking.depositCents });
      }
    }

    if (event.type === "checkout.session.completed") {
      const session = event.data.object;
      const commerceType = session.metadata?.commerceType;
      const recordId = session.metadata?.recordId;
      if (commerceType === "gift_voucher" && recordId) await db.update(giftVouchers).set({ status: "active", stripeCheckoutSessionId: session.id }).where(eq(giftVouchers.id, recordId));
      if (commerceType === "package" && recordId) await db.update(packagePurchases).set({ status: "active", stripeCheckoutSessionId: session.id }).where(eq(packagePurchases.id, recordId));
      if (commerceType === "membership" && recordId) await db.update(membershipSubscriptions).set({ status: "active", stripeSubscriptionId: typeof session.subscription === "string" ? session.subscription : null, currentPeriodStart: new Date() }).where(eq(membershipSubscriptions.id, recordId));
    }

    if (event.type === "customer.subscription.deleted") {
      const subscription = event.data.object;
      await db.update(membershipSubscriptions).set({ status: "cancelled", currentPeriodEnd: new Date() }).where(eq(membershipSubscriptions.stripeSubscriptionId, subscription.id));
    }

    if (event.type === "invoice.paid") {
      const invoice = event.data.object;
      const subscriptionId = typeof invoice.parent?.subscription_details?.subscription === "string" ? invoice.parent.subscription_details.subscription : null;
      if (subscriptionId) {
        const record = await db.query.membershipSubscriptions.findFirst({ where: eq(membershipSubscriptions.stripeSubscriptionId, subscriptionId), with: { membership: true } });
        if (record) await db.update(membershipSubscriptions).set({ status: "active", visitsRemaining: record.membership.visitsIncluded, currentPeriodStart: new Date(), currentPeriodEnd: record.membership.billingInterval === "month" ? new Date(Date.now() + 31 * 86_400_000) : null }).where(eq(membershipSubscriptions.id, record.id));
      }
    }

    if (event.type === "payment_intent.payment_failed") {
      const paymentIntent = event.data.object;
      if (paymentIntent.metadata.bookingId) await db.update(bookings).set({ paymentStatus: "failed", updatedAt: new Date() }).where(eq(bookings.id, paymentIntent.metadata.bookingId));
    }

    if (event.type === "charge.dispute.created") {
      const charge = event.data.object;
      const paymentIntentId = typeof charge.payment_intent === "string" ? charge.payment_intent : null;
      if (paymentIntentId) await db.update(bookings).set({ paymentStatus: "disputed", updatedAt: new Date() }).where(eq(bookings.stripePaymentIntentId, paymentIntentId));
    }

    if (event.type === "account.updated") {
      const account = event.data.object;
      const update = { stripeChargesEnabled: account.charges_enabled, stripePayoutsEnabled: account.payouts_enabled, updatedAt: new Date() };
      if (account.metadata?.salonId) await db.update(salons).set(update).where(eq(salons.id, account.metadata.salonId));
      else await db.update(salons).set(update).where(eq(salons.stripeAccountId, account.id));
    }

    if (event.type === "account.application.deauthorized") {
      const connectedAccountId = typeof event.account === "string" ? event.account : null;
      if (connectedAccountId) await db.update(salons).set({ stripeAccountId: null, stripeChargesEnabled: false, stripePayoutsEnabled: false, updatedAt: new Date() }).where(eq(salons.stripeAccountId, connectedAccountId));
    }
  } catch (error) {
    console.error("Stripe webhook error", error);
    return NextResponse.json({ error: "Webhook processing failed" }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
