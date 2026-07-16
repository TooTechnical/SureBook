import Link from "next/link";
import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { customers } from "@/db/schema";
import { requireSession } from "@/lib/session";
import { euro } from "@/lib/utils";

function customerMetrics(customer: Awaited<ReturnType<typeof loadCustomers>>[number]) {
  const completed = customer.bookings.filter((booking) => booking.status === "completed");
  const lifetimeValue = completed.reduce((sum, booking) => sum + booking.service.priceCents, 0);
  const lastVisit = completed.length ? completed.map((booking) => booking.startsAt).sort((a, b) => b.getTime() - a.getTime())[0] : null;
  const serviceCounts = new Map<string, { name: string; count: number }>();
  for (const booking of completed) {
    const current = serviceCounts.get(booking.serviceId) || { name: booking.service.name, count: 0 };
    serviceCounts.set(booking.serviceId, { ...current, count: current.count + 1 });
  }
  const favouriteService = [...serviceCounts.values()].sort((a, b) => b.count - a.count)[0]?.name || "—";
  return { completedVisits: completed.length, lifetimeValue, lastVisit, favouriteService };
}

async function loadCustomers(salonId: string) {
  return db.query.customers.findMany({
    where: eq(customers.salonId, salonId),
    with: { bookings: { with: { service: true, staff: true } }, preferredService: true, preferredStaff: true },
    orderBy: [desc(customers.updatedAt)],
  });
}

export default async function Page() {
  const session = await requireSession();
  const rows = await loadCustomers(session.salonId);
  const metrics = rows.map((customer) => ({ customer, ...customerMetrics(customer) }));
  const totalValue = metrics.reduce((sum, row) => sum + row.lifetimeValue, 0);
  const activeCustomers = metrics.filter((row) => row.customer.crmStatus !== "inactive").length;
  const repeatCustomers = metrics.filter((row) => row.completedVisits >= 2).length;

  return <>
    <div style={{ display: "flex", justifyContent: "space-between", gap: 16, alignItems: "end", flexWrap: "wrap" }}>
      <div><h1>Customer CRM</h1><p style={{ color: "var(--muted)" }}>Understand every customer, their value, preferences and booking history.</p></div>
    </div>

    <div className="grid-auto" style={{ margin: "24px 0" }}>
      <section className="card" style={{ padding: 20 }}><small>Customers</small><h2>{rows.length}</h2><p>{activeCustomers} active</p></section>
      <section className="card" style={{ padding: 20 }}><small>Lifetime customer value</small><h2>{euro(totalValue)}</h2><p>Completed services</p></section>
      <section className="card" style={{ padding: 20 }}><small>Repeat customers</small><h2>{repeatCustomers}</h2><p>{rows.length ? Math.round((repeatCustomers / rows.length) * 100) : 0}% retention signal</p></section>
      <section className="card" style={{ padding: 20 }}><small>Total no-shows</small><h2>{rows.reduce((sum, customer) => sum + customer.noShowCount, 0)}</h2><p>Across all customers</p></section>
    </div>

    <div className="card table-wrap" style={{ padding: 12 }}>
      <table>
        <thead><tr><th>Customer</th><th>Last visit</th><th>Favourite service</th><th>Visits</th><th>Lifetime value</th><th>Status</th></tr></thead>
        <tbody>{metrics.map(({ customer, lastVisit, favouriteService, completedVisits, lifetimeValue }) => <tr key={customer.id}>
          <td><Link href={`/dashboard/customers/${customer.id}`}><strong>{customer.name}</strong></Link><br/><small>{customer.phone}{customer.email ? ` · ${customer.email}` : ""}</small></td>
          <td>{lastVisit ? lastVisit.toLocaleDateString("en-IE", { timeZone: "Europe/Dublin" }) : "No completed visit"}</td>
          <td>{customer.preferredService?.name || favouriteService}</td>
          <td>{completedVisits}<br/><small>{customer.noShowCount} no-show{customer.noShowCount === 1 ? "" : "s"}</small></td>
          <td><strong>{euro(lifetimeValue)}</strong></td>
          <td><span className="badge">{customer.crmStatus.replace("_", " ")}</span></td>
        </tr>)}</tbody>
      </table>
    </div>
  </>;
}
