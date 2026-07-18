"use server";

import { randomBytes } from "crypto";
import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/db";
import { referralCampaigns, referrals } from "@/db/marketing-schema";
import { customers } from "@/db/schema";
import { requireSession } from "@/lib/session";

export async function issueReferralLinkAction(formData: FormData) {
  const session = await requireSession();
  const input = z.object({ campaignId: z.string().uuid(), customerId: z.string().uuid() }).parse(Object.fromEntries(formData));
  const [campaign, customer] = await Promise.all([
    db.query.referralCampaigns.findFirst({ where: and(eq(referralCampaigns.id, input.campaignId), eq(referralCampaigns.salonId, session.salonId), eq(referralCampaigns.active, true)) }),
    db.query.customers.findFirst({ where: and(eq(customers.id, input.customerId), eq(customers.salonId, session.salonId)) }),
  ]);
  if (!campaign || !customer) throw new Error("Campaign or customer not found.");
  const existing = await db.query.referrals.findFirst({ where: and(eq(referrals.campaignId, campaign.id), eq(referrals.referrerCustomerId, customer.id), eq(referrals.status, "issued")) });
  if (!existing) await db.insert(referrals).values({ campaignId: campaign.id, salonId: session.salonId, referrerCustomerId: customer.id, code: `REF-${randomBytes(5).toString("hex").toUpperCase()}` });
  revalidatePath("/dashboard/marketing/referrals");
}
