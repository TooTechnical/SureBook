import { Resend } from "resend";
import { env } from "@/lib/env";
import { euro } from "@/lib/utils";

const resend = env.RESEND_API_KEY ? new Resend(env.RESEND_API_KEY) : null;

async function send(to: string | string[], subject: string, html: string) {
  if (!resend) return;
  await resend.emails.send({ from: env.EMAIL_FROM, to, subject, html });
}

export async function sendBookingConfirmation(input: { to: string; salon: string; service: string; startsAt: Date; depositCents: number }) {
  return send(input.to, `Booking confirmed with ${input.salon}`, `<h1>Your appointment is confirmed</h1><p><strong>${input.service}</strong></p><p>${input.startsAt.toLocaleString("en-IE", { timeZone: "Europe/Dublin" })}</p><p>Deposit paid: ${euro(input.depositCents)}</p><p>Please contact the salon directly if you need to change your appointment.</p>`);
}

export async function sendReminder(input: { to: string; salon: string; service: string; startsAt: Date }) {
  return send(input.to, `Reminder: ${input.salon} appointment`, `<h1>Appointment reminder</h1><p>Your ${input.service} appointment is at ${input.startsAt.toLocaleString("en-IE", { timeZone: "Europe/Dublin" })}.</p>`);
}

export async function sendOutcome(input: { to: string; salon: string; outcome: "completed" | "no_show"; depositCents: number }) {
  const attended = input.outcome === "completed";
  return send(input.to, attended ? `Thanks for visiting ${input.salon}` : `No-show deposit retained by ${input.salon}`, `<h1>${attended ? "Thanks for visiting" : "Appointment outcome"}</h1><p>${attended ? "Your appointment was marked complete." : `Your ${euro(input.depositCents)} deposit was retained under the salon cancellation policy.`}</p>`);
}
