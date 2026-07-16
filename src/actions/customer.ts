"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/db";
import { auditLog, customers } from "@/db/schema";
import { requireSession } from "@/lib/session";

const optionalUuid = z.string().uuid().optional().or(z.literal(""));

export async function updateCustomerProfileAction(formData: FormData) {
  const session = await requireSession();
  const input = z.object({
    customerId: z.string().uuid(),
    name: z.string().trim().min(2).max(160),
    email: z.string().trim().email().optional().or(z.literal("")),
    phone: z.string().trim().min(6).max(40),
    birthday: z.string().optional(),
    notes: z.string().trim().max(4000).optional(),
    tags: z.string().trim().max(1000).optional(),
    preferredStaffId: optionalUuid,
    preferredServiceId: optionalUuid,
    crmStatus: z.enum(["active", "vip", "at_risk", "inactive"]),
    marketingConsent: z.enum(["on"]).optional(),
    smsConsent: z.enum(["on"]).optional(),
    whatsappConsent: z.enum(["on"]).optional(),
  }).parse(Object.fromEntries(formData));

  const tags = (input.tags || "")
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean)
    .slice(0, 20);

  await db.update(customers).set({
    name: input.name,
    email: input.email || null,
    phone: input.phone,
    birthday: input.birthday ? new Date(`${input.birthday}T12:00:00.000Z`) : null,
    notes: input.notes || null,
    tags,
    preferredStaffId: input.preferredStaffId || null,
    preferredServiceId: input.preferredServiceId || null,
    crmStatus: input.crmStatus,
    marketingConsent: input.marketingConsent === "on",
    smsConsent: input.smsConsent === "on",
    whatsappConsent: input.whatsappConsent === "on",
    updatedAt: new Date(),
  }).where(and(eq(customers.id, input.customerId), eq(customers.salonId, session.salonId)));

  await db.insert(auditLog).values({
    salonId: session.salonId,
    action: "customer.profile_updated",
    entityType: "customer",
    entityId: input.customerId,
    metadata: { crmStatus: input.crmStatus, tags },
  });

  revalidatePath("/dashboard/customers");
  revalidatePath(`/dashboard/customers/${input.customerId}`);
}
