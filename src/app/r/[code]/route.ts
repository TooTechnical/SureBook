import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { referrals } from "@/db/marketing-schema";
import { salons } from "@/db/schema";

export async function GET(request: Request, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const referral = await db.query.referrals.findFirst({ where: eq(referrals.code, code.toUpperCase()) });
  if (!referral || !["issued", "visited"].includes(referral.status)) return NextResponse.redirect(new URL("/discover", request.url));
  const salon = await db.query.salons.findFirst({ where: eq(salons.id, referral.salonId) });
  if (!salon) return NextResponse.redirect(new URL("/discover", request.url));
  if (referral.status === "issued") await db.update(referrals).set({ status: "visited" }).where(eq(referrals.id, referral.id));
  const response = NextResponse.redirect(new URL(`/book/${salon.slug}`, request.url));
  response.cookies.set("surebook_referral", referral.code, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: `/book/${salon.slug}`, maxAge: 60 * 60 * 24 * 30 });
  return response;
}
