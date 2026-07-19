"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/db";
import { automationDefinitions, weeklyReportPreferences } from "@/db/operations-schema";
import { requireSession } from "@/lib/session";

const automationInput = z.object({
  automationType: z.enum(["booking_confirmation", "appointment_reminder", "post_appointment_thanks", "review_request", "rebooking_reminder", "missed_appointment_follow_up"]),
  trigger: z.enum(["booking_confirmed", "before_appointment", "appointment_completed", "appointment_no_show"]),
  delayMinutes: z.coerce.number().int().min(-10080).max(525600),
  channel: z.enum(["email", "sms"]),
  template: z.string().trim().min(10).max(4000),
  retryLimit: z.coerce.number().int().min(0).max(5),
});

export async function saveAutomationAction(formData: FormData) {
  const session = await requireSession();
  const input = automationInput.parse(Object.fromEntries(formData));
  await db.insert(automationDefinitions).values({ ...input, salonId: session.salonId, enabled: formData.get("enabled") === "on", ownerApprovalRequired: formData.get("ownerApprovalRequired") === "on" })
    .onConflictDoUpdate({ target: [automationDefinitions.salonId, automationDefinitions.automationType], set: { ...input, enabled: formData.get("enabled") === "on", ownerApprovalRequired: formData.get("ownerApprovalRequired") === "on", updatedAt: new Date() } });
  revalidatePath("/dashboard/automations");
  revalidatePath("/dashboard");
}

export async function saveWeeklyReportPreferenceAction(formData: FormData) {
  const session = await requireSession();
  const values = { salonId: session.salonId, enabled: formData.get("enabled") === "on", emailEnabled: formData.get("emailEnabled") === "on", updatedAt: new Date() };
  await db.insert(weeklyReportPreferences).values(values).onConflictDoUpdate({ target: weeklyReportPreferences.salonId, set: values });
  revalidatePath("/dashboard/automations");
  revalidatePath("/dashboard");
}
