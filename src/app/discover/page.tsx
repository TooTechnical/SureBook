import type { Metadata } from "next";
import { and, asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { salons } from "@/db/schema";
import { euro } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Discover appointment businesses in Ireland | SureBook",
  description: "Find and book trusted massage therapists, barbers, aestheticians, salons and appointment professionals across Ireland.",
};

const categories = ["All", "Massage therapy", "Barber", "Hair salon", "Aesthetics", "Beauty & wellness", "Nail technician", "Tattoo studio", "Physiotherapy", "Personal training", "Other appointment service"];

export default async function DiscoverPage({ searchParams }: { searchParams: Promise<{ q?: string; category?: string; county?: string }> }) {
  const params = await searchParams;
  const query = (params.q || "").trim().toLowerCase();
  const category = params.category || "All";
  const county = (params.county || "").trim().toLowerCase();

  const businesses = await db.query.salons.findMany({
    where: and(eq(salons.storefrontPublished, true), eq(salons.stripeChargesEnabled, true)),
    with: { services: true, reviews: true, storefrontImages: true },
    orderBy: [asc(salons.name)],
  });

  const filtered = businesses.filter((business) => {
    const haystack = [business.name, business.tagline, business.description, business.businessCategory, business.county, ...business.services.map((service) => `${service.name} ${service.description || ""}`)].join(" ").toLowerCase();
    return (!query || haystack.includes(query)) && (category === "All" || business.businessCategory === category) && (!county || (business.county || "").toLowerCase().includes(county));
  });

  return (
    <main style={{ minHeight: "100vh", background: "#f8fafc" }}>
      <div className="container" style={{ padding: "42px 0 80px" }}>
        <div style={{ maxWidth: 780, marginBottom: 30 }}><span className="badge">SureBook discovery</span><h1 style={{ fontSize: "clamp(42px,7vw,72px)", letterSpacing: "-.05em", lineHeight: 1.02 }}>Find trusted local services and book instantly.</h1><p style={{ fontSize: 19, color: "var(--muted)" }}>Explore verified appointment businesses across Ireland. Compare services, prices, photos and customer reviews before booking securely.</p></div>

        <form className="card" style={{ padding: 18, display: "grid", gridTemplateColumns: "2fr 1fr 1fr auto", gap: 12, marginBottom: 30 }}>
          <label><span className="label">What do you need?</span><input className="input" name="q" defaultValue={params.q || ""} placeholder="Sports massage, fade, facial..." /></label>
          <label><span className="label">Category</span><select className="input" name="category" defaultValue={category}>{categories.map((item) => <option key={item}>{item}</option>)}</select></label>
          <label><span className="label">County or city</span><input className="input" name="county" defaultValue={params.county || ""} placeholder="Dublin" /></label>
          <button className="btn btn-primary" style={{ alignSelf: "end" }}>Search</button>
        </form>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}><h2 style={{ margin: 0 }}>{filtered.length} business{filtered.length === 1 ? "" : "es"} found</h2>{(query || county || category !== "All") && <a href="/discover">Clear filters</a>}</div>

        {filtered.length === 0 ? <section className="card" style={{ padding: 40, textAlign: "center" }}><h2>No matching storefronts yet</h2><p>Try a broader service, category or location.</p></section> : <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(300px,1fr))", gap: 20 }}>{filtered.map((business) => {
          const approved = business.reviews.filter((review) => review.approved);
          const rating = approved.length ? approved.reduce((sum, review) => sum + review.rating, 0) / approved.length : null;
          const activeServices = business.services.filter((service) => service.active);
          const fromPrice = activeServices.length ? Math.min(...activeServices.map((service) => service.priceCents)) : null;
          const image = business.coverImageUrl || business.storefrontImages[0]?.imageUrl;
          return <article key={business.id} className="card" style={{ overflow: "hidden" }}><div style={{ height: 190, background: image ? `url(${image}) center/cover` : `linear-gradient(135deg,${business.accentColor},#334155)` }} /> <div style={{ padding: 22 }}>{business.logoUrl && <img src={business.logoUrl} alt={`${business.name} logo`} style={{ width: 64, height: 64, objectFit: "cover", borderRadius: 16, background: "white", padding: 4, marginTop: -54, border: "3px solid white" }} />}<span className="badge" style={{ display: "inline-block", marginTop: 10 }}>{business.businessCategory}</span><h2 style={{ marginBottom: 6 }}>{business.name}</h2>{business.tagline && <p style={{ color: "var(--muted)" }}>{business.tagline}</p>}<div style={{ display: "flex", gap: 14, flexWrap: "wrap", marginBottom: 16 }}>{business.county && <span>📍 {business.county}</span>}{rating && <span>★ {rating.toFixed(1)} ({approved.length})</span>}{fromPrice !== null && <span>From {euro(fromPrice)}</span>}</div><a className="btn btn-primary" href={`/book/${business.slug}`}>View and book</a></div></article>;
        })}</div>}
      </div>
    </main>
  );
}
