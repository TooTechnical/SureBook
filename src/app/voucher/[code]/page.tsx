import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { BadgeCheck, CalendarClock, Gift, ShieldCheck } from "lucide-react";
import { db } from "@/db";
import { giftVouchers } from "@/db/marketing-schema";
import { salons } from "@/db/schema";
import { euro } from "@/lib/utils";

export default async function Page({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const voucher = await db.query.giftVouchers.findFirst({ where: eq(giftVouchers.code, code.toUpperCase()) });
  if (!voucher || voucher.status === "pending" || voucher.status === "cancelled") notFound();
  const salon = await db.query.salons.findFirst({ where: eq(salons.id, voucher.salonId) });
  if (!salon) notFound();
  const expired = Boolean(voucher.expiresAt && voucher.expiresAt < new Date());
  const status = expired ? "Expired" : voucher.status === "redeemed" ? "Fully redeemed" : "Active";
  const accent = salon.accentColor === "#111827" ? "#ef4b32" : salon.accentColor;

  return <main style={{ minHeight: "100vh", background: "#080b10", color: "white", display: "grid", placeItems: "center", padding: 20 }}>
    <article style={{ width: "min(720px,100%)", border: `2px solid ${accent}`, borderRadius: 26, background: "#11161d", padding: "clamp(26px,6vw,58px)", boxShadow: "0 30px 100px rgba(0,0,0,.45)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 18, alignItems: "start" }}><div><span style={{ color: accent, fontWeight: 900, textTransform: "uppercase", letterSpacing: ".12em", fontSize: 12 }}>SureBook verified voucher</span><h1 style={{ fontSize: "clamp(34px,7vw,62px)", margin: "12px 0" }}>{salon.name}</h1></div><Gift size={46} color={accent} /></div>
      <div style={{ margin: "26px 0", padding: 22, borderRadius: 18, background: "#090d12" }}><small style={{ color: "#9aa5b4" }}>Remaining balance</small><div style={{ fontSize: "clamp(48px,9vw,80px)", fontWeight: 950 }}>{euro(voucher.balanceCents)}</div><p style={{ color: "#9aa5b4" }}>Original value: {euro(voucher.amountCents)}</p></div>
      <div style={{ display: "grid", gap: 12 }}><div style={{ display: "flex", gap: 10, alignItems: "center" }}><BadgeCheck color={accent} /><strong>Status: {status}</strong></div><div style={{ display: "flex", gap: 10, alignItems: "center" }}><ShieldCheck color={accent} /><span>Code: {voucher.code}</span></div>{voucher.recipientName && <div><strong>For:</strong> {voucher.recipientName}</div>}{voucher.message && <blockquote style={{ margin: 0, padding: "16px 18px", borderLeft: `4px solid ${accent}`, color: "#cbd5e1" }}>“{voucher.message}”</blockquote>}{voucher.expiresAt && <div style={{ display: "flex", gap: 10, alignItems: "center" }}><CalendarClock color={accent} /><span>Expires {voucher.expiresAt.toLocaleDateString("en-IE", { timeZone: "Europe/Dublin" })}</span></div>}</div>
      <a href={`/book/${salon.slug}`} style={{ marginTop: 28, display: "inline-flex", padding: "14px 20px", borderRadius: 12, background: accent, color: "white", fontWeight: 900, textDecoration: "none" }}>Book with {salon.name}</a>
    </article>
  </main>;
}
