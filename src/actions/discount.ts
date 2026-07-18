"use server";

import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { discountCodes } from "@/db/marketing-schema";
import { salons, services } from "@/db/schema";

export async function validateDiscountCodeAction(input: { slug: string; serviceId: string; code: string }) {
  const data = z.object({ slug: z.string().min(1), serviceId: z.string().uuid(), code: z.string().trim().min(3).max(40) }).parse(input);
  const salon = await db.query.salons.findFirst({ where: eq(salons.slug, data.slug) });
  if (!salon) throw new Error("Business not found.");
  const service = await db.query.services.findFirst({ where: and(eq(services.id, data.serviceId), eq(services.salonId, salon.id), eq(services.active, true)) });
  if (!service) throw new Error("Choose a valid service.");
  const code = data.code.toUpperCase();
  const discount = await db.query.discountCodes.findFirst({ where: and(eq(discountCodes.salonId, salon.id), eq(discountCodes.code, code), eq(discountCodes.active, true)) });
  if (!discount) throw new Error("That discount code is invalid or inactive.");
  const now = new Date();
  if (discount.startsAt && discount.startsAt > now) throw new Error("That discount code is not active yet.");
  if (discount.endsAt && discount.endsAt < now) throw new Error("That discount code has expired.");
  if (discount.maximumRedemptions && discount.redemptionCount >= discount.maximumRedemptions) throw new Error("That discount code has reached its usage limit.");
  if (service.priceCents < discount.minimumSpendCents) throw new Error(`Minimum service value: €${(discount.minimumSpendCents / 100).toFixed(2)}.`);
  const raw = discount.type === "percent" ? Math.round(service.priceCents * (discount.amount / 100)) : discount.amount;
  const discountAmountCents = Math.min(raw, service.priceCents);
  return { code: discount.code, description: discount.description, discountAmountCents, discountedServicePriceCents: service.priceCents - discountAmountCents };
}
