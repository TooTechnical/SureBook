import { NextResponse } from "next/server";
import { and, asc, eq, lte } from "drizzle-orm";
import { db } from "@/db";
import { automationExecutions } from "@/db/operations-schema";
import { renderAutomationTemplate } from "@/lib/automation";
import { sendAutomationEmail } from "@/lib/email";
import { env } from "@/lib/env";
import { getSmsProvider } from "@/lib/sms";

export async function GET(request: Request) {
  if (!env.CRON_SECRET || request.headers.get("authorization") !== `Bearer ${env.CRON_SECRET}`) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const due = await db.query.automationExecutions.findMany({ where: and(eq(automationExecutions.status, "scheduled"), lte(automationExecutions.scheduledFor, new Date())), with: { automation: true, booking: { with: { customer: true, service: true, salon: true } } }, orderBy: [asc(automationExecutions.scheduledFor)], limit: 100 });
  const result = { sent: 0, failed: 0, skipped: 0 };
  for (const execution of due) {
    const claimed = await db.update(automationExecutions).set({ status: "processing", attempts: execution.attempts + 1, updatedAt: new Date() }).where(and(eq(automationExecutions.id, execution.id), eq(automationExecutions.status, "scheduled"))).returning({ id: automationExecutions.id });
    if (!claimed.length || !execution.booking) continue;
    const { automation, booking } = execution;
    const isMarketing = automation.automationType === "rebooking_reminder";
    if ((isMarketing && !booking.customer.marketingConsent) || !booking.customer.email && automation.channel === "email") {
      await db.update(automationExecutions).set({ status: "skipped", failureMessage: isMarketing ? "Customer has not provided marketing consent" : "Customer email unavailable", updatedAt: new Date() }).where(eq(automationExecutions.id, execution.id));
      result.skipped += 1;
      continue;
    }
    const body = renderAutomationTemplate(automation.template, { business_name: booking.salon.name, service_name: booking.service.name, appointment_time: booking.startsAt.toLocaleString("en-IE", { timeZone: booking.salon.timezone }), review_url: `${env.NEXT_PUBLIC_APP_URL}/review/${booking.id}`, storefront_url: `${env.NEXT_PUBLIC_APP_URL}/book/${booking.salon.slug}` });
    try {
      if (automation.channel === "email" && booking.customer.email) await sendAutomationEmail({ to: booking.customer.email, subject: `${booking.salon.name}: appointment update`, body });
      else {
        const provider = getSmsProvider();
        if (!provider.configured || !booking.customer.smsConsent) throw new Error(provider.configured ? "Customer has not provided SMS consent" : "SMS provider not configured");
        await provider.send({ to: booking.customer.phone, body, idempotencyKey: execution.idempotencyKey });
      }
      await db.update(automationExecutions).set({ status: "sent", sentAt: new Date(), failureMessage: null, updatedAt: new Date() }).where(eq(automationExecutions.id, execution.id));
      result.sent += 1;
    } catch (error) {
      const retry = execution.attempts + 1 < automation.retryLimit;
      await db.update(automationExecutions).set({ status: retry ? "scheduled" : "failed", failureMessage: error instanceof Error ? error.message.slice(0, 500) : "Delivery failed", updatedAt: new Date() }).where(eq(automationExecutions.id, execution.id));
      result.failed += 1;
    }
  }
  return NextResponse.json(result);
}
