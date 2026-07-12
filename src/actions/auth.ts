"use server";

import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/db";
import { businessHours, salons, services, staff } from "@/db/schema";
import { clearSession, createSession } from "@/lib/session";
import { slugify } from "@/lib/utils";

const signupSchema = z.object({ name: z.string().min(2), email: z.string().email(), password: z.string().min(8), phone: z.string().min(6) });

export async function signupAction(formData: FormData) {
  const input = signupSchema.parse(Object.fromEntries(formData));
  const existing = await db.query.salons.findFirst({ where: eq(salons.email, input.email.toLowerCase()) });
  if (existing) redirect("/signup?error=account-exists");
  const base = slugify(input.name) || "salon";
  let slug = base;
  let suffix = 1;
  while (await db.query.salons.findFirst({ where: eq(salons.slug, slug) })) slug = `${base}-${++suffix}`;
  const passwordHash = await bcrypt.hash(input.password, 12);
  const [salon] = await db.insert(salons).values({ name: input.name, email: input.email.toLowerCase(), phone: input.phone, slug, passwordHash }).returning();
  await db.insert(staff).values({ salonId: salon.id, name: input.name, email: salon.email, phone: input.phone, role: "owner" });
  await db.insert(services).values({ salonId: salon.id, name: "Cut & Finish", durationMinutes: 45, priceCents: 4500, depositCents: 1000 });
  await db.insert(businessHours).values([0,1,2,3,4,5,6].map((day) => ({ salonId: salon.id, dayOfWeek: day, closed: day === 0, openTime: day === 0 ? null : "09:00", closeTime: day === 0 ? null : "18:00" })));
  await createSession({ salonId: salon.id, email: salon.email, name: salon.name });
  redirect("/dashboard/settings?welcome=1");
}

export async function loginAction(formData: FormData) {
  const email = z.string().email().parse(formData.get("email")).toLowerCase();
  const password = z.string().min(1).parse(formData.get("password"));
  const salon = await db.query.salons.findFirst({ where: eq(salons.email, email) });
  if (!salon || !(await bcrypt.compare(password, salon.passwordHash))) redirect("/login?error=invalid");
  await createSession({ salonId: salon.id, email: salon.email, name: salon.name });
  redirect("/dashboard");
}

export async function logoutAction() { await clearSession(); redirect("/"); }
