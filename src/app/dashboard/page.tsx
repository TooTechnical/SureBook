import Link from "next/link";
import { and, asc, desc, eq, gte, lt } from "drizzle-orm";
import { addDays, startOfDay, startOfYear, subDays } from "date-fns";
import { db } from "@/db";
import { aiGenerations, discountCodes, referralCampaigns } from "@/db/marketing-schema";
import { automationDefinitions, growthScoreSnapshots, weeklyReportPreferences } from "@/db/operations-schema";
import { bookings, businessHours, reviews, salons, services, staff, storefrontImages } from "@/db/schema";
import { calculateBusinessMetrics } from "@/lib/analytics";
import { calculateGrowthScore } from "@/lib/growth-score";
import { requireSession } from "@/lib/session";
import { euro } from "@/lib/utils";
import { recordOutcomeAction } from "@/actions/salon";

const periods = { "7d": 7, "30d": 30, "90d": 90, year: 0 } as const;
type Period = keyof typeof periods;
type PageProps = { searchParams: Promise<{ period?: string }> };

function trend(current: number, previous: number) {
  if (previous === 0) return current === 0 ? { label: "No change", tone: "neutral" } : { label: "New activity", tone: "positive" };
  const change = Math.round(((current - previous) / previous) * 100);
  return { label: `${change > 0 ? "+" : ""}${change}% vs previous period`, tone: change > 0 ? "positive" : change < 0 ? "negative" : "neutral" };
}

function Kpi({ label, value, detail, href, current, previous, inverse = false }: { label: string; value: string; detail: string; href: string; current?: number; previous?: number; inverse?: boolean }) {
  const change = current === undefined || previous === undefined ? null : trend(current, previous);
  const colour = change?.tone === "neutral" ? "var(--muted)" : (change?.tone === "positive") !== inverse ? "#16734b" : "#a52b2b";
  return <article className="card" style={{ padding: 20 }}><span className="label">{label}</span><strong style={{ display: "block", fontSize: 31, letterSpacing: "-.04em" }}>{value}</strong>{change && <small style={{ color: colour, fontWeight: 700 }}>{change.label}</small>}<p style={{ color: "var(--muted)", fontSize: 13, minHeight: 39 }}>{detail}</p><Link href={href} style={{ color: "var(--accent)", fontWeight: 700, fontSize: 14 }}>View details →</Link></article>;
}

function Bar({ label, value, max }: { label: string; value: number; max: number }) {
  const width = max ? Math.max(3, Math.round((value / max) * 100)) : 0;
  return <div aria-label={`${label}: ${value}`}><div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}><span>{label}</span><strong>{value}</strong></div><div style={{ height: 9, borderRadius: 99, background: "#e7ede9", overflow: "hidden" }}><div style={{ width: `${width}%`, height: "100%", background: "var(--accent)", borderRadius: 99 }} /></div></div>;
}

