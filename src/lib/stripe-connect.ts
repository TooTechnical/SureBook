import { eq } from "drizzle-orm";
import { db } from "@/db";
import { salons } from "@/db/schema";
import { requireStripe } from "@/lib/stripe";

export type StripeConnectStatus = {
  accountId: string | null;
  detailsSubmitted: boolean;
  chargesEnabled: boolean;
  payoutsEnabled: boolean;
  requirementsDue: string[];
  disabledReason: string | null;
};

export async function syncStripeConnectStatus(salonId: string): Promise<StripeConnectStatus> {
  const salon = await db.query.salons.findFirst({
    where: eq(salons.id, salonId),
  });

  if (!salon?.stripeAccountId) {
    return {
      accountId: null,
      detailsSubmitted: false,
      chargesEnabled: false,
      payoutsEnabled: false,
      requirementsDue: [],
      disabledReason: null,
    };
  }

  const account = await requireStripe().accounts.retrieve(salon.stripeAccountId);
  const requirementsDue = account.requirements?.currently_due ?? [];
  const disabledReason = account.requirements?.disabled_reason ?? null;

  await db
    .update(salons)
    .set({
      stripeChargesEnabled: account.charges_enabled,
      stripePayoutsEnabled: account.payouts_enabled,
      updatedAt: new Date(),
    })
    .where(eq(salons.id, salonId));

  return {
    accountId: account.id,
    detailsSubmitted: account.details_submitted,
    chargesEnabled: account.charges_enabled,
    payoutsEnabled: account.payouts_enabled,
    requirementsDue,
    disabledReason,
  };
}
