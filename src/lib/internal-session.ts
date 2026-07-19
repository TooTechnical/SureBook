import { cookies } from "next/headers";
import { jwtVerify, SignJWT } from "jose";
import { redirect } from "next/navigation";
import { env } from "@/lib/env";
import { hasInternalPermission, type InternalPermission, type InternalRole } from "@/lib/internal-authz";

const key = new TextEncoder().encode(env.SESSION_SECRET);
const cookieName = "surebook_internal_session";
export type InternalSession = { userId: string; email: string; name: string; role: InternalRole };

export async function createInternalSession(payload: InternalSession) {
  const token = await new SignJWT(payload).setProtectedHeader({ alg: "HS256" }).setAudience("surebook-internal").setIssuedAt().setExpirationTime("8h").sign(key);
  (await cookies()).set(cookieName, token, { httpOnly: true, sameSite: "strict", secure: process.env.NODE_ENV === "production", path: "/internal", maxAge: 60 * 60 * 8 });
}

export async function clearInternalSession() { (await cookies()).delete(cookieName); }

export async function getInternalSession(): Promise<InternalSession | null> {
  const token = (await cookies()).get(cookieName)?.value;
  if (!token) return null;
  try { const { payload } = await jwtVerify(token, key, { audience: "surebook-internal" }); return payload as unknown as InternalSession; } catch { return null; }
}

export async function requireInternalPermission(permission: InternalPermission) {
  const session = await getInternalSession();
  if (!session) redirect("/internal/login");
  if (!hasInternalPermission(session.role, permission)) throw new Error("Forbidden");
  return session;
}