export default async function Dashboard({ searchParams }: PageProps) {
  const session = await requireSession();
  const params = await searchParams;
  const period = (Object.keys(periods).includes(params.period || "") ? params.period : "30d") as Period;
  const now = new Date();
  const periodStart = period === "year" ? startOfYear(now) : subDays(now, periods[period]);
  const duration = now.getTime() - periodStart.getTime();
  const previousStart = new Date(periodStart.getTime() - duration);
  const today = startOfDay(now);

  const [salon, bookingRows, reviewRows, hours, imageRows, staffRows, automations, weeklyPreference, activeDiscounts, activeReferrals, operatorUse, latestSnapshot] = await Promise.all([
    db.query.salons.findFirst({ where: eq(salons.id, session.salonId) }),
    db.query.bookings.findMany({ where: and(eq(bookings.salonId, session.salonId), gte(bookings.createdAt, previousStart), lt(bookings.createdAt, now)), with: { customer: true, service: true, staff: true }, orderBy: [asc(bookings.startsAt)] }),
    db.query.reviews.findMany({ where: and(eq(reviews.salonId, session.salonId), eq(reviews.approved, true)), orderBy: [desc(reviews.createdAt)] }),
    db.query.businessHours.findMany({ where: eq(businessHours.salonId, session.salonId) }),
    db.query.storefrontImages.findMany({ where: eq(storefrontImages.salonId, session.salonId) }),
    db.query.staff.findMany({ where: eq(staff.salonId, session.salonId) }),
    db.query.automationDefinitions.findMany({ where: eq(automationDefinitions.salonId, session.salonId) }),
    db.query.weeklyReportPreferences.findFirst({ where: eq(weeklyReportPreferences.salonId, session.salonId) }),
    db.query.discountCodes.findMany({ where: and(eq(discountCodes.salonId, session.salonId), eq(discountCodes.active, true)) }),
    db.query.referralCampaigns.findMany({ where: and(eq(referralCampaigns.salonId, session.salonId), eq(referralCampaigns.active, true)) }),
    db.query.aiGenerations.findFirst({ where: and(eq(aiGenerations.salonId, session.salonId), gte(aiGenerations.createdAt, subDays(now, 30))), orderBy: [desc(aiGenerations.createdAt)] }),
    db.query.growthScoreSnapshots.findFirst({ where: eq(growthScoreSnapshots.salonId, session.salonId), orderBy: [desc(growthScoreSnapshots.calculatedAt)] }),
  ]);
  if (!salon) return null;
  const serviceRows = await db.query.services.findMany({ where: eq(services.salonId, session.salonId) });
  const currentRows = bookingRows.filter((row) => row.createdAt >= periodStart);
  const previousRows = bookingRows.filter((row) => row.createdAt < periodStart);
  const toAnalytics = (row: (typeof bookingRows)[number]) => ({ ...row, serviceName: row.service.name });
  const current = calculateBusinessMetrics(currentRows.map(toAnalytics));
  const previous = calculateBusinessMetrics(previousRows.map(toAnalytics));
  const averageRating = reviewRows.length ? reviewRows.reduce((sum, row) => sum + row.rating, 0) / reviewRows.length : null;
  const periodReviews = reviewRows.filter((row) => row.createdAt >= periodStart);
  const previousReviews = reviewRows.filter((row) => row.createdAt >= previousStart && row.createdAt < periodStart);
  const todayRows = currentRows.filter((row) => row.startsAt >= today && row.startsAt < addDays(today, 1));
  const weeklyRows = bookingRows.filter((row) => row.createdAt >= subDays(now, 7));
  const weekly = calculateBusinessMetrics(weeklyRows.map(toAnalytics));
  const score = calculateGrowthScore({
    profile: { name: Boolean(salon.name), category: Boolean(salon.businessCategory), descriptionLength: salon.description?.trim().length || 0, seoTitle: Boolean(salon.seoTitle), seoDescription: Boolean(salon.seoDescription), locationComplete: Boolean(salon.address && salon.county && salon.eircode), openingHoursComplete: hours.length === 7 },
    services: { total: serviceRows.length, withDescriptions: serviceRows.filter((row) => (row.description?.trim().length || 0) >= 30).length, available: serviceRows.filter((row) => row.active).length },
    photos: { logo: Boolean(salon.logoUrl), cover: Boolean(salon.coverImageUrl), galleryCount: imageRows.length, staffPhotoCount: staffRows.filter((row) => row.photoUrl).length, usefulAltTextCount: imageRows.filter((row) => (row.altText?.trim().length || 0) >= 8).length },
    reviews: { approvedCount: reviewRows.length, averageRating, recentCount: reviewRows.filter((row) => row.createdAt >= subDays(now, 90)).length, requestAutomationEnabled: automations.some((row) => row.automationType === "review_request" && row.enabled) },
    bookings: { total: currentRows.length, completed: currentRows.filter((row) => row.status === "completed").length, cancelled: currentRows.filter((row) => row.status === "cancelled").length, noShows: current.noShows, completedCustomerCount: current.completedCustomers, repeatCustomerCount: current.repeatCustomers, availabilityConfigured: hours.some((row) => !row.closed && row.openTime && row.closeTime) },
    marketing: { activeTools: activeDiscounts.length, referralEnabled: activeReferrals.length > 0, audienceSize: new Set(currentRows.filter((row) => row.customer.marketingConsent).map((row) => row.customerId)).size, weeklyReportEnabled: weeklyPreference?.enabled ?? true, automationCount: automations.filter((row) => row.enabled).length, recentOperatorUse: Boolean(operatorUse) },
  });

  if (!latestSnapshot || latestSnapshot.calculatedAt < startOfDay(now) || latestSnapshot.overallScore !== score.overall) {
    await db.insert(growthScoreSnapshots).values({ salonId: session.salonId, version: score.version, overallScore: score.overall, categoryScores: score.categories, factors: { positive: score.positiveFactors, negative: score.negativeFactors }, dataWindowStart: periodStart, dataWindowEnd: now });
  }

  const outcomes = [
    ["Completed", currentRows.filter((row) => row.status === "completed").length],
    ["Confirmed", currentRows.filter((row) => row.status === "confirmed").length],
    ["Cancelled", currentRows.filter((row) => row.status === "cancelled").length],
    ["No-show", current.noShows],
  ] as const;
  const weekdayDemand = Array.from({ length: 7 }, (_, day) => ({ label: new Intl.DateTimeFormat("en-IE", { weekday: "short" }).format(new Date(2026, 0, 4 + day)), value: currentRows.filter((row) => row.startsAt.getDay() === day).length }));

  return <>
    <div style={{ display: "flex", justifyContent: "space-between", gap: 18, alignItems: "end", flexWrap: "wrap" }}><div><span className="badge">Live business data</span><h1 style={{ fontSize: 38, marginBottom: 6 }}>Good day, {session.name}</h1><p style={{ color: "var(--muted)", margin: 0 }}>Performance, booking health and clear next actions.</p></div><nav aria-label="Dashboard date range" style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>{Object.entries({ "7d": "7 days", "30d": "30 days", "90d": "90 days", year: "This year" }).map(([key, label]) => <Link key={key} className={`btn ${period === key ? "btn-primary" : "btn-secondary"}`} href={`/dashboard?period=${key}`}>{label}</Link>)}</nav></div>

    <div className="grid-auto" style={{ margin: "26px 0" }}>
      <Kpi label="Revenue" value={euro(current.revenueCents)} detail="Successful paid booking deposits recorded in this period." href="/dashboard/bookings" current={current.revenueCents} previous={previous.revenueCents} />
      <Kpi label="Bookings" value={String(current.bookings)} detail="Bookings created during the selected period." href="/dashboard/bookings" current={current.bookings} previous={previous.bookings} />
      <Kpi label="Customers" value={String(current.customers)} detail="Unique customers attached to these booking records." href="/dashboard/customers" current={current.customers} previous={previous.customers} />
      <Kpi label="Reviews" value={averageRating ? `${averageRating.toFixed(1)} · ${reviewRows.length}` : "No rating yet"} detail="Approved reviews and all-time average rating." href="/dashboard/settings" current={periodReviews.length} previous={previousReviews.length} />
      <Kpi label="No-shows" value={String(current.noShows)} detail="Bookings explicitly marked with the no-show outcome." href="/dashboard/bookings" current={current.noShows} previous={previous.noShows} inverse />
      <Kpi label="Deposits saved" value={euro(current.depositsSavedCents)} detail="Paid deposits on bookings marked no-show; excludes unpaid or failed deposits." href="/dashboard/bookings" current={current.depositsSavedCents} previous={previous.depositsSavedCents} />
      <Kpi label="Top service" value={current.topService?.name || "Not enough data"} detail={current.topService ? `${current.topService.count} completed booking${current.topService.count === 1 ? "" : "s"}.` : "No completed bookings in this period."} href="/dashboard/services" />
      <Kpi label="Repeat customers" value={current.repeatCustomerRate === null ? "Not enough data" : `${current.repeatCustomers} · ${Math.round(current.repeatCustomerRate * 100)}%`} detail="Customers with more than one completed booking, as a share of completed customers." href="/dashboard/customers" current={current.repeatCustomers} previous={previous.repeatCustomers} />
    </div>

    <section className="card" style={{ padding: 24, marginBottom: 22 }}><div style={{ display: "flex", justifyContent: "space-between", gap: 18, flexWrap: "wrap" }}><div><span className="badge">{score.version}</span><h2 style={{ fontSize: 30, margin: "10px 0 4px" }}>SureBook Growth Score™ · {score.overall} / 100</h2><p style={{ color: "var(--muted)", maxWidth: 760 }}>A transparent advisory score calculated from your SureBook data. It is not scientifically validated and does not guarantee revenue growth.</p></div><small>Calculated {now.toLocaleDateString("en-IE")} · Window starts {periodStart.toLocaleDateString("en-IE")}</small></div>
      <div className="grid-auto" style={{ margin: "20px 0" }}>{Object.entries(score.categories).map(([key, value]) => <div key={key}><Bar label={key[0].toUpperCase() + key.slice(1)} value={value} max={100} /></div>)}</div>
      {score.sampleNote && <p className="badge" title="Minimum-sample safeguard">{score.sampleNote}</p>}
      <h3>Today’s recommendations</h3>{score.recommendations.length ? <div style={{ display: "grid", gap: 10 }}>{score.recommendations.slice(0, 5).map((item) => <Link key={item.key} className="card" href={item.href} style={{ padding: 14, boxShadow: "none", display: "flex", justifyContent: "space-between", gap: 12 }}><span><strong>{item.title}</strong><br/><small>{item.impact} impact · {item.effort} effort</small></span><span aria-hidden="true">→</span></Link>)}</div> : <p>Core profile signals are in good shape. Keep collecting real booking and review data.</p>}
    </section>

    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(min(330px,100%),1fr))", gap: 20, marginBottom: 22 }}>
      <section className="card" style={{ padding: 22 }}><h2>Booking outcomes</h2><p style={{ color: "var(--muted)" }}>Outcome counts use a zero baseline and never infer attendance.</p><div style={{ display: "grid", gap: 13 }}>{outcomes.map(([label, value]) => <Bar key={label} label={label} value={value} max={Math.max(1, ...outcomes.map((row) => row[1]))} />)}</div></section>
      <section className="card" style={{ padding: 22 }}><h2>Demand by weekday</h2><p style={{ color: "var(--muted)" }}>Created bookings grouped by appointment weekday.</p><div style={{ display: "grid", gap: 13 }}>{weekdayDemand.map((row) => <Bar key={row.label} label={row.label} value={row.value} max={Math.max(1, ...weekdayDemand.map((item) => item.value))} />)}</div></section>
    </div>

    <section className="card" style={{ padding: 22, marginBottom: 22 }}><div style={{ display: "flex", justifyContent: "space-between", gap: 18, flexWrap: "wrap" }}><div><span className="badge">In-app weekly report</span><h2>Last 7 days</h2></div><span className="badge">Email {weeklyPreference?.emailEnabled ? "enabled" : "off by default"}</span></div><div className="grid-auto"><div><span className="label">Revenue</span><strong>{euro(weekly.revenueCents)}</strong></div><div><span className="label">Bookings</span><strong>{weekly.bookings}</strong></div><div><span className="label">Completed</span><strong>{weeklyRows.filter((row) => row.status === "completed").length}</strong></div><div><span className="label">Cancellations</span><strong>{weeklyRows.filter((row) => row.status === "cancelled").length}</strong></div><div><span className="label">No-shows</span><strong>{weekly.noShows}</strong></div><div><span className="label">Repeat customers</span><strong>{weekly.repeatCustomers}</strong></div><div><span className="label">Top service</span><strong>{weekly.topService?.name || "Unavailable"}</strong></div><div><span className="label">Deposits protected</span><strong>{euro(weekly.depositsSavedCents)}</strong></div></div><h3>Recommended actions</h3><ol>{score.recommendations.slice(0, 3).map((item) => <li key={item.key}><Link href={item.href}>{item.title}</Link></li>)}</ol></section>

    <section className="card" style={{ padding: 20 }}><h2>Today’s diary</h2><div className="table-wrap"><table><thead><tr><th>Time</th><th>Client</th><th>Service</th><th>Staff</th><th>Status</th><th>Outcome</th></tr></thead><tbody>{todayRows.map((booking) => <tr key={booking.id}><td>{booking.startsAt.toLocaleTimeString("en-IE", { hour: "2-digit", minute: "2-digit", timeZone: salon.timezone })}</td><td><strong>{booking.customer.name}</strong></td><td>{booking.service.name}</td><td>{booking.staff.name}</td><td><span className="badge">{booking.status.replace("_", " ")}</span></td><td>{booking.status === "confirmed" ? <div style={{ display: "flex", gap: 8 }}><form action={recordOutcomeAction}><input type="hidden" name="bookingId" value={booking.id}/><input type="hidden" name="outcome" value="completed"/><button className="btn btn-primary">Showed</button></form><form action={recordOutcomeAction}><input type="hidden" name="bookingId" value={booking.id}/><input type="hidden" name="outcome" value="no_show"/><button className="btn btn-secondary">No-show</button></form></div> : "—"}</td></tr>)}{todayRows.length === 0 && <tr><td colSpan={6}>No appointments today yet.</td></tr>}</tbody></table></div></section>
  </>;
}
