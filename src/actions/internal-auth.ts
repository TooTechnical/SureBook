"use server";

import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/db";
import { adminAuditLogs, internalUsers } from "@/db/operations-schema";
import { clearInternalSession, createInternalSession } from "@/lib/internal-session";

export async function internalLoginAction(formData: FormData) {
  const input = z.object({ email: z.string().email(), password: z.string().min(1) }).parse(Object.fromEntries(formData));
  const user = await db.query.internalUsers.findFirst({ where: eq(internalUsers.email, input.email.toLowerCase()) });
  if (!user || !user.active || !(await bcrypt.compare(input.password, user.passwordHash))) redirect("/internal/login?error=invalid");
  await createInternalSession({ userId: user.id, email: user.email, name: user.name, role: user.role });
  await db.insert(adminAuditLogs).values({ actorId: user.id, action: "internal.login", entityType: "internal_user", entityId: user.id, metadata: { successful: true } });
  redirect("/internal");
}

export async function internalLogoutAction() { await clearInternalSession(); redirect("/internal/login"); }
