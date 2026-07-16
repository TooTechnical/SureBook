import type { CSSProperties } from "react";
import type { Metadata } from "next";
import QRCode from "qrcode";
import { and, asc, eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { ArrowRight, BadgeCheck, CalendarCheck, Clock3, CreditCard, Instagram, MapPin, Phone, ShieldCheck, Star } from "lucide-react";
import { db } from "@/db";
import { businessHours, reviews, salons, services, staff, storefrontImages } from "@/db/schema";
import { BookingCheckout } from "@/components/BookingCheckout";
import { Logo } from "@/components/Logo";
import { ShareStorefront } from "@/components/ShareStorefront";
import { StorefrontGallery } from "@/components/StorefrontGallery";
import { euro } from "@/lib/utils";
import { resolveStorefrontTheme } from "@/lib/storefront-themes";
import styles from "@/styles/storefront.module.css";

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
  const query = await searchParams;
  const salon = await db.query.salons.findFirst({ where: eq(salons.slug, slug) });
  if (!salon || !salon.storefrontPublished) notFound();

  const [serviceRows, team, gallery, hours, reviewRows] = await Promise.all([
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
  const categories = new Map<string, typeof serviceRows>();
  for (const service of serviceRows) { const key = service.category?.name || "Services"; categories.set(key, [...(categories.get(key) || []), service]); }
  const fullAddress = [salon.address, salon.county, salon.eircode, "Ireland"].filter(Boolean).join(", ");
  const mapQuery = encodeURIComponent(fullAddress);
  const todayName = new Intl.DateTimeFormat("en-IE", { weekday: "long", timeZone: salon.timezone }).format(new Date());
  const todayIndex = dayNames.indexOf(todayName);
  const todayHours = hours.find((row) => row.dayOfWeek === todayIndex);
  const openToday = Boolean(todayHours && !todayHours.closed && todayHours.openTime && todayHours.closeTime);
  const fullyVerified = salon.stripeChargesEnabled && salon.stripePayoutsEnabled;
  const instantBooking = serviceRows.length > 0 && team.length > 0 && salon.stripeChargesEnabled;
  const topRated = Boolean(averageRating && averageRating >= 4.7 && reviewRows.length >= 3);
  const badges = [fullyVerified ? { label: "Verified business", icon: BadgeCheck } : null, fullyVerified ? { label: "Secure payments", icon: CreditCard } : null, openToday ? { label: `Open today ${todayHours?.openTime}–${todayHours?.closeTime}`, icon: Clock3 } : null, topRated ? { label: "Top rated", icon: Star } : null, instantBooking ? { label: "Instant booking", icon: CalendarCheck } : null].filter(Boolean) as { label: string; icon: typeof BadgeCheck }[];
  const vars = { "--sf-accent": accent, "--sf-accent-text": theme.accentText, "--sf-surface": theme.surface, "--sf-soft": theme.pageBackground, "--sf-text": theme.text, "--sf-muted": theme.muted, "--sf-border": theme.border, "--sf-radius": `${theme.radius}px`, "--sf-heading": theme.headingFont } as CSSProperties;
  const heroBackground = salon.coverImageUrl ? `url(${salon.coverImageUrl})` : `linear-gradient(135deg,${accent},${theme.pageBackground})`;
  const jsonLd = { "@context": "https://schema.org", "@type": "LocalBusiness", name: salon.name, description: salon.description || salon.tagline || undefined, image: [salon.coverImageUrl, salon.logoUrl, ...gallery.map((image) => image.imageUrl)].filter(Boolean), url: storefrontUrl, telephone: salon.phone || undefined, address: salon.address ? { "@type": "PostalAddress", streetAddress: salon.address, addressRegion: salon.county || undefined, postalCode: salon.eircode || undefined, addressCountry: "IE" } : undefined, openingHoursSpecification: hours.filter((hour) => !hour.closed && hour.openTime && hour.closeTime).map((hour) => ({ "@type": "OpeningHoursSpecification", dayOfWeek: dayNames[hour.dayOfWeek], opens: hour.openTime, closes: hour.closeTime })), aggregateRating: averageRating ? { "@type": "AggregateRating", ratingValue: averageRating.toFixed(1), reviewCount: reviewRows.length } : undefined, priceRange: serviceRows.length ? `${euro(Math.min(...serviceRows.map((service) => service.priceCents)))}–${euro(Math.max(...serviceRows.map((service) => service.priceCents)))}` : undefined };

  return <main className={`${styles.page} ${styles.container}`} style={{ ...vars, background: theme.pageBackground, color: theme.text, fontFamily: theme.bodyFont }}>
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
    <div className={styles.topbar}><Logo /><a className={styles.discoverLink} href="/discover">Discover on SureBook</a></div>
    {!query.confirmed && <nav className={styles.stickyNav} aria-label="Storefront sections"><div className={styles.navLinks}><a href="#about">About</a><a href="#gallery">Gallery</a><a href="#services">Services</a>{team.length > 0 && <a href="#team">Team</a>}{reviewRows.length > 0 && <a href="#reviews">Reviews</a>}<a href="#visit">Visit</a></div><a className={styles.navBook} href="#book">Book now</a></nav>}

    {query.confirmed ? <section className={styles.bookingShell} style={{ textAlign: "center" }}><ShieldCheck size={44} color={accent} /><h1>Booking received</h1><p className={styles.bookingIntro} style={{ margin: "0 auto" }}>Your payment is being confirmed. You will receive an email as soon as SureBook receives final confirmation from Stripe.</p></section> : <>
      <section className={styles.hero}><div className={styles.heroMedia} style={{ backgroundImage: heroBackground }}><div className={styles.heroContent}>{salon.logoUrl && <img className={styles.logo} src={salon.logoUrl} alt={`${salon.name} logo`} />}<div className={styles.eyebrowRow}><span className={styles.glassPill}>{salon.businessCategory}{salon.county ? ` · ${salon.county}` : ""}</span>{averageRating && <span className={styles.ratingPill}><Star size={16} fill="#f5b942" color="#f5b942" /> {averageRating.toFixed(1)} <small>({reviewRows.length} verified)</small></span>}</div><h1 className={styles.heroTitle}>{salon.name}</h1>{salon.tagline && <p className={styles.tagline}>{salon.tagline.replace(/^['“"]|['”"]$/g, "")}</p>}<div className={styles.heroMeta}>{salon.county && <span><MapPin size={16} /> {salon.county}</span>}{openToday && <span><Clock3 size={16} /> Open until {todayHours?.closeTime}</span>}{fullyVerified && <span><ShieldCheck size={16} /> Secure online booking</span>}</div><div className={styles.heroActions}><a className={styles.primaryAction} href="#book"><CalendarCheck size={19} /> Book now</a>{salon.phone && <a className={styles.lightAction} href={`tel:${salon.phone}`}><Phone size={18} /> Call</a>}{salon.address && <a className={styles.glassAction} href={`https://www.google.com/maps/search/?api=1&query=${mapQuery}`} target="_blank" rel="noreferrer"><MapPin size={18} /> Directions</a>}</div></div></div><div className={styles.trustBar}><div className={styles.badgeRow}>{badges.map(({ label, icon: Icon }) => <span className={styles.trustBadge} key={label}><Icon size={16} color={accent} />{label}</span>)}</div><ShareStorefront url={storefrontUrl} name={salon.name} qrDataUrl={qrDataUrl} accent={accent} accentText={theme.accentText} text={theme.text} border={theme.border} surface={theme.surface} /></div></section>

      {salon.description && <section id="about" className={styles.sectionNarrow}><span className={styles.kicker}>About</span><h2 className={styles.sectionTitle}>Welcome to {salon.name}</h2><p className={styles.bodyCopy}>{salon.description}</p></section>}
      <StorefrontGallery items={gallery} businessName={salon.name} radius={theme.radius} accent={accent} text={theme.text} muted={theme.muted} />

      <section id="services" className={styles.section}><div className={styles.serviceHeader}><div><span className={styles.kicker}>Services</span><h2 className={styles.sectionTitle}>Choose what you need</h2></div>{serviceRows.length > 3 && <a className={styles.serviceBook} href="#book">Start booking <ArrowRight size={17} /></a>}</div>{serviceRows.length === 0 ? <p style={{ color: theme.muted }}>Services are being added.</p> : [...categories.entries()].map(([category, items]) => <div key={category} style={{ marginBottom: 36 }}><h3 style={{ color: theme.text, fontSize: 25 }}>{category}</h3><div className={styles.serviceGrid}>{items.map((service) => <article className={styles.serviceCard} key={service.id}><div className={styles.serviceTop}><h3 className={styles.serviceName}>{service.name}</h3><strong className={styles.servicePrice}>{euro(service.priceCents)}</strong></div><p className={styles.serviceDescription}>{service.description || `Professional ${service.name.toLowerCase()} appointment with ${salon.name}.`}</p><div className={styles.serviceFacts}><span className={styles.fact}>{service.durationMinutes} minutes</span><span className={styles.fact}>{service.depositCents > 0 ? `${euro(service.depositCents)} deposit` : "No deposit"}</span></div><a className={styles.serviceBook} href="#book">Book this service <ArrowRight size={16} /></a></article>)}</div></div>)}</section>

      {team.length > 0 && <section id="team" className={styles.section}><span className={styles.kicker}>Team</span><h2 className={styles.sectionTitle}>Meet the people behind the business</h2><div className={styles.teamGrid}>{team.map((member) => <article className={styles.profileCard} key={member.id}>{member.photoUrl ? <img className={styles.profilePhoto} src={member.photoUrl} alt={member.name} /> : <div className={styles.profileInitial}>{member.name.charAt(0).toUpperCase()}</div>}<h3 style={{ fontSize: 22, marginBottom: 5 }}>{member.name}</h3>{member.title && <strong style={{ color: accent }}>{member.title}</strong>}{member.bio && <p style={{ color: theme.muted, lineHeight: 1.7 }}>{member.bio}</p>}<a className={styles.serviceBook} href="#book">Book with {member.name.split(" ")[0]} <ArrowRight size={16} /></a></article>)}</div></section>}

      {reviewRows.length > 0 && <section id="reviews" className={styles.section}><span className={styles.kicker}>Verified reviews</span><h2 className={styles.sectionTitle}>{averageRating?.toFixed(1)} from real customers</h2><div className={styles.reviewGrid}>{reviewRows.slice(-9).reverse().map((review) => <article className={styles.reviewCard} key={review.id}><div className={styles.stars}>{"★".repeat(review.rating)}{"☆".repeat(5 - review.rating)}</div>{review.comment && <p style={{ fontSize: 17, lineHeight: 1.7 }}>{review.comment}</p>}<span className={styles.verified}><BadgeCheck size={16} color={accent} /> {review.customer.name} · Verified booking</span></article>)}</div></section>}

      <section id="book" className={styles.bookingShell}><span className={styles.kicker}>Secure online booking</span><h2 className={styles.sectionTitle} style={{ marginBottom: 8 }}>Book with {salon.name}</h2><p className={styles.bookingIntro}>Choose your service, professional and appointment time. SureBook checks availability before securely processing any required deposit.</p><BookingCheckout slug={slug} services={serviceRows} staff={team} accent={accent} accentText={theme.accentText} surface={theme.surface} text={theme.text} muted={theme.muted} border={theme.border} radius={theme.radius} /></section>

      <section id="visit" className={styles.section}><span className={styles.kicker}>Visit</span><h2 className={styles.sectionTitle}>Plan your appointment</h2><div className={styles.visitGrid}>{salon.address ? <article className={styles.visitCard}><iframe className={styles.mapFrame} title={`Map showing ${salon.name}`} loading="lazy" referrerPolicy="no-referrer-when-downgrade" src={`https://www.google.com/maps?q=${mapQuery}&output=embed`} /><h3>Visit and directions</h3><p style={{ whiteSpace: "pre-line", color: theme.muted }}>{salon.address}{salon.county ? `\n${salon.county}` : ""}{salon.eircode ? `\n${salon.eircode}` : ""}</p><a className={styles.primaryAction} href={`https://www.google.com/maps/search/?api=1&query=${mapQuery}`} target="_blank" rel="noreferrer"><MapPin size={18} /> Open directions</a></article> : <article className={styles.visitCard}><h3>Contact the business</h3><p style={{ color: theme.muted }}>The business has not published a street address. Contact them directly for appointment location details.</p>{salon.phone && <a className={styles.primaryAction} href={`tel:${salon.phone}`}><Phone size={18} /> Call {salon.name}</a>}</article>}<article className={styles.visitCard}><h3>{openToday ? `Open today until ${todayHours?.closeTime}` : "Opening hours"}</h3>{dayNames.map((day, index) => { const hour = hours.find((row) => row.dayOfWeek === index); return <div className={`${styles.hoursRow} ${day === todayName ? styles.today : ""}`} key={day}><span>{day}</span><span>{!hour || hour.closed ? "Closed" : `${hour.openTime}–${hour.closeTime}`}</span></div>; })}</article></div></section>

      <footer className={styles.socialFooter}><div><strong style={{ color: theme.text }}>{salon.name}</strong><div>Powered by SureBook · Secure appointments and payments</div></div><div className={styles.socialLinks}>{salon.instagramUrl && <a href={salon.instagramUrl} target="_blank" rel="noreferrer"><Instagram size={16} /> Instagram</a>}{salon.facebookUrl && <a href={salon.facebookUrl} target="_blank" rel="noreferrer">Facebook</a>}{salon.tiktokUrl && <a href={salon.tiktokUrl} target="_blank" rel="noreferrer">TikTok</a>}{salon.websiteUrl && <a href={salon.websiteUrl} target="_blank" rel="noreferrer">Website</a>}{salon.phone && <a href={`tel:${salon.phone}`}>Call</a>}</div></footer>
      <a className={styles.floatingBook} href="#book"><CalendarCheck size={19} /> Book an appointment</a>
    </>}
  </main>;
}
