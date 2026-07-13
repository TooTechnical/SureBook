import type { Metadata } from "next";
import { and, asc, eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { db } from "@/db";
import { salons, services, staff, storefrontImages } from "@/db/schema";
import { BookingCheckout } from "@/components/BookingCheckout";
import { Logo } from "@/components/Logo";
import { euro } from "@/lib/utils";

const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

type PageProps = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ confirmed?: string }>;
};

export async function generateMetadata({ params }: Pick<PageProps, "params">): Promise<Metadata> {
  const { slug } = await params;
  const salon = await db.query.salons.findFirst({ where: eq(salons.slug, slug) });
  if (!salon || !salon.storefrontPublished) return { title: "Storefront not found | SureBook" };

  const location = salon.county || "Ireland";
  const title = salon.seoTitle || `${salon.name} | ${salon.businessCategory} in ${location}`;
  const description = salon.seoDescription || salon.description?.slice(0, 300) || `View services, availability and book securely with ${salon.name} on SureBook.`;
  const canonical = `${appUrl}/book/${salon.slug}`;

  return {
    title,
    description,
    alternates: { canonical },
    openGraph: {
      title,
      description,
      url: canonical,
      type: "website",
      images: salon.coverImageUrl ? [{ url: salon.coverImageUrl }] : salon.logoUrl ? [{ url: salon.logoUrl }] : [],
    },
    twitter: { card: "summary_large_image", title, description, images: salon.coverImageUrl ? [salon.coverImageUrl] : [] },
  };
}

