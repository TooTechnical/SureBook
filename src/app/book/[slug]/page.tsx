import type { CSSProperties } from "react";
import type { Metadata } from "next";
import QRCode from "qrcode";
import { and, asc, eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { BadgeCheck, CalendarCheck, Clock3, CreditCard, MapPin, Phone, ShieldCheck, Star } from "lucide-react";
import { db } from "@/db";
import { businessHours, reviews, salons, services, staff, storefrontImages } from "@/db/schema";
import { BookingCheckout } from "@/components/BookingCheckout";
import { Logo } from "@/components/Logo";
import { ShareStorefront } from "@/components/ShareStorefront";
import { StorefrontGallery } from "@/components/StorefrontGallery";
import { euro } from "@/lib/utils";
import { resolveStorefrontTheme } from "@/lib/storefront-themes";

const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

type PageProps = { params: Promise<{ slug: string }>; searchParams: Promise<{ confirmed?: string }> };

export async function generateMetadata({ params }: Pick<PageProps, "params">): Promise<Metadata> {
  const { slug } = await params;
  const salon = await db.query.salons.findFirst({ where: eq(salons.slug, slug) });
  if (!salon || !salon.storefrontPublished) return { title: "Storefront not found | SureBook" };
  const location = salon.county || "Ireland";
  const title = salon.seoTitle || `${salon.name} | ${salon.businessCategory} in ${location}`;
  const description = salon.seoDescription || salon.description?.slice(0, 300) || `View services, availability and book securely with ${salon.name} on SureBook.`;
  const canonical = `${appUrl}/book/${salon.slug}`;
  return { title, description, alternates: { canonical }, openGraph: { title, description, url: canonical, type: "website", images: salon.coverImageUrl ? [{ url: salon.coverImageUrl }] : salon.logoUrl ? [{ url: salon.logoUrl }] : [] }, twitter: { card: "summary_large_image", title, description, images: salon.coverImageUrl ? [salon.coverImageUrl] : [] } };
}

export default async function Page({ params, searchParams }: PageProps) {
  const { slug } = await params;
  const q = await searchParams;
  const salon = await db.query.salons.findFirst({ where: eq(salons.slug, slug) });
  if (!salon || !salon.storefrontPublished) notFound();

  const [svc, team, gallery, hours, reviewRows] = await Promise.all([
    db.query.services.findMany({ where: and(eq(services.salonId, salon.id), eq(services.active, true)), with: { category: true }, orderBy: [asc(services.name)] }),
    db.query.staff.findMany({ where: and(eq(staff.salonId, salon.id), eq(staff.active, true)), orderBy: [asc(staff.name)] }),
    db.query.storefrontImages.findMany({ where: eq(storefrontImages.salonId, salon.id), orderBy: [asc(storefrontImages.sortOrder), asc(storefrontImages.createdAt)] }),
    db.query.businessHours.findMany({ where: eq(businessHours.salonId, salon.id), orderBy: [asc(businessHours.dayOfWeek)] }),
    db.query.reviews.findMany({ where: and(eq(reviews.salonId, salon.id), eq(reviews.approved, true)), with: { customer: true }, orderBy: [asc(reviews.createdAt)] }),
  ]);

  const theme = resolveStorefrontTheme(salon.storefrontTheme);
  const accent = salon.accentColor === "#111827" ? theme.accent : salon.accentColor;
  const storefrontUrl = `${appUrl}/book/${salon.slug}`;
  const qrDataUrl = await QRCode.toDataURL(storefrontUrl, { width: 720, margin: 2 });
  const averageRating = reviewRows.length ? reviewRows.reduce((sum, review) => sum + review.rating, 0) / reviewRows.length : null;
  const categories = new Map<string, typeof svc>();
  for (const service of svc) {
    const key = service.category?.name || "Services";
    categories.set(key, [...(categories.get(key) || []), service]);
  }
  const mapQuery = encodeURIComponent([salon.address, salon.county, salon.eircode, "Ireland"].filter(Boolean).join(", "));
  const todayName = new Intl.DateTimeFormat("en-IE", { weekday: "long", timeZone: salon.timezone }).format(new Date());
  const todayIndex = dayNames.indexOf(todayName);
  const todayHours = hours.find((row) => row.dayOfWeek === todayIndex);
  const openToday = Boolean(todayHours && !todayHours.closed && todayHours.openTime && todayHours.closeTime);
  const fullyVerified = salon.stripeChargesEnabled && salon.stripePayoutsEnabled;
  const instantBooking = svc.length > 0 && team.length > 0 && salon.stripeChargesEnabled;
  const topRated = Boolean(averageRating && averageRating >= 4.7 && reviewRows.length >= 3);

  const badges = [
    fullyVerified ? { label: "Verified business", icon: BadgeCheck } : null,
    fullyVerified ? { label: "Stripe verified", icon: CreditCard } : null,
    openToday ? { label: `Open today ${todayHours?.openTime}–${todayHours?.closeTime}`, icon: Clock3 } : null,
    topRated ? { label: "Top rated", icon: Star } : null,
    instantBooking ? { label: "Instant booking", icon: CalendarCheck } : null,
  ].filter(Boolean) as { label: string; icon: typeof BadgeCheck }[];

  const cardStyle: CSSProperties = { background: theme.surface, color: theme.text, border: `1px solid ${theme.border}`, borderRadius: theme.radius, boxShadow: theme.name === "modern" ? "0 18px 55px rgba(15,23,42,.08)" : "none" };
  const jsonLd = {
    "@context": "https://schema.org", "@type": "LocalBusiness", name: salon.name,
    description: salon.description || salon.tagline || undefined,
    image: [salon.coverImageUrl, salon.logoUrl, ...gallery.map((image) => image.imageUrl)].filter(Boolean),
    url: storefrontUrl, telephone: salon.phone || undefined,
    address: salon.address ? { "@type": "PostalAddress", streetAddress: salon.address, addressRegion: salon.county || undefined, postalCode: salon.eircode || undefined, addressCountry: "IE" } : undefined,
    openingHoursSpecification: hours.filter((h) => !h.closed && h.openTime && h.closeTime).map((h) => ({ "@type": "OpeningHoursSpecification", dayOfWeek: dayNames[h.dayOfWeek], opens: h.openTime, closes: h.closeTime })),
    aggregateRating: averageRating ? { "@type": "AggregateRating", ratingValue: averageRating.toFixed(1), reviewCount: reviewRows.length } : undefined,
    priceRange: svc.length ? `${euro(Math.min(...svc.map((service) => service.priceCents)))}–${euro(Math.max(...svc.map((service) => service.priceCents)))}` : undefined,
    makesOffer: svc.map((service) => ({ "@type": "Offer", priceCurrency: "EUR", price: (service.priceCents / 100).toFixed(2), itemOffered: { "@type": "Service", name: service.name, description: service.description || undefined } })),
  };

  return (
    <main style={{ minHeight: "100vh", background: theme.pageBackground, color: theme.text, fontFamily: theme.bodyFont }}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <div className="container" style={{ padding: "22px 0 78px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16 }}><Logo /><a href="/discover" style={{ color: theme.text, border: `1px solid ${theme.border}`, borderRadius: 999, padding: "9px 14px", textDecoration: "none", fontWeight: 700 }}>Discover on SureBook</a></div>

        {q.confirmed ? (
          <section style={{ ...cardStyle, maxWidth: 720, margin: "60px auto", padding: 38, textAlign: "center" }}><ShieldCheck size={40} color={accent} /><h1>Booking received</h1><p style={{ color: theme.muted }}>Your payment is being confirmed. You will receive an email as soon as SureBook receives final confirmation from Stripe.</p></section>
        ) : (
          <>
            <section style={{ ...cardStyle, overflow: "hidden", marginTop: 24 }}>
              <div style={{ minHeight: 520, background: salon.coverImageUrl ? `${theme.heroOverlay},url(${salon.coverImageUrl}) center/cover` : `linear-gradient(135deg,${accent},${theme.pageBackground})`, padding: "clamp(34px,7vw,76px)", display: "flex", alignItems: "end" }}>
                <div style={{ color: "white", maxWidth: 850 }}>
                  {salon.logoUrl && <img src={salon.logoUrl} alt={`${salon.name} logo`} style={{ width: 110, height: 110, objectFit: "cover", borderRadius: Math.max(8, theme.radius), background: "white", padding: 7, marginBottom: 22, boxShadow: "0 18px 55px rgba(0,0,0,.3)" }} />}
                  <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}><span style={{ display: "inline-block", background: "rgba(255,255,255,.16)", backdropFilter: "blur(10px)", padding: "8px 13px", borderRadius: 999, fontSize: 13, fontWeight: 800 }}>{salon.businessCategory}{salon.county ? ` · ${salon.county}` : ""}</span>{averageRating && <span style={{ display: "inline-flex", alignItems: "center", gap: 7, background: "rgba(255,255,255,.96)", color: "#111", padding: "8px 13px", borderRadius: 999, fontWeight: 800 }}><Star size={16} fill="#f59e0b" color="#f59e0b" /> {averageRating.toFixed(1)} <small>({reviewRows.length})</small></span>}</div>
                  <h1 style={{ fontFamily: theme.headingFont, fontSize: "clamp(48px,9vw,92px)", lineHeight: .93, letterSpacing: theme.name === "barber" ? ".01em" : "-.055em", textTransform: theme.name === "barber" ? "uppercase" : undefined, margin: "22px 0 16px", maxWidth: 920 }}>{salon.name}</h1>
                  {salon.tagline && <p style={{ fontSize: "clamp(19px,3vw,26px)", lineHeight: 1.45, margin: 0, maxWidth: 720, color: "rgba(255,255,255,.9)" }}>“{salon.tagline}”</p>}
                  <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginTop: 30 }}>
                    <a href="#book" style={{ background: accent, color: theme.accentText, padding: "14px 22px", borderRadius: Math.max(4, theme.radius / 2), textDecoration: "none", fontWeight: 900, display: "inline-flex", alignItems: "center", gap: 9 }}><CalendarCheck size={19} /> Book now</a>
                    {salon.phone && <a href={`tel:${salon.phone}`} style={{ background: "rgba(255,255,255,.95)", color: "#111", padding: "14px 20px", borderRadius: Math.max(4, theme.radius / 2), textDecoration: "none", fontWeight: 850, display: "inline-flex", alignItems: "center", gap: 9 }}><Phone size={18} /> Call</a>}
                    {salon.address && <a href={`https://www.google.com/maps/search/?api=1&query=${mapQuery}`} target="_blank" rel="noreferrer" style={{ background: "rgba(255,255,255,.15)", color: "white", border: "1px solid rgba(255,255,255,.35)", padding: "14px 20px", borderRadius: Math.max(4, theme.radius / 2), textDecoration: "none", fontWeight: 850, display: "inline-flex", alignItems: "center", gap: 9, backdropFilter: "blur(10px)" }}><MapPin size={18} /> Directions</a>}
                  </div>
                </div>
              </div>
              <div style={{ padding: "20px clamp(22px,5vw,60px)", display: "flex", justifyContent: "space-between", gap: 18, flexWrap: "wrap", alignItems: "center", background: theme.surface }}>
                <div style={{ display: "flex", gap: 9, flexWrap: "wrap" }}>{badges.map(({ label, icon: Icon }) => <span key={label} style={{ display: "inline-flex", alignItems: "center", gap: 7, color: theme.text, border: `1px solid ${theme.border}`, background: theme.pageBackground, borderRadius: 999, padding: "8px 12px", fontSize: 13, fontWeight: 750 }}><Icon size={16} color={accent} />{label}</span>)}</div>
                <ShareStorefront url={storefrontUrl} name={salon.name} qrDataUrl={qrDataUrl} />
              </div>
            </section>

            {salon.description && <section style={{ maxWidth: 900, margin: "58px auto" }}><span style={{ color: accent, fontWeight: 800, letterSpacing: ".08em", textTransform: "uppercase", fontSize: 12 }}>About</span><h2 style={{ fontFamily: theme.headingFont, color: theme.text, fontSize: "clamp(34px,5vw,52px)", margin: "10px 0 18px" }}>Welcome to {salon.name}</h2><p style={{ whiteSpace: "pre-line", color: theme.muted, fontSize: 19, lineHeight: 1.8 }}>{salon.description}</p></section>}

            <StorefrontGallery items={gallery} businessName={salon.name} radius={theme.radius} accent={accent} text={theme.text} muted={theme.muted} />

            <section style={{ margin: "58px 0" }}><span style={{ color: accent, fontWeight: 800, letterSpacing: ".08em", textTransform: "uppercase", fontSize: 12 }}>Services</span><h2 style={{ fontFamily: theme.headingFont, color: theme.text, fontSize: "clamp(38px,6vw,58px)", margin: "10px 0 30px" }}>Choose what you need</h2>{svc.length === 0 ? <p style={{ color: theme.muted }}>Services are being added.</p> : [...categories.entries()].map(([category, items]) => <div key={category} style={{ marginBottom: 36 }}><h3 style={{ color: theme.text, fontSize: 25 }}>{category}</h3><div className="grid-auto">{items.map((service) => <article key={service.id} style={{ ...cardStyle, padding: 24, borderTop: `4px solid ${accent}` }}><div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}><h3 style={{ marginTop: 0, color: theme.text }}>{service.name}</h3><strong style={{ color: accent }}>{euro(service.priceCents)}</strong></div>{service.description && <p style={{ color: theme.muted }}>{service.description}</p>}<small style={{ color: theme.muted }}>{service.durationMinutes} minutes · {service.depositCents > 0 ? `${euro(service.depositCents)} deposit` : "No deposit"}</small></article>)}</div></div>)}</section>

            {team.length > 0 && <section style={{ margin: "58px 0" }}><span style={{ color: accent, fontWeight: 800, letterSpacing: ".08em", textTransform: "uppercase", fontSize: 12 }}>Team</span><h2 style={{ fontFamily: theme.headingFont, color: theme.text, fontSize: "clamp(38px,6vw,58px)", margin: "10px 0 30px" }}>Meet the people behind the business</h2><div className="grid-auto">{team.map((member) => <article key={member.id} style={{ ...cardStyle, padding: 24 }}>{member.photoUrl ? <img src={member.photoUrl} alt={member.name} style={{ width: 94, height: 94, objectFit: "cover", borderRadius: theme.name === "barber" ? 4 : "50%" }} /> : <div style={{ width: 82, height: 82, borderRadius: theme.name === "barber" ? 4 : "50%", display: "grid", placeItems: "center", background: accent, color: theme.accentText, fontSize: 28, fontWeight: 800 }}>{member.name.charAt(0).toUpperCase()}</div>}<h3 style={{ color: theme.text }}>{member.name}</h3>{member.title && <strong style={{ color: accent }}>{member.title}</strong>}{member.bio && <p style={{ color: theme.muted, lineHeight: 1.7 }}>{member.bio}</p>}</article>)}</div></section>}

            <section id="book" style={{ ...cardStyle, padding: "clamp(24px,5vw,48px)", maxWidth: 920, margin: "58px auto", borderTop: `7px solid ${accent}` }}><span style={{ color: accent, fontWeight: 800, letterSpacing: ".08em", textTransform: "uppercase", fontSize: 12 }}>Secure online booking</span><h2 style={{ fontFamily: theme.headingFont, color: theme.text, fontSize: "clamp(38px,6vw,58px)", marginBottom: 8 }}>Book with {salon.name}</h2><p style={{ color: theme.muted, fontSize: 18 }}>Choose a service, preferred team member and appointment time. A deposit may be required to secure the slot.</p><BookingCheckout slug={slug} services={svc} staff={team} /></section>

            {reviewRows.length > 0 && <section style={{ margin: "58px 0" }}><span style={{ color: accent, fontWeight: 800, letterSpacing: ".08em", textTransform: "uppercase", fontSize: 12 }}>Verified reviews</span><h2 style={{ fontFamily: theme.headingFont, color: theme.text, fontSize: "clamp(38px,6vw,58px)", margin: "10px 0 30px" }}>What customers say</h2><div className="grid-auto">{reviewRows.slice(-9).reverse().map((review) => <article style={{ ...cardStyle, padding: 24 }} key={review.id}><strong style={{ color: "#f59e0b", letterSpacing: 2 }}>{"★".repeat(review.rating)}{"☆".repeat(5 - review.rating)}</strong>{review.comment && <p style={{ color: theme.text, lineHeight: 1.7 }}>{review.comment}</p>}<small style={{ color: theme.muted }}>{review.customer.name} · Verified booking</small></article>)}</div></section>}

            {(salon.address || hours.length > 0) && <section style={{ ...cardStyle, padding: 28, maxWidth: 1020, margin: "0 auto", display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(260px,1fr))", gap: 32 }}><div><h2 style={{ color: theme.text }}>Visit and directions</h2>{salon.address && <p style={{ whiteSpace: "pre-line", color: theme.muted }}>{salon.address}{salon.county ? `\n${salon.county}` : ""}{salon.eircode ? `\n${salon.eircode}` : ""}</p>}{salon.address && <a href={`https://www.google.com/maps/search/?api=1&query=${mapQuery}`} target="_blank" rel="noreferrer" style={{ display: "inline-flex", alignItems: "center", gap: 8, background: accent, color: theme.accentText, padding: "12px 17px", borderRadius: Math.max(4, theme.radius / 2), textDecoration: "none", fontWeight: 800 }}><MapPin size={18} /> Open directions</a>}</div><div><h2 style={{ color: theme.text }}>Opening hours</h2>{dayNames.map((day, index) => { const h = hours.find((row) => row.dayOfWeek === index); return <div key={day} style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", color: day === todayName ? accent : theme.text, borderBottom: `1px solid ${theme.border}`, fontWeight: day === todayName ? 800 : 500 }}><span>{day}</span><span>{!h || h.closed ? "Closed" : `${h.openTime}–${h.closeTime}`}</span></div>; })}</div></section>}
          </>
        )}
      </div>
    </main>
  );
}