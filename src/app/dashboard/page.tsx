import { and, asc, eq, gte, lt } from "drizzle-orm";
import { addDays, format, startOfDay, startOfWeek, subWeeks } from "date-fns";
import { BarChart3, CalendarCheck2, CircleDollarSign, Crown, Repeat2, ShieldCheck, Star, UserRoundCheck, UsersRound } from "lucide-react";
import { db } from "@/db";
import { bookings, customers, reviews } from "@/db/schema";
import { requireSession } from "@/lib/session";
import { euro } from "@/lib/utils";
import { recordOutcomeAction } from "@/actions/salon";

function MetricCard({ label, value, note, icon: Icon }: { label: string; value: string; note: string; icon: typeof BarChart3 }) {
  return <article className="analytics-card"><div className="analytics-icon"><Icon size={20}/></div><span>{label}</span><strong>{value}</strong><small>{note}</small></article>;
}

export default async function Dashboard() {
  const session = await requireSession();
  const today = startOfDay(new Date());
  const tomorrow = addDays(today, 1);
  const periodStart = subWeeks(startOfWeek(today, { weekStartsOn: 1 }), 7);

  const [todayRows, periodBookings, salonCustomers, salonReviews] = await Promise.all([
    db.query.bookings.findMany({ where: and(eq(bookings.salonId, session.salonId), gte(bookings.startsAt, today), lt(bookings.startsAt, tomorrow)), with: { customer: true, service: true, staff: true }, orderBy: [asc(bookings.startsAt)] }),
    db.query.bookings.findMany({ where: and(eq(bookings.salonId, session.salonId), gte(bookings.startsAt, periodStart)), with: { service: true, customer: true } }),
    db.select().from(customers).where(eq(customers.salonId, session.salonId)),
    db.select().from(reviews).where(eq(reviews.salonId, session.salonId)),
  ]);

  const completed = periodBookings.filter((booking) => booking.status === "completed");
  const revenue = completed.reduce((sum, booking) => sum + booking.service.priceCents, 0);
  const depositsSaved = periodBookings.filter((booking) => booking.paymentStatus === "paid" && booking.status !== "cancelled").reduce((sum, booking) => sum + booking.depositCents, 0);
  const noShows = periodBookings.filter((booking) => booking.status === "no_show").length;
  const approvedReviews = salonReviews.filter((review) => review.approved);
  const averageRating = approvedReviews.length ? approvedReviews.reduce((sum, review) => sum + review.rating, 0) / approvedReviews.length : 0;
  const repeatCustomers = salonCustomers.filter((customer) => customer.totalBookings > 1).length;

  const serviceCounts = completed.reduce<Record<string, { name: string; count: number }>>((acc, booking) => {
    const item = acc[booking.serviceId] || { name: booking.service.name, count: 0 };
    item.count += 1;
    acc[booking.serviceId] = item;
    return acc;
  }, {});
  const topService = Object.values(serviceCounts).sort((a, b) => b.count - a.count)[0];

  const weekly = Array.from({ length: 8 }, (_, index) => {
    const start = addDays(periodStart, index * 7);
    const end = addDays(start, 7);
    const rows = periodBookings.filter((booking) => booking.startsAt >= start && booking.startsAt < end);
    return { label: format(start, "d MMM"), bookings: rows.length, revenue: rows.filter((booking) => booking.status === "completed").reduce((sum, booking) => sum + booking.service.priceCents, 0) };
  });
  const maxRevenue = Math.max(...weekly.map((item) => item.revenue), 1);
  const maxBookings = Math.max(...weekly.map((item) => item.bookings), 1);

  return <div className="analytics-page">
    <header className="analytics-header"><div><span className="eyebrow">Business intelligence</span><h1>Good day, {session.name}</h1><p>Your performance, customer behaviour and revenue protection in one place.</p></div><div className="report-pill">Last 8 weeks · Europe/Dublin</div></header>

    <section className="analytics-grid">
      <MetricCard label="Revenue" value={euro(revenue)} note="Completed services" icon={CircleDollarSign}/>
      <MetricCard label="Bookings" value={String(periodBookings.length)} note={`${todayRows.length} scheduled today`} icon={CalendarCheck2}/>
      <MetricCard label="Customers" value={String(salonCustomers.length)} note={`${repeatCustomers} returning customers`} icon={UsersRound}/>
      <MetricCard label="Reviews" value={averageRating ? averageRating.toFixed(1) : "—"} note={`${approvedReviews.length} approved reviews`} icon={Star}/>
      <MetricCard label="No shows" value={String(noShows)} note={`${periodBookings.length ? ((noShows / periodBookings.length) * 100).toFixed(1) : "0.0"}% of bookings`} icon={UserRoundCheck}/>
      <MetricCard label="Deposits saved" value={euro(depositsSaved)} note="Revenue protected" icon={ShieldCheck}/>
      <MetricCard label="Top service" value={topService?.name || "—"} note={topService ? `${topService.count} completed bookings` : "No completed services yet"} icon={Crown}/>
      <MetricCard label="Repeat customers" value={String(repeatCustomers)} note={`${salonCustomers.length ? ((repeatCustomers / salonCustomers.length) * 100).toFixed(0) : 0}% retention`} icon={Repeat2}/>
    </section>

    <section className="analytics-charts">
      <article className="chart-card"><div className="chart-title"><div><span>Revenue trend</span><h2>{euro(revenue)}</h2></div><CircleDollarSign size={21}/></div><div className="bar-chart">{weekly.map((week) => <div className="bar-column" key={week.label}><div className="bar-value">{week.revenue ? euro(week.revenue) : ""}</div><div className="bar-track"><div className="bar-fill" style={{ height: `${Math.max(week.revenue ? 12 : 2, (week.revenue / maxRevenue) * 100)}%` }}/></div><small>{week.label}</small></div>)}</div></article>
      <article className="chart-card"><div className="chart-title"><div><span>Booking volume</span><h2>{periodBookings.length} bookings</h2></div><BarChart3 size={21}/></div><div className="line-chart">{weekly.map((week, index) => <div className="line-point-column" key={week.label}><div className="line-point" style={{ bottom: `${(week.bookings / maxBookings) * 78 + 8}%` }}><b>{week.bookings}</b></div>{index < weekly.length - 1 && <div className="line-segment"/>}<small>{week.label}</small></div>)}</div></article>
    </section>

    <section className="card diary-card"><div className="section-heading"><div><span className="eyebrow">Live operation</span><h2>Today’s diary</h2></div><strong>{todayRows.length} appointments</strong></div><div className="table-wrap"><table><thead><tr><th>Time</th><th>Client</th><th>Service</th><th>Staff</th><th>Status</th><th>Outcome</th></tr></thead><tbody>{todayRows.map((booking) => <tr key={booking.id}><td>{booking.startsAt.toLocaleTimeString("en-IE", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Dublin" })}</td><td><strong>{booking.customer.name}</strong><br/><small>{booking.customer.phone}</small></td><td>{booking.service.name}</td><td>{booking.staff.name}</td><td><span className="badge">{booking.status.replace("_", " ")}</span></td><td>{booking.status === "confirmed" ? <div className="outcome-actions"><form action={recordOutcomeAction}><input type="hidden" name="bookingId" value={booking.id}/><input type="hidden" name="outcome" value="completed"/><button className="btn btn-primary">Showed</button></form><form action={recordOutcomeAction}><input type="hidden" name="bookingId" value={booking.id}/><input type="hidden" name="outcome" value="no_show"/><button className="btn btn-secondary">No-show</button></form></div> : "—"}</td></tr>)}{todayRows.length === 0 && <tr><td colSpan={6}>No appointments today yet.</td></tr>}</tbody></table></div></section>
  </div>;
}