export default async function Page({ params, searchParams }: PageProps) {
  const { slug } = await params;
  const q = await searchParams;
  const salon = await db.query.salons.findFirst({ where: eq(salons.slug, slug) });
  if (!salon || !salon.storefrontPublished) notFound();

  const [svc, team, gallery] = await Promise.all([
    db.query.services.findMany({ where: and(eq(services.salonId, salon.id), eq(services.active, true)), orderBy: [asc(services.name)] }),
    db.query.staff.findMany({ where: and(eq(staff.salonId, salon.id), eq(staff.active, true)), orderBy: [asc(staff.name)] }),
    db.query.storefrontImages.findMany({ where: eq(storefrontImages.salonId, salon.id), orderBy: [asc(storefrontImages.sortOrder), asc(storefrontImages.createdAt)] }),
  ]);

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "LocalBusiness",
    name: salon.name,
    description: salon.description || salon.tagline || undefined,
    image: [salon.coverImageUrl, salon.logoUrl, ...gallery.map((image) => image.imageUrl)].filter(Boolean),
    url: `${appUrl}/book/${salon.slug}`,
    telephone: salon.phone || undefined,
    address: salon.address ? { "@type": "PostalAddress", streetAddress: salon.address, addressRegion: salon.county || undefined, addressCountry: "IE" } : undefined,
    priceRange: svc.length ? `${euro(Math.min(...svc.map((service) => service.priceCents)))}–${euro(Math.max(...svc.map((service) => service.priceCents)))}` : undefined,
    makesOffer: svc.map((service) => ({ "@type": "Offer", priceCurrency: "EUR", price: (service.priceCents / 100).toFixed(2), itemOffered: { "@type": "Service", name: service.name, description: service.description || undefined } })),
  };

  return (
    <main style={{ minHeight: "100vh", background: "#f8fafc" }}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <div className="container" style={{ padding: "22px 0 70px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16 }}>
          <Logo />
          <span className="badge">Powered by SureBook</span>
        </div>

        {q.confirmed ? (
          <section className="card" style={{ maxWidth: 720, margin: "60px auto", padding: 38, textAlign: "center" }}>
            <h1>Booking received</h1>
            <p>Your payment is being confirmed. You will receive an email as soon as SureBook receives final confirmation from Stripe.</p>
          </section>
        ) : (
          <>
            <section className="card" style={{ overflow: "hidden", marginTop: 24 }}>
              <div style={{ minHeight: 280, background: salon.coverImageUrl ? `linear-gradient(90deg,rgba(15,23,42,.72),rgba(15,23,42,.25)),url(${salon.coverImageUrl}) center/cover` : `linear-gradient(135deg,${salon.accentColor},#334155)`, padding: "48px clamp(24px,5vw,70px)", display: "flex", alignItems: "end" }}>
                <div style={{ color: "white", maxWidth: 760 }}>
                  {salon.logoUrl && <img src={salon.logoUrl} alt={`${salon.name} logo`} style={{ width: 92, height: 92, objectFit: "cover", borderRadius: 22, background: "white", padding: 6, marginBottom: 18 }} />}
                  <span style={{ display: "inline-block", background: "rgba(255,255,255,.16)", padding: "7px 11px", borderRadius: 999, fontSize: 13 }}>{salon.businessCategory}</span>
                  <h1 style={{ fontSize: "clamp(38px,7vw,68px)", lineHeight: 1, letterSpacing: "-.05em", margin: "16px 0 12px" }}>{salon.name}</h1>
                  {salon.tagline && <p style={{ fontSize: 21, margin: 0, maxWidth: 650 }}>{salon.tagline}</p>}
                </div>
              </div>
              <div style={{ padding: "20px clamp(22px,5vw,60px)", display: "flex", gap: 18, flexWrap: "wrap", alignItems: "center" }}>
                {salon.county && <span>📍 {salon.county}</span>}
                {salon.phone && <a href={`tel:${salon.phone}`}>☎ {salon.phone}</a>}
                {salon.instagramUrl && <a href={salon.instagramUrl} target="_blank" rel="noreferrer">Instagram</a>}
                {salon.facebookUrl && <a href={salon.facebookUrl} target="_blank" rel="noreferrer">Facebook</a>}
                {salon.tiktokUrl && <a href={salon.tiktokUrl} target="_blank" rel="noreferrer">TikTok</a>}
                {salon.websiteUrl && <a href={salon.websiteUrl} target="_blank" rel="noreferrer">Website</a>}
              </div>
            </section>

            {salon.description && <section style={{ maxWidth: 900, margin: "42px auto" }}><span className="badge">About</span><h2 style={{ fontSize: 34 }}>Welcome to {salon.name}</h2><p style={{ whiteSpace: "pre-line", color: "var(--muted)", fontSize: 18, lineHeight: 1.75 }}>{salon.description}</p></section>}

            {gallery.length > 0 && <section style={{ margin: "42px 0" }}><div style={{ display: "flex", justifyContent: "space-between", alignItems: "end", marginBottom: 16 }}><div><span className="badge">Gallery</span><h2 style={{ fontSize: 34, marginBottom: 0 }}>See our work</h2></div></div><div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: 14 }}>{gallery.map((image, index) => <img key={image.id} src={image.imageUrl} alt={image.altText || `${salon.name} gallery image ${index + 1}`} style={{ width: "100%", height: index === 0 ? 330 : 230, objectFit: "cover", borderRadius: 20, gridColumn: index === 0 && gallery.length > 2 ? "span 2" : undefined }} />)}</div></section>}

            <section style={{ margin: "50px 0" }}>
              <span className="badge">Services</span>
              <h2 style={{ fontSize: 38 }}>Choose what you need</h2>
              {svc.length === 0 ? <p style={{ color: "var(--muted)" }}>Services are being added. Contact the business directly for availability.</p> : <div className="grid-auto">{svc.map((service) => <article key={service.id} className="card" style={{ padding: 22, borderTop: `4px solid ${salon.accentColor}` }}><div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}><h3 style={{ marginTop: 0 }}>{service.name}</h3><strong>{euro(service.priceCents)}</strong></div>{service.description && <p style={{ color: "var(--muted)" }}>{service.description}</p>}<small>{service.durationMinutes} minutes · {service.depositCents > 0 ? `${euro(service.depositCents)} deposit` : "No deposit"}</small></article>)}</div>}
            </section>

            {team.length > 0 && <section style={{ margin: "50px 0" }}><span className="badge">Team</span><h2 style={{ fontSize: 38 }}>Book with confidence</h2><div className="grid-auto">{team.map((member) => <article key={member.id} className="card" style={{ padding: 22 }}><div style={{ width: 56, height: 56, borderRadius: "50%", display: "grid", placeItems: "center", background: salon.accentColor, color: "white", fontSize: 22, fontWeight: 700 }}>{member.name.charAt(0).toUpperCase()}</div><h3>{member.name}</h3><p style={{ color: "var(--muted)" }}>Available for online booking</p></article>)}</div></section>}

            <section id="book" className="card" style={{ padding: "clamp(22px,5vw,44px)", maxWidth: 900, margin: "50px auto", borderTop: `6px solid ${salon.accentColor}` }}>
              <span className="badge">Secure online booking</span>
              <h2 style={{ fontSize: 40, marginBottom: 8 }}>Book with {salon.name}</h2>
              <p style={{ color: "var(--muted)", fontSize: 18 }}>Choose a service, preferred team member and appointment time. A deposit may be required to secure the slot.</p>
              <BookingCheckout slug={slug} services={svc} staff={team} />
            </section>

            {(salon.address || salon.phone) && <section className="card" style={{ padding: 26, maxWidth: 900, margin: "0 auto" }}><h2>Contact and location</h2>{salon.address && <p style={{ whiteSpace: "pre-line" }}>{salon.address}{salon.county ? `\n${salon.county}` : ""}</p>}{salon.phone && <p><a href={`tel:${salon.phone}`}>{salon.phone}</a></p>}</section>}
          </>
        )}
      </div>
    </main>
  );
}