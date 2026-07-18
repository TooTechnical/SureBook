import type { CSSProperties } from "react";
import type { Metadata } from "next";
import QRCode from "qrcode";
import { and, asc, eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import {
  ArrowRight, BadgeCheck, CalendarCheck, Clock3, CreditCard, Gift,
  Instagram, LockKeyhole, MapPin, MessageCircle, Phone, ShieldCheck, Star, Users,
} from "lucide-react";
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
  return {
    title, description, alternates: { canonical },
    openGraph: { title, description, url: canonical, type: "website", images: salon.coverImageUrl ? [{ url: salon.coverImageUrl }] : salon.logoUrl ? [{ url: salon.logoUrl }] : [] },
    twitter: { card: "summary_large_image", title, description, images: salon.coverImageUrl ? [salon.coverImageUrl] : [] },
  };
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
  const accent = salon.accentColor === "#111827" ? "#ef5b3f" : salon.accentColor;
  const storefrontUrl = `${appUrl}/book/${salon.slug}`;
  const qrDataUrl = await QRCode.toDataURL(storefrontUrl, { width: 720, margin: 2 });
  const averageRating = reviewRows.length ? reviewRows.reduce((sum, review) => sum + review.rating, 0) / reviewRows.length : null;
  const fullAddress = [salon.address, salon.county, salon.eircode, "Ireland"].filter(Boolean).join(", ");
  const mapQuery = encodeURIComponent(fullAddress);
  const todayName = new Intl.DateTimeFormat("en-IE", { weekday: "long", timeZone: salon.timezone }).format(new Date());
  const todayIndex = dayNames.indexOf(todayName);
  const todayHours = hours.find((row) => row.dayOfWeek === todayIndex);
  const openToday = Boolean(todayHours && !todayHours.closed && todayHours.openTime && todayHours.closeTime);
  const fullyVerified = salon.stripeChargesEnabled && salon.stripePayoutsEnabled;
  const instantBooking = serviceRows.length > 0 && team.length > 0 && salon.stripeChargesEnabled;
  const galleryMedia = gallery.filter((item) => item.imageUrl).slice(0, 4);
  const featuredServices = serviceRows.slice(0, 4);
  const featuredReview = reviewRows.at(-1);
  const vars = {
    "--sf-accent": accent,
    "--sf-accent-text": "#ffffff",
    "--sf-surface": "#171a1f",
    "--sf-soft": "#0c0f12",
    "--sf-text": "#f8fafc",
    "--sf-muted": "#a9adb5",
    "--sf-border": "#2a2f36",
    "--sf-radius": "12px",
    "--sf-heading": theme.headingFont,
  } as CSSProperties;
  const heroBackground = salon.coverImageUrl ? `url(${salon.coverImageUrl})` : `linear-gradient(135deg,${accent},#111827)`;
  const jsonLd = {
    "@context": "https://schema.org", "@type": "LocalBusiness", name: salon.name,
    description: salon.description || salon.tagline || undefined,
    image: [salon.coverImageUrl, salon.logoUrl, ...gallery.map((image) => image.imageUrl)].filter(Boolean),
    url: storefrontUrl, telephone: salon.phone || undefined,
    address: salon.address ? { "@type": "PostalAddress", streetAddress: salon.address, addressRegion: salon.county || undefined, postalCode: salon.eircode || undefined, addressCountry: "IE" } : undefined,
    openingHoursSpecification: hours.filter((hour) => !hour.closed && hour.openTime && hour.closeTime).map((hour) => ({ "@type": "OpeningHoursSpecification", dayOfWeek: dayNames[hour.dayOfWeek], opens: hour.openTime, closes: hour.closeTime })),
    aggregateRating: averageRating ? { "@type": "AggregateRating", ratingValue: averageRating.toFixed(1), reviewCount: reviewRows.length } : undefined,
  };

  if (query.confirmed) return <main className={styles.page} style={vars}>
    <section className={styles.confirmation}><ShieldCheck size={52} color={accent} /><h1>Booking received</h1><p>Your payment is being confirmed. You will receive an email as soon as SureBook receives final confirmation from Stripe.</p><a href={`/book/${slug}`}>Return to storefront</a></section>
  </main>;

  return <main className={styles.page} style={vars}>
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
    <div className={styles.shell}>
      <header className={styles.header}>
        <Logo />
        <nav className={styles.desktopNav} aria-label="Storefront navigation">
          <a href="#about">About</a><a href="#services">Services</a><a href="#gallery">Gallery</a>{team.length > 0 && <a href="#team">Team</a>}{reviewRows.length > 0 && <a href="#reviews">Reviews</a>}<a href="#visit">Visit</a>
        </nav>
        <div className={styles.headerActions}>{salon.phone && <a className={styles.phoneButton} href={`tel:${salon.phone}`}><Phone size={16} /> {salon.phone}</a>}<a className={styles.bookButton} href="#book"><CalendarCheck size={17} /> Book now</a></div>
      </header>

      <div className={styles.dashboardGrid}>
        <aside className={styles.leftRail}>
          <section className={styles.railCard}>
            <div className={styles.ratingBig}><Star fill="#f5b942" color="#f5b942" /> <strong>{averageRating?.toFixed(1) || "New"}</strong></div>
            <p>{reviewRows.length ? `${reviewRows.length} verified review${reviewRows.length === 1 ? "" : "s"}` : "Be one of the first to review"}</p>
            {averageRating && <div className={styles.stars}>{"★".repeat(Math.round(averageRating))}{"☆".repeat(5 - Math.round(averageRating))}</div>}
            <div className={styles.railDivider} />
            <span className={openToday ? styles.openStatus : styles.closedStatus}>{openToday ? "Open today" : "Closed today"}</span>
            <strong>{openToday ? `${todayHours?.openTime} – ${todayHours?.closeTime}` : "See opening hours"}</strong>
          </section>

          <section className={styles.railCard}>
            <div className={styles.trustItem}><CalendarCheck /><div><strong>Instant booking</strong><span>{instantBooking ? "Real-time appointment requests" : "Booking setup in progress"}</span></div></div>
            <div className={styles.trustItem}><CreditCard /><div><strong>Secure payments</strong><span>{fullyVerified ? "Processed securely by Stripe" : "Payment connection pending"}</span></div></div>
            <div className={styles.trustItem}><Star /><div><strong>{averageRating && averageRating >= 4.7 ? "Highly rated" : "Verified reviews"}</strong><span>Feedback from completed bookings</span></div></div>
            <div className={styles.trustItem}><Users /><div><strong>Professional team</strong><span>{team.length} team member{team.length === 1 ? "" : "s"} available</span></div></div>
          </section>

          <section className={styles.railCard}>
            <ShareStorefront url={storefrontUrl} name={salon.name} qrDataUrl={qrDataUrl} accent={accent} accentText="#fff" text="#f8fafc" border="#2a2f36" surface="#171a1f" />
          </section>

          <section className={styles.railCard}>
            <h3>Connect</h3>
            <div className={styles.socialIcons}>{salon.instagramUrl && <a href={salon.instagramUrl} target="_blank" rel="noreferrer"><Instagram /></a>}{salon.facebookUrl && <a href={salon.facebookUrl} target="_blank" rel="noreferrer">f</a>}{salon.tiktokUrl && <a href={salon.tiktokUrl} target="_blank" rel="noreferrer">♪</a>}{salon.phone && <a href={`tel:${salon.phone}`}><Phone /></a>}</div>
          </section>
        </aside>

        <section className={styles.mainColumn}>
          <section className={styles.hero}>
            <div className={styles.heroMedia} style={{ backgroundImage: heroBackground }}>
              <div className={styles.heroOverlay} />
              <div className={styles.heroContent}>
                {salon.logoUrl && <img className={styles.logo} src={salon.logoUrl} alt={`${salon.name} logo`} />}
                <h1>{salon.name}</h1>
                <h2>{salon.tagline?.replace(/^['“"]|['”"]$/g, "") || `${salon.businessCategory}${salon.county ? ` in ${salon.county}` : ""}`}</h2>
                {salon.description && <p>{salon.description.slice(0, 180)}</p>}
                <div className={styles.heroMeta}>{salon.county && <span><MapPin /> {salon.county}, Ireland</span>}{openToday && <span><Clock3 /> Open until {todayHours?.closeTime}</span>}</div>
                <div className={styles.heroActions}><a className={styles.bookButton} href="#book"><CalendarCheck /> Book an appointment</a>{salon.phone && <a className={styles.phoneButton} href={`tel:${salon.phone}`}><Phone /> Call us</a>}</div>
                <div className={styles.heroBadges}>{fullyVerified && <span><BadgeCheck /> Verified business</span>}{averageRating && averageRating >= 4.7 && <span><Star /> Top rated</span>}<span><LockKeyhole /> Secure booking</span></div>
              </div>
              {galleryMedia.length > 0 && <div className={styles.heroThumbs}>{galleryMedia.map((item) => <img src={item.comparisonImageUrl || item.imageUrl} alt={item.altText || `${salon.name} gallery`} key={item.id} />)}<span>{galleryMedia.length}/{gallery.length}</span></div>}
            </div>
          </section>

          <section id="services" className={styles.panel}>
            <div className={styles.panelHeader}><h2>Popular services</h2><a href="#book">View all services <ArrowRight /></a></div>
            <div className={styles.serviceGrid}>{featuredServices.map((service, index) => <article className={styles.serviceCard} key={service.id}>{galleryMedia[index]?.imageUrl && <img src={galleryMedia[index].imageUrl} alt="" />}<div className={styles.serviceBody}><div><h3>{service.name}</h3><span><Clock3 /> {service.durationMinutes} min</span></div><p>{service.description || `Professional ${service.name.toLowerCase()} tailored to your needs.`}</p><footer><strong>{euro(service.priceCents)}</strong><a href="#book">Book now</a></footer></div></article>)}</div>
          </section>

          <div className={styles.insightGrid}>
            {team.length > 0 && <section id="team" className={styles.panel}><div className={styles.panelHeader}><h2>Meet our experts</h2><a href="#book">View team <ArrowRight /></a></div><div className={styles.expertRow}>{team.slice(0, 5).map((member) => <article key={member.id}>{member.photoUrl ? <img src={member.photoUrl} alt={member.name} /> : <div className={styles.avatarFallback}>{member.name.charAt(0)}</div>}<strong>{member.name.split(" ")[0]}</strong><span>{member.title || "Professional"}</span></article>)}</div></section>}

            <section id="reviews" className={styles.panel}><div className={styles.panelHeader}><h2>What clients say</h2>{reviewRows.length > 1 && <a href="#reviews">All reviews <ArrowRight /></a>}</div>{featuredReview ? <blockquote><div className={styles.stars}>{"★".repeat(featuredReview.rating)}{"☆".repeat(5-featuredReview.rating)}</div><p>{featuredReview.comment || "A verified customer completed their appointment with this business."}</p><footer><strong>{featuredReview.customer.name}</strong><span>Verified client</span></footer></blockquote> : <div className={styles.emptyState}><Star /><strong>No reviews yet</strong><span>Completed customers can leave verified feedback.</span></div>}</section>

            <section className={styles.panel}><h2>Easy online booking</h2><div className={styles.featureList}><div><CalendarCheck /><span><strong>Book in seconds</strong>Choose your service and time</span></div><div><Clock3 /><span><strong>Real-time availability</strong>Avoid back-and-forth messages</span></div><div><ShieldCheck /><span><strong>Secure and safe</strong>Protected payment processing</span></div><div><MessageCircle /><span><strong>Reminders</strong>Never miss an appointment</span></div></div></section>
          </div>

          <section id="about" className={styles.panel}><div className={styles.panelHeader}><h2>About {salon.name}</h2></div><p className={styles.aboutText}>{salon.description || `${salon.name} offers professional ${salon.businessCategory.toLowerCase()} appointments with secure online booking through SureBook.`}</p></section>

          <div id="gallery"><StorefrontGallery items={gallery} businessName={salon.name} radius={12} accent={accent} text="#f8fafc" muted="#a9adb5" /></div>

          <section id="book" className={styles.bookingPanel}><span>Secure online booking</span><h2>Book with {salon.name}</h2><p>Choose a service, professional and appointment time. SureBook checks availability before securely processing any required deposit.</p><BookingCheckout slug={slug} services={serviceRows} staff={team} accent={accent} accentText="#fff" surface="#171a1f" text="#f8fafc" muted="#a9adb5" border="#2a2f36" radius={12} /></section>
        </section>

        <aside className={styles.rightRail}>
          <section className={styles.railCard}>
            <h3>Opening hours</h3>
            {dayNames.map((day, index) => { const hour = hours.find((row) => row.dayOfWeek === index); return <div className={`${styles.hoursRow} ${day === todayName ? styles.today : ""}`} key={day}><span>{day}</span><strong>{!hour || hour.closed ? "Closed" : `${hour.openTime} – ${hour.closeTime}`}</strong></div>; })}
          </section>

          <section id="visit" className={styles.mapCard}>
            {salon.address ? <><iframe title={`Map showing ${salon.name}`} loading="lazy" referrerPolicy="no-referrer-when-downgrade" src={`https://www.google.com/maps?q=${mapQuery}&output=embed`} /><div><strong>{salon.address}</strong><span>{[salon.county, salon.eircode].filter(Boolean).join(", ")}</span><a href={`https://www.google.com/maps/search/?api=1&query=${mapQuery}`} target="_blank" rel="noreferrer">Get directions</a></div></> : <div className={styles.noAddress}><MapPin /><strong>Location by appointment</strong><span>Contact the business for directions.</span></div>}
          </section>

          {featuredReview && <section className={styles.railCard}><div className={styles.quoteMark}>“</div><p className={styles.quote}>{featuredReview.comment || "A verified customer enjoyed their appointment."}</p><strong>{featuredReview.customer.name}</strong><span className={styles.verifiedText}>Verified client</span><div className={styles.stars}>{"★".repeat(featuredReview.rating)}</div></section>}

          <section className={styles.railCard}>
            <h3>Quick actions</h3>
            <div className={styles.quickActions}>{salon.phone && <a href={`tel:${salon.phone}`}><Phone /> Call business</a>}<a href="#book"><CalendarCheck /> Book appointment</a>{salon.address && <a href={`https://www.google.com/maps/search/?api=1&query=${mapQuery}`} target="_blank" rel="noreferrer"><MapPin /> Directions</a>}<a href="#services"><Gift /> View services</a></div>
          </section>
        </aside>
      </div>
    </div>

    <nav className={styles.bottomBar}><a href={salon.phone ? `tel:${salon.phone}` : "#book"}><Phone /> Call us now</a><a href="#book"><MessageCircle /> Message us</a><a href="#visit"><MapPin /> Directions</a><a href="#services"><Gift /> Services</a><a className={styles.bottomBook} href="#book"><CalendarCheck /> Book an appointment</a></nav>
  </main>;
}
