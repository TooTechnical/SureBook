import { and, desc, eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { Gift, HeartHandshake, Package, Sparkles } from "lucide-react";
import { startGiftVoucherCheckoutAction, startMembershipCheckoutAction, startPackageCheckoutAction } from "@/actions/commerce";
import { db } from "@/db";
import { memberships, referralCampaigns, servicePackages } from "@/db/marketing-schema";
import { salons } from "@/db/schema";
import { euro } from "@/lib/utils";

type PageProps = { params: Promise<{ slug: string }>; searchParams: Promise<{ purchase?: string }> };

function BuyerFields() {
  return <><div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))", gap: 10 }}><input className="input" name="name" placeholder="Your name" required /><input className="input" type="email" name="email" placeholder="Email" required /></div><input className="input" name="phone" placeholder="Mobile number" required /></>;
}

export default async function Page({ params, searchParams }: PageProps) {
  const { slug } = await params;
  const query = await searchParams;
  const salon = await db.query.salons.findFirst({ where: and(eq(salons.slug, slug), eq(salons.storefrontPublished, true)) });
  if (!salon) notFound();
  const [membershipRows, packages, referrals] = await Promise.all([
    db.query.memberships.findMany({ where: and(eq(memberships.salonId, salon.id), eq(memberships.active, true)), orderBy: [desc(memberships.createdAt)] }),
    db.query.servicePackages.findMany({ where: and(eq(servicePackages.salonId, salon.id), eq(servicePackages.active, true)), orderBy: [desc(servicePackages.createdAt)] }),
    db.query.referralCampaigns.findMany({ where: and(eq(referralCampaigns.salonId, salon.id), eq(referralCampaigns.active, true)), orderBy: [desc(referralCampaigns.createdAt)] }),
  ]);

  const accent = salon.accentColor === "#111827" ? "#ef4b32" : salon.accentColor;
  return <main style={{ minHeight: "100vh", background: "#090c10", color: "#f8fafc", padding: "28px 18px 80px" }}>
    <div style={{ width: "min(1180px,100%)", margin: "0 auto" }}>
      <header style={{ display: "flex", justifyContent: "space-between", gap: 16, alignItems: "center", marginBottom: 28 }}><a href={`/book/${slug}`} style={{ color: "white", textDecoration: "none", fontWeight: 900, fontSize: 22 }}>← {salon.name}</a><a href={`/book/${slug}#book`} style={{ background: accent, color: "white", padding: "12px 18px", borderRadius: 12, textDecoration: "none", fontWeight: 900 }}>Book appointment</a></header>
      {query.purchase === "success" && <div style={{ padding: 18, border: "1px solid #22c55e", borderRadius: 14, background: "rgba(34,197,94,.1)", marginBottom: 24 }}><strong>Purchase complete.</strong> Stripe has confirmed your payment. The business will receive the purchase details.</div>}
      {query.purchase === "cancelled" && <div style={{ padding: 18, border: "1px solid #f59e0b", borderRadius: 14, background: "rgba(245,158,11,.1)", marginBottom: 24 }}><strong>Checkout cancelled.</strong> Nothing was charged.</div>}
      <section style={{ padding: "clamp(28px,6vw,72px)", borderRadius: 24, border: "1px solid #222936", background: `linear-gradient(135deg,${accent}22,#11161d 55%)`, marginBottom: 34 }}><span style={{ color: accent, fontWeight: 900, textTransform: "uppercase", letterSpacing: ".12em", fontSize: 12 }}>Offers &amp; rewards</span><h1 style={{ fontSize: "clamp(42px,7vw,78px)", lineHeight: .98, margin: "12px 0 18px" }}>More value from {salon.name}</h1><p style={{ maxWidth: 720, color: "#aeb7c4", fontSize: 19, lineHeight: 1.7 }}>Buy a gift, commit to a package or join a membership. Payments are processed securely through Stripe and paid directly to the business.</p></section>

      <section style={{ marginBottom: 42 }}><div style={{ display: "flex", gap: 10, alignItems: "center" }}><Gift color={accent} /><h2>Gift vouchers</h2></div><form action={startGiftVoucherCheckoutAction} style={{ display: "grid", gap: 12, padding: 22, borderRadius: 18, border: "1px solid #222936", background: "#11161d" }}><input type="hidden" name="slug" value={slug} /><BuyerFields /><div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))", gap: 10 }}><input className="input" type="number" min="10" max="5000" step="1" name="amount" placeholder="Voucher amount €" required /><input className="input" name="recipientName" placeholder="Recipient name" required /><input className="input" type="email" name="recipientEmail" placeholder="Recipient email" /></div><textarea className="input" name="message" rows={3} placeholder="Personal message" /><button className="btn btn-primary" style={{ background: accent }}>Buy gift voucher</button></form></section>

      {membershipRows.length > 0 && <section style={{ marginBottom: 42 }}><div style={{ display: "flex", gap: 10, alignItems: "center" }}><Sparkles color={accent} /><h2>Memberships</h2></div><div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(300px,1fr))", gap: 16 }}>{membershipRows.map((item) => <form action={startMembershipCheckoutAction} key={item.id} style={{ display: "grid", gap: 12, padding: 22, borderRadius: 18, border: "1px solid #222936", background: "#11161d" }}><input type="hidden" name="slug" value={slug} /><input type="hidden" name="membershipId" value={item.id} /><div><span style={{ color: accent, fontWeight: 900 }}>Monthly membership</span><h3 style={{ fontSize: 26, margin: "8px 0" }}>{item.name}</h3><p style={{ color: "#aeb7c4", lineHeight: 1.6 }}>{item.description}</p><h3>{euro(item.priceCents)} / month</h3><p>{item.visitsIncluded} visits included{item.priorityBooking ? " · Priority booking" : ""}</p></div><BuyerFields /><button className="btn btn-primary" style={{ background: accent }}>Join membership</button></form>)}</div></section>}

      {packages.length > 0 && <section style={{ marginBottom: 42 }}><div style={{ display: "flex", gap: 10, alignItems: "center" }}><Package color={accent} /><h2>Service packages</h2></div><div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(300px,1fr))", gap: 16 }}>{packages.map((item) => <form action={startPackageCheckoutAction} key={item.id} style={{ display: "grid", gap: 12, padding: 22, borderRadius: 18, border: "1px solid #222936", background: "#11161d" }}><input type="hidden" name="slug" value={slug} /><input type="hidden" name="packageId" value={item.id} /><div><span style={{ color: accent, fontWeight: 900 }}>{item.sessionCount} sessions</span><h3 style={{ fontSize: 26, margin: "8px 0" }}>{item.name}</h3><p style={{ color: "#aeb7c4", lineHeight: 1.6 }}>{item.description}</p><h3>{euro(item.priceCents)}</h3><small>Valid for {item.validityDays} days</small></div><BuyerFields /><button className="btn btn-primary" style={{ background: accent }}>Buy package</button></form>)}</div></section>}

      {referrals.length > 0 && <section><div style={{ display: "flex", gap: 10, alignItems: "center" }}><HeartHandshake color={accent} /><h2>Refer a friend</h2></div><div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(280px,1fr))", gap: 16 }}>{referrals.map((item) => <article key={item.id} style={{ padding: 22, borderRadius: 18, border: "1px solid #222936", background: "#11161d" }}><h3>{item.name}</h3><p style={{ fontSize: 20 }}><strong>{euro(item.advocateRewardCents)}</strong> for you and <strong>{euro(item.friendRewardCents)}</strong> for your friend.</p><p style={{ color: "#aeb7c4", lineHeight: 1.6 }}>{item.terms || "Rewards are issued after the referred customer's qualifying appointment is completed."}</p><p style={{ color: accent, fontWeight: 900 }}>Referral links are generated from the customer CRM.</p></article>)}</div></section>}
    </div>
  </main>;
}
