import Link from "next/link";
import { CalendarCheck, CreditCard, BellRing, Search, Image, Store } from "lucide-react";
import { Logo } from "@/components/Logo";

const features = [
  [Store, "Your business website, simplified", "Publish a professional branded storefront without hosting, plugins or a web developer."],
  [Image, "Show customers your best work", "Upload your logo, cover, gallery and team profiles from one straightforward dashboard."],
  [Search, "Built to be discovered", "SEO-ready storefronts and SureBook search help customers find services by category and location."],
  [CalendarCheck, "Booking built in", "Services, staff, opening hours and secure appointment booking live in the same platform."],
  [CreditCard, "Payments that belong to you", "Connect your own Stripe account and receive deposits and payments directly."],
  [BellRing, "Fewer missed appointments", "Automated confirmations, reminders, deposits and customer history protect your diary."],
];

export default function Home() {
  return <main>
    <header className="container" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "22px 0" }}><Logo /><nav style={{ display: "flex", gap: 12, flexWrap: "wrap" }}><Link className="btn btn-secondary" href="/discover">Discover businesses</Link><Link className="btn btn-secondary" href="/login">Log in</Link><Link className="btn btn-primary" href="/signup">Start free</Link></nav></header>
    <section className="container" style={{ padding: "72px 0 54px", display: "grid", gridTemplateColumns: "1.1fr .9fr", gap: 40, alignItems: "center" }}>
      <div><span className="badge">For appointment businesses across Ireland</span><h1 style={{ fontSize: "clamp(44px,7vw,78px)", lineHeight: .98, letterSpacing: "-.055em", margin: "22px 0" }}>Your storefront, bookings and payments—all without building a website.</h1><p style={{ fontSize: 20, lineHeight: 1.6, color: "var(--muted)", maxWidth: 720 }}>SureBook helps massage therapists, barbers, aestheticians and other appointment professionals launch a polished online presence, get discovered, accept bookings and take secure payments.</p><div style={{ display: "flex", gap: 12, marginTop: 28, flexWrap: "wrap" }}><Link href="/signup" className="btn btn-primary">Create your storefront</Link><Link href="/discover" className="btn btn-secondary">Explore SureBook</Link></div></div>
      <div className="card" style={{ overflow: "hidden" }}><div style={{ height: 210, background: "linear-gradient(135deg,#7c3aed,#ec4899)" }} /><div style={{ padding: 24 }}><span className="badge">Massage therapy · Dublin</span><h2>Harbour Wellness</h2><p style={{ color: "var(--muted)" }}>Sports massage, deep tissue and recovery treatments with instant online booking.</p><div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}><span className="badge">★ 4.9 verified</span><span className="badge">From €55</span><span className="badge">Secure deposits</span></div><button className="btn btn-primary" style={{ marginTop: 18 }}>View and book</button></div></div>
    </section>
    <section id="features" className="container" style={{ padding: "60px 0 90px" }}><h2 style={{ fontSize: 42, letterSpacing: "-.04em", maxWidth: 760 }}>Everything a small appointment business needs to look professional and operate online.</h2><div className="grid-auto" style={{ marginTop: 28 }}>{features.map(([Icon, title, body]) => <article className="card" style={{ padding: 22 }} key={String(title)}><Icon size={28} /><h3 style={{ fontSize: 20 }}>{String(title)}</h3><p style={{ color: "var(--muted)", lineHeight: 1.6 }}>{String(body)}</p></article>)}</div></section>
  </main>;
}
