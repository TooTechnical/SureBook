import Link from "next/link";
import { and, desc, eq, sql } from "drizzle-orm";
import { notFound } from "next/navigation";
import { updateCustomerProfileAction } from "@/actions/customer";
import { db } from "@/db";
import { auditLog, bookings, customers, services, staff } from "@/db/schema";
import { requireSession } from "@/lib/session";
import { euro } from "@/lib/utils";

type PageProps = { params: Promise<{ customerId: string }> };

export default async function Page({ params }: PageProps) {
  const session = await requireSession();
  const { customerId } = await params;
  const [customer, team, serviceRows, auditRows, clockRows] = await Promise.all([
    db.query.customers.findFirst({
      where: and(eq(customers.id, customerId), eq(customers.salonId, session.salonId)),
      with: { bookings: { with: { service: true, staff: true }, orderBy: [desc(bookings.startsAt)] }, reviews: true, preferredService: true, preferredStaff: true },
    }),
    db.query.staff.findMany({ where: eq(staff.salonId, session.salonId) }),
    db.query.services.findMany({ where: eq(services.salonId, session.salonId) }),
    db.query.auditLog.findMany({ where: and(eq(auditLog.salonId, session.salonId), eq(auditLog.entityId, customerId)), orderBy: [desc(auditLog.createdAt)], limit: 25 }),
    db.execute(sql<{ currentTime: Date }>`select now() as "currentTime"`),
  ]);
  if (!customer) notFound();

  const currentTime = clockRows[0]?.currentTime ?? customer.updatedAt;
  const completed = customer.bookings.filter((booking) => booking.status === "completed").sort((a, b) => b.startsAt.getTime() - a.startsAt.getTime());
  const lifetimeValue = completed.reduce((sum, booking) => sum + booking.service.priceCents, 0);
  const averageBooking = completed.length ? Math.round(lifetimeValue / completed.length) : 0;
  const serviceCounts = new Map<string, { name: string; count: number }>();
  const staffCounts = new Map<string, { name: string; count: number }>();
  for (const booking of completed) {
    const serviceEntry = serviceCounts.get(booking.serviceId) || { name: booking.service.name, count: 0 };
    serviceCounts.set(booking.serviceId, { ...serviceEntry, count: serviceEntry.count + 1 });
    const staffEntry = staffCounts.get(booking.staffId) || { name: booking.staff.name, count: 0 };
    staffCounts.set(booking.staffId, { ...staffEntry, count: staffEntry.count + 1 });
  }
  const favouriteService = customer.preferredService?.name || [...serviceCounts.values()].sort((a, b) => b.count - a.count)[0]?.name || "Not enough history";
  const favouriteStaff = customer.preferredStaff?.name || [...staffCounts.values()].sort((a, b) => b.count - a.count)[0]?.name || "Not enough history";
  const intervals = completed.slice(0, -1).map((booking, index) => Math.round((booking.startsAt.getTime() - completed[index + 1].startsAt.getTime()) / 86_400_000)).filter((days) => days > 0);
  const normalCycleDays = intervals.length ? Math.round(intervals.reduce((sum, days) => sum + days, 0) / intervals.length) : null;
  const daysSinceVisit = completed[0] ? Math.floor((currentTime.getTime() - completed[0].startsAt.getTime()) / 86_400_000) : null;
  const dueToRebook = Boolean(normalCycleDays && daysSinceVisit && daysSinceVisit > normalCycleDays);

  return <>
    <Link href="/dashboard/customers">← Back to customers</Link>
    <div style={{ display: "flex", justifyContent: "space-between", gap: 18, alignItems: "start", flexWrap: "wrap", marginTop: 18 }}>
      <div><span className="badge">{customer.crmStatus.replace("_", " ")}</span><h1 style={{ marginBottom: 6 }}>{customer.name}</h1><p style={{ color: "var(--muted)", marginTop: 0 }}>{customer.phone}{customer.email ? ` · ${customer.email}` : ""}</p></div>
      {dueToRebook && <div className="card" style={{ padding: 18, maxWidth: 340 }}><strong>Likely due to rebook</strong><p style={{ marginBottom: 0 }}>Usually returns every {normalCycleDays} days. Last completed visit was {daysSinceVisit} days ago.</p></div>}
    </div>

    <div className="grid-auto" style={{ margin: "24px 0" }}>
      <section className="card" style={{ padding: 20 }}><small>Lifetime value</small><h2>{euro(lifetimeValue)}</h2><p>{completed.length} completed visits</p></section>
      <section className="card" style={{ padding: 20 }}><small>Average booking</small><h2>{euro(averageBooking)}</h2><p>Completed services</p></section>
      <section className="card" style={{ padding: 20 }}><small>Favourite service</small><h2 style={{ fontSize: 22 }}>{favouriteService}</h2><p>{serviceCounts.size} services tried</p></section>
      <section className="card" style={{ padding: 20 }}><small>Preferred staff</small><h2 style={{ fontSize: 22 }}>{favouriteStaff}</h2><p>{customer.noShowCount} no-shows</p></section>
    </div>

    <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) minmax(320px,.72fr)", gap: 22, alignItems: "start" }}>
      <div style={{ display: "grid", gap: 22 }}>
        <section className="card" style={{ padding: 22 }}>
          <h2>Appointment history</h2>
          {customer.bookings.length === 0 ? <p>No bookings yet.</p> : <div style={{ display: "grid", gap: 12 }}>{customer.bookings.map((booking) => <article key={booking.id} style={{ border: "1px solid var(--border)", borderRadius: 14, padding: 16, display: "flex", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}><div><strong>{booking.service.name}</strong><p style={{ margin: "5px 0", color: "var(--muted)" }}>{booking.startsAt.toLocaleString("en-IE", { timeZone: "Europe/Dublin" })} · {booking.staff.name}</p></div><div style={{ textAlign: "right" }}><strong>{euro(booking.service.priceCents)}</strong><br/><span className="badge">{booking.status.replace("_", " ")}</span></div></article>)}</div>}
        </section>

        <section className="card" style={{ padding: 22 }}>
          <h2>Customer timeline</h2>
          <div style={{ display: "grid", gap: 12 }}>
            {customer.bookings.slice(0, 12).map((booking) => <div key={booking.id} style={{ borderLeft: "3px solid #cbd5e1", paddingLeft: 14 }}><strong>{booking.status === "completed" ? "Appointment completed" : booking.status.replace("_", " ")}</strong><p style={{ margin: "4px 0", color: "var(--muted)" }}>{booking.service.name} · {booking.startsAt.toLocaleDateString("en-IE", { timeZone: "Europe/Dublin" })}</p></div>)}
            {auditRows.map((event) => <div key={event.id} style={{ borderLeft: "3px solid #cbd5e1", paddingLeft: 14 }}><strong>{event.action.replaceAll("_", " ").replaceAll(".", " · ")}</strong><p style={{ margin: "4px 0", color: "var(--muted)" }}>{event.createdAt.toLocaleString("en-IE", { timeZone: "Europe/Dublin" })}</p></div>)}
          </div>
        </section>
      </div>

      <form action={updateCustomerProfileAction} className="card" style={{ padding: 22, display: "grid", gap: 14 }}>
        <input type="hidden" name="customerId" value={customer.id} />
        <h2>Customer profile</h2>
        <label><span className="label">Name</span><input className="input" name="name" defaultValue={customer.name} required /></label>
        <label><span className="label">Phone</span><input className="input" name="phone" defaultValue={customer.phone} required /></label>
        <label><span className="label">Email</span><input className="input" type="email" name="email" defaultValue={customer.email || ""} /></label>
        <label><span className="label">Birthday</span><input className="input" type="date" name="birthday" defaultValue={customer.birthday ? customer.birthday.toISOString().slice(0, 10) : ""} /></label>
        <label><span className="label">CRM status</span><select className="input" name="crmStatus" defaultValue={customer.crmStatus}><option value="active">Active</option><option value="vip">VIP</option><option value="at_risk">At risk</option><option value="inactive">Inactive</option></select></label>
        <label><span className="label">Preferred service</span><select className="input" name="preferredServiceId" defaultValue={customer.preferredServiceId || ""}><option value="">Use booking history</option>{serviceRows.map((service) => <option value={service.id} key={service.id}>{service.name}</option>)}</select></label>
        <label><span className="label">Preferred staff member</span><select className="input" name="preferredStaffId" defaultValue={customer.preferredStaffId || ""}><option value="">Use booking history</option>{team.map((member) => <option value={member.id} key={member.id}>{member.name}</option>)}</select></label>
        <label><span className="label">Tags</span><input className="input" name="tags" defaultValue={customer.tags.join(", ")} placeholder="VIP, athlete, regular" /></label>
        <label><span className="label">Private notes</span><textarea className="input" name="notes" rows={7} defaultValue={customer.notes || ""} placeholder="Preferences and service notes. Never shown to the customer." /></label>
        <div style={{ display: "grid", gap: 8 }}><strong>Communication consent</strong><label><input type="checkbox" name="marketingConsent" defaultChecked={customer.marketingConsent} /> Email marketing</label><label><input type="checkbox" name="smsConsent" defaultChecked={customer.smsConsent} /> SMS marketing</label><label><input type="checkbox" name="whatsappConsent" defaultChecked={customer.whatsappConsent} /> WhatsApp marketing</label></div>
        <button className="btn btn-primary">Save customer profile</button>
      </form>
    </div>
  </>;
}
