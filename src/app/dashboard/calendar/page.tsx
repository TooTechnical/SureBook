import { addDays, startOfWeek } from "date-fns";
import { SignJWT } from "jose";
import { and, asc, eq, gte, lt } from "drizzle-orm";
import { db } from "@/db";
import { bookings, customers, services, staff } from "@/db/schema";
import { availabilityRules, calendarBlocks } from "@/db/calendar-schema";
import { requireSession } from "@/lib/session";
import { env } from "@/lib/env";
import { CalendarBoard } from "@/components/CalendarBoard";
import { createAvailabilityRuleAction, createCalendarBlockAction, createRecurringAppointmentsAction, deleteAvailabilityRuleAction, deleteCalendarBlockAction } from "@/actions/calendar";

const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

type Props = { searchParams: Promise<{ start?: string }> };

export default async function CalendarPage({ searchParams }: Props) {
  const session = await requireSession();
  const params = await searchParams;
  const requested = params.start ? new Date(`${params.start}T00:00:00Z`) : new Date();
  const weekStart = startOfWeek(requested, { weekStartsOn: 1 });
  const weekEnd = addDays(weekStart, 7);

  const [bookingRows, blockRows, team, serviceRows, customerRows, rules] = await Promise.all([
    db.query.bookings.findMany({ where: and(eq(bookings.salonId, session.salonId), gte(bookings.startsAt, weekStart), lt(bookings.startsAt, weekEnd)), with: { customer: true, service: true, staff: true }, orderBy: [asc(bookings.startsAt)] }),
    db.select().from(calendarBlocks).where(and(eq(calendarBlocks.salonId, session.salonId), lt(calendarBlocks.startsAt, weekEnd), gte(calendarBlocks.endsAt, weekStart))).orderBy(asc(calendarBlocks.startsAt)),
    db.query.staff.findMany({ where: and(eq(staff.salonId, session.salonId), eq(staff.active, true)), orderBy: [asc(staff.name)] }),
    db.query.services.findMany({ where: and(eq(services.salonId, session.salonId), eq(services.active, true)), orderBy: [asc(services.name)] }),
    db.query.customers.findMany({ where: eq(customers.salonId, session.salonId), orderBy: [asc(customers.name)], limit: 500 }),
    db.select().from(availabilityRules).where(eq(availabilityRules.salonId, session.salonId)).orderBy(asc(availabilityRules.dayOfWeek)),
  ]);

  const token = await new SignJWT({ salonId: session.salonId, purpose: "calendar-feed" }).setProtectedHeader({ alg: "HS256" }).setIssuedAt().sign(new TextEncoder().encode(env.SESSION_SECRET));
  const feedUrl = `${env.NEXT_PUBLIC_APP_URL}/api/calendar/feed?token=${encodeURIComponent(token)}`;
  const webcalUrl = feedUrl.replace(/^https?:/, "webcal:");
  const previous = addDays(weekStart, -7).toISOString().slice(0, 10);
  const next = addDays(weekStart, 7).toISOString().slice(0, 10);

  return <>
    <div style={{ display: "flex", justifyContent: "space-between", gap: 16, alignItems: "end", flexWrap: "wrap" }}>
      <div><span className="badge">Epic 2 calendar</span><h1 style={{ marginBottom: 6 }}>Schedule and availability</h1><p style={{ color: "var(--muted)", margin: 0 }}>Drag appointments to move them. Blocks and breaks prevent conflicting bookings.</p></div>
      <div style={{ display: "flex", gap: 8 }}><a className="btn btn-secondary" href={`/dashboard/calendar?start=${previous}`}>← Previous</a><a className="btn btn-secondary" href="/dashboard/calendar">Today</a><a className="btn btn-secondary" href={`/dashboard/calendar?start=${next}`}>Next →</a></div>
    </div>

    <div style={{ marginTop: 24 }}><CalendarBoard weekStart={weekStart.toISOString()} events={bookingRows.map((row) => ({ id: row.id, title: row.service.name, customer: row.customer.name, staff: row.staff.name, startsAt: row.startsAt.toISOString(), endsAt: row.endsAt.toISOString(), status: row.status }))} blocks={blockRows.map((row) => ({ id: row.id, title: row.title, startsAt: row.startsAt.toISOString(), endsAt: row.endsAt.toISOString(), blockType: row.blockType }))} /></div>

    <div className="grid-auto" style={{ marginTop: 24 }}>
      <form action={createCalendarBlockAction} className="card" style={{ padding: 22, display: "grid", gap: 12 }}>
        <div><h2 style={{ marginBottom: 4 }}>Block time</h2><p style={{ color: "var(--muted)", margin: 0 }}>Create holidays, lunch breaks, personal time or general blocks.</p></div>
        <label><span className="label">Title</span><input className="input" name="title" required placeholder="Lunch break or annual leave" /></label>
        <div className="grid-auto"><label><span className="label">Type</span><select className="input" name="blockType"><option value="blocked">Blocked time</option><option value="holiday">Holiday</option><option value="lunch">Lunch break</option><option value="personal">Personal</option></select></label><label><span className="label">Staff member</span><select className="input" name="staffId"><option value="">Whole business</option>{team.map((member) => <option key={member.id} value={member.id}>{member.name}</option>)}</select></label></div>
        <div className="grid-auto"><label><span className="label">Starts</span><input className="input" type="datetime-local" name="startsAt" required /></label><label><span className="label">Ends</span><input className="input" type="datetime-local" name="endsAt" required /></label></div>
        <div className="grid-auto"><label><span className="label">Repeat</span><select className="input" name="recurrence"><option value="none">Does not repeat</option><option value="daily">Daily</option><option value="weekly">Weekly</option></select></label><label><span className="label">Repeat until</span><input className="input" type="date" name="recurrenceUntil" /></label></div>
        <label><input type="checkbox" name="allDay" /> All-day block</label>
        <button className="btn btn-primary">Add block</button>
      </form>

      <form action={createRecurringAppointmentsAction} className="card" style={{ padding: 22, display: "grid", gap: 12 }}>
        <div><h2 style={{ marginBottom: 4 }}>Recurring appointments</h2><p style={{ color: "var(--muted)", margin: 0 }}>Create a planned series for an existing customer.</p></div>
        <label><span className="label">Customer</span><select className="input" name="customerId" required><option value="">Choose customer</option>{customerRows.map((customer) => <option key={customer.id} value={customer.id}>{customer.name} · {customer.phone}</option>)}</select></label>
        <div className="grid-auto"><label><span className="label">Service</span><select className="input" name="serviceId" required>{serviceRows.map((service) => <option key={service.id} value={service.id}>{service.name}</option>)}</select></label><label><span className="label">Staff</span><select className="input" name="staffId" required>{team.map((member) => <option key={member.id} value={member.id}>{member.name}</option>)}</select></label></div>
        <label><span className="label">First appointment</span><input className="input" type="datetime-local" name="firstStartsAt" required /></label>
        <div className="grid-auto"><label><span className="label">Frequency</span><select className="input" name="frequency"><option value="weekly">Weekly</option><option value="fortnightly">Every two weeks</option><option value="monthly">Monthly</option></select></label><label><span className="label">Occurrences</span><input className="input" type="number" name="occurrenceCount" min="2" max="52" defaultValue="6" /></label></div>
        <button className="btn btn-primary">Create appointment series</button>
      </form>
    </div>

    <section className="card" style={{ padding: 22, marginTop: 24 }}>
      <h2>Recurring availability and lunch rules</h2>
      <form action={createAvailabilityRuleAction} className="grid-auto" style={{ alignItems: "end" }}><label><span className="label">Staff</span><select className="input" name="staffId"><option value="">Whole business</option>{team.map((member) => <option key={member.id} value={member.id}>{member.name}</option>)}</select></label><label><span className="label">Day</span><select className="input" name="dayOfWeek">{dayNames.map((day, index) => <option key={day} value={index}>{day}</option>)}</select></label><label><span className="label">Rule</span><select className="input" name="ruleType"><option value="working">Working availability</option><option value="lunch">Lunch break</option></select></label><label><span className="label">From</span><input className="input" type="time" name="startTime" defaultValue="09:00" /></label><label><span className="label">To</span><input className="input" type="time" name="endTime" defaultValue="17:00" /></label><button className="btn btn-primary">Add rule</button></form>
      <div style={{ display: "grid", gap: 8, marginTop: 18 }}>{rules.map((rule) => <div key={rule.id} style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", borderTop: "1px solid var(--line)", paddingTop: 10 }}><span><strong>{dayNames[rule.dayOfWeek]}</strong> · {rule.startTime}–{rule.endTime} · {rule.ruleType}</span><form action={deleteAvailabilityRuleAction}><input type="hidden" name="ruleId" value={rule.id} /><button className="btn btn-secondary">Remove</button></form></div>)}</div>
    </section>

    <section className="card" style={{ padding: 22, marginTop: 24 }}>
      <h2>Google Calendar and Apple Calendar</h2>
      <p style={{ color: "var(--muted)" }}>Subscribe to the secure SureBook calendar feed. New and moved appointments update in your external calendar when it refreshes the subscription.</p>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}><a className="btn btn-primary" href={webcalUrl}>Subscribe in Apple Calendar</a><a className="btn btn-secondary" href={`https://calendar.google.com/calendar/r?cid=${encodeURIComponent(feedUrl)}`} target="_blank" rel="noreferrer">Subscribe in Google Calendar</a><a className="btn btn-secondary" href={feedUrl}>Download / view ICS feed</a></div>
      <small style={{ display: "block", marginTop: 12, color: "var(--muted)" }}>This release provides secure outbound synchronization. Imported Google/Apple busy-time blocking requires provider OAuth and is the next calendar integration layer.</small>
    </section>

    {blockRows.length > 0 && <section className="card" style={{ padding: 22, marginTop: 24 }}><h2>Blocks this week</h2>{blockRows.map((block) => <div key={block.id} style={{ display: "flex", justifyContent: "space-between", gap: 10, padding: "10px 0", borderTop: "1px solid var(--line)" }}><span><strong>{block.title}</strong> · {block.startsAt.toLocaleString("en-IE", { timeZone: "Europe/Dublin" })}</span><form action={deleteCalendarBlockAction}><input type="hidden" name="blockId" value={block.id} /><button className="btn btn-secondary">Remove</button></form></div>)}</section>}
  </>;
}
