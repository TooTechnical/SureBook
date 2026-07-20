import { addMinutes } from "date-fns";
import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { automationDefinitions, automationExecutions } from "@/db/operations-schema";
import { automationIdempotencyKey } from "@/lib/analytics";
import { isMissingDatabaseRelation } from "@/lib/optional-schema";

type Trigger = "booking_confirmed" | "before_appointment" | "appointment_completed" | "appointment_no_show";

export async function scheduleBookingAutomations(input: { salonId: string; bookingId: string; triggers: Trigger[]; appointmentTime: Date; eventTime?: Date }) {
  let definitions: (typeof automationDefinitions.$inferSelect)[];
  try {
    definitions = await db.query.automationDefinitions.findMany({ where: and(eq(automationDefinitions.salonId, input.salonId), eq(automationDefinitions.enabled, true), inArray(automationDefinitions.trigger, input.triggers)) });
  } catch (error) {
    if (isMissingDatabaseRelation(error)) return;
    throw error;
  }
  const eventTime = input.eventTime || new Date();
  for (const definition of definitions) {
    const base = definition.trigger === "before_appointment" ? input.appointmentTime : eventTime;
    const scheduledFor = addMinutes(base, definition.delayMinutes);
    await db.insert(automationExecutions).values({ salonId: input.salonId, automationId: definition.id, bookingId: input.bookingId, scheduledFor, idempotencyKey: automationIdempotencyKey({ automationId: definition.id, bookingId: input.bookingId, scheduledFor }) }).onConflictDoNothing({ target: automationExecutions.idempotencyKey });
  }
}

export function renderAutomationTemplate(template: string, values: Record<string, string>) {
  return template.replace(/\{\{([a-z_]+)\}\}/g, (_, key: string) => values[key] || "");
}
