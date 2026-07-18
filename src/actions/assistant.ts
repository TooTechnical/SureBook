"use server";

import { and, desc, eq, gte, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/db";
import { aiGenerations } from "@/db/marketing-schema";
import { bookings, customers, reviews, salons, services } from "@/db/schema";
import { env } from "@/lib/env";
import { requireSession } from "@/lib/session";

const assistantInput = z.object({
  task: z.enum(["instagram", "seo", "booking_diagnosis", "promotion", "loyalty", "custom"]),
  prompt: z.string().trim().min(3).max(2000),
});

function extractOutput(payload: unknown) {
  if (!payload || typeof payload !== "object") return "";
  const response = payload as { output_text?: string; output?: Array<{ content?: Array<{ type?: string; text?: string }> }> };
  if (response.output_text) return response.output_text.trim();
  return (response.output || [])
    .flatMap((item) => item.content || [])
    .filter((part) => part.type === "output_text" && part.text)
    .map((part) => part.text)
    .join("\n")
    .trim();
}

export async function runAssistantAction(input: z.infer<typeof assistantInput>) {
  const session = await requireSession();
  const data = assistantInput.parse(input);
  if (!env.OPENAI_API_KEY) throw new Error("SureBook Growth Operator is not configured. Add OPENAI_API_KEY to the environment.");

  const thirtyDaysAgo = new Date(Date.now() - 30 * 86_400_000);
  const [salon, serviceRows, reviewRows, recentBookings, customerStats, recentGenerations] = await Promise.all([
    db.query.salons.findFirst({ where: eq(salons.id, session.salonId) }),
    db.query.services.findMany({ where: and(eq(services.salonId, session.salonId), eq(services.active, true)) }),
    db.query.reviews.findMany({ where: and(eq(reviews.salonId, session.salonId), eq(reviews.approved, true)), orderBy: [desc(reviews.createdAt)], limit: 20 }),
    db.query.bookings.findMany({ where: and(eq(bookings.salonId, session.salonId), gte(bookings.startsAt, thirtyDaysAgo)), with: { service: true } }),
    db.select({
      total: sql<number>`count(*)`,
      marketingConsented: sql<number>`count(*) filter (where ${customers.marketingConsent} = true)`,
      noShows: sql<number>`coalesce(sum(${customers.noShowCount}), 0)`,
    }).from(customers).where(eq(customers.salonId, session.salonId)),
    db.query.aiGenerations.findMany({ where: eq(aiGenerations.salonId, session.salonId), orderBy: [desc(aiGenerations.createdAt)], limit: 3 }),
  ]);

  if (!salon) throw new Error("Business not found.");

  const completed = recentBookings.filter((booking) => booking.status === "completed");
  const cancelled = recentBookings.filter((booking) => booking.status === "cancelled");
  const noShows = recentBookings.filter((booking) => booking.status === "no_show");
  const serviceDemand = new Map<string, number>();
  for (const booking of completed) serviceDemand.set(booking.service.name, (serviceDemand.get(booking.service.name) || 0) + 1);
  const popularServices = [...serviceDemand.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);
  const averageRating = reviewRows.length ? reviewRows.reduce((sum, review) => sum + review.rating, 0) / reviewRows.length : null;

  const context = {
    business: {
      name: salon.name,
      category: salon.businessCategory,
      county: salon.county,
      tagline: salon.tagline,
      description: salon.description,
      seoTitle: salon.seoTitle,
      seoDescription: salon.seoDescription,
    },
    services: serviceRows.map((service) => ({
      name: service.name,
      description: service.description,
      durationMinutes: service.durationMinutes,
      priceEuro: service.priceCents / 100,
      depositEuro: service.depositCents / 100,
    })),
    reputation: {
      reviewCount: reviewRows.length,
      averageRating: averageRating ? Number(averageRating.toFixed(2)) : null,
      recentReviewComments: reviewRows.map((review) => review.comment).filter(Boolean).slice(0, 5),
    },
    last30Days: {
      bookings: recentBookings.length,
      completed: completed.length,
      cancelled: cancelled.length,
      noShows: noShows.length,
      completionRate: recentBookings.length ? Number((completed.length / recentBookings.length).toFixed(3)) : null,
      noShowRate: recentBookings.length ? Number((noShows.length / recentBookings.length).toFixed(3)) : null,
      popularServices,
    },
    customers: customerStats[0] || { total: 0, marketingConsented: 0, noShows: 0 },
  };

  const taskInstructions: Record<typeof data.task, string> = {
    instagram: "Create a ready-to-publish Instagram campaign grounded in the verified business data. Return: campaign objective, audience, hook, post copy, call to action, 8-12 local hashtags, suggested visual, and one measurable success metric. Do not invent offers, qualifications, outcomes, addresses, ratings or prices.",
    seo: "Audit the supplied storefront SEO. Return: score out of 100, evidence-based findings, improved SEO title, improved meta description, local keyword targets, FAQ ideas, and five prioritised actions. Do not claim rankings or search volume you cannot verify.",
    booking_diagnosis: "Act as an appointment-business growth operator. Diagnose booking friction using only the supplied data. Separate verified observations from hypotheses. Return the five highest-impact actions, a 14-day experiment plan, owners for each action, and measurable success criteria.",
    promotion: "Create a commercially responsible promotion plan. Return: objective, target segment, offer structure, safeguards, launch checklist, social post, email subject/body, expiry wording, terms, and success metrics. Do not invent discounts or prices that were not explicitly requested by the owner.",
    loyalty: "Create a GDPR-aware loyalty campaign using the verified business context. Return: objective, target segment, reward logic, anti-abuse rules, launch message, follow-up message, and measurable retention metrics.",
    custom: "Answer as SureBook Growth Operator, an expert operating adviser for appointment businesses. Use verified data, state assumptions clearly, prioritise recommendations by impact and effort, and finish with the next three concrete actions the owner should take.",
  };

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${env.OPENAI_API_KEY}` },
    body: JSON.stringify({
      model: env.OPENAI_MODEL,
      reasoning: { effort: "high" },
      max_output_tokens: 4000,
      store: false,
      input: [
        {
          role: "developer",
          content: `You are SureBook Growth Operator, an AI decision layer for legitimate appointment-based businesses. Analyse live operational context and turn it into practical, measurable actions. Never fabricate business facts, reviews, availability, qualifications, prices, customer consent, medical claims or financial results. Never expose personal customer data. Use Irish English and EUR where relevant. Clearly label verified observations, assumptions and recommended actions. ${taskInstructions[data.task]}`,
        },
        {
          role: "user",
          content: `Owner request: ${data.prompt}\n\nVerified SureBook business context:\n${JSON.stringify(context, null, 2)}\n\nPrevious assistant topics for continuity only:\n${recentGenerations.map((item) => `${item.task}: ${item.prompt}`).join("\n")}`,
        },
      ],
    }),
  });

  if (!response.ok) {
    const detail = await response.text();
    console.error("OpenAI response error", response.status, detail.slice(0, 1000));
    throw new Error("SureBook Growth Operator could not generate a response. Try again shortly.");
  }

  const payload = await response.json();
  const output = extractOutput(payload);
  if (!output) throw new Error("SureBook Growth Operator returned an empty response.");

  const [generation] = await db.insert(aiGenerations).values({
    salonId: session.salonId,
    task: data.task,
    prompt: data.prompt,
    output,
    metadata: { model: env.OPENAI_MODEL, contextVersion: 2, reasoningEffort: "high", generatedForBuildWeek: true },
  }).returning({ id: aiGenerations.id });

  revalidatePath("/dashboard/assistant");
  return { id: generation.id, output, model: env.OPENAI_MODEL };
}
