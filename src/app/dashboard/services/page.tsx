import { asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { serviceCategories, services } from "@/db/schema";
import { requireSession } from "@/lib/session";
import { euro } from "@/lib/utils";
import { createServiceAction, createServiceCategoryAction } from "@/actions/salon";

export default async function Page() {
  const session = await requireSession();
  const [rows, categories] = await Promise.all([
    db.query.services.findMany({ where: eq(services.salonId, session.salonId), with: { category: true }, orderBy: [asc(services.name)] }),
    db.query.serviceCategories.findMany({ where: eq(serviceCategories.salonId, session.salonId), orderBy: [asc(serviceCategories.sortOrder), asc(serviceCategories.name)] }),
  ]);
  return (
    <>
      <h1>Services and categories</h1>
      <p style={{ color: "var(--muted)" }}>Organise services into clear sections such as Massage, Haircuts, Facials or Packages.</p>
      <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) 380px", gap: 20 }}>
        <div style={{ display: "grid", gap: 18 }}>
          <section className="card table-wrap" style={{ padding: 12 }}><table><thead><tr><th>Category</th><th>Service</th><th>Duration</th><th>Price</th><th>Deposit</th></tr></thead><tbody>{rows.map((service) => <tr key={service.id}><td>{service.category?.name || "Uncategorised"}</td><td><strong>{service.name}</strong><br /><small>{service.description}</small></td><td>{service.durationMinutes} min</td><td>{euro(service.priceCents)}</td><td>{euro(service.depositCents)}</td></tr>)}</tbody></table></section>
          <section className="card" style={{ padding: 22 }}><h2>Service categories</h2>{categories.length === 0 ? <p>No categories yet.</p> : <div className="grid-auto">{categories.map((category) => <article key={category.id} style={{ border: "1px solid var(--border)", borderRadius: 14, padding: 14 }}><strong>{category.name}</strong>{category.description && <p style={{ color: "var(--muted)" }}>{category.description}</p>}</article>)}</div>}<form action={createServiceCategoryAction} className="grid-auto" style={{ alignItems: "end", marginTop: 18 }}><label><span className="label">Category name</span><input className="input" name="name" required placeholder="Massage treatments" /></label><label><span className="label">Description</span><input className="input" name="description" placeholder="Optional" /></label><button className="btn btn-secondary">Add category</button></form></section>
        </div>
        <form action={createServiceAction} className="card" style={{ padding: 22, display: "grid", gap: 14, height: "fit-content" }}><h2 style={{ margin: 0 }}>Add service</h2><label><span className="label">Category</span><select className="input" name="categoryId" defaultValue=""><option value="">Uncategorised</option>{categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select></label><label><span className="label">Name</span><input className="input" name="name" required /></label><label><span className="label">Description</span><textarea className="input" name="description" /></label><label><span className="label">Duration (minutes)</span><input className="input" name="durationMinutes" type="number" defaultValue="45" required /></label><label><span className="label">Price (€)</span><input className="input" name="price" type="number" step="0.01" required /></label><label><span className="label">Deposit (€)</span><input className="input" name="deposit" type="number" step="0.01" defaultValue="10" required /></label><button className="btn btn-primary">Add service</button></form>
      </div>
    </>
  );
}
