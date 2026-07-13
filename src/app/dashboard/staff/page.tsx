import { eq } from "drizzle-orm";
import { db } from "@/db";
import { staff } from "@/db/schema";
import { requireSession } from "@/lib/session";
import { createStaffAction, updateStaffProfileAction, uploadStorefrontMediaAction } from "@/actions/salon";

export default async function Page() {
  const session = await requireSession();
  const rows = await db.query.staff.findMany({ where: eq(staff.salonId, session.salonId) });
  return (
    <>
      <h1>Team profiles</h1>
      <p style={{ color: "var(--muted)" }}>Add photos, titles and biographies so customers know who they are booking with.</p>
      <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) 380px", gap: 20 }}>
        <div style={{ display: "grid", gap: 16 }}>
          {rows.map((member) => (
            <article className="card" style={{ padding: 20 }} key={member.id}>
              <div style={{ display: "grid", gridTemplateColumns: "110px 1fr", gap: 20 }}>
                <div>{member.photoUrl ? <img src={member.photoUrl} alt={member.name} style={{ width: 96, height: 96, objectFit: "cover", borderRadius: "50%" }} /> : <div style={{ width: 96, height: 96, display: "grid", placeItems: "center", borderRadius: "50%", background: "#e5e7eb", fontSize: 30 }}>{member.name.charAt(0)}</div>}<form action={uploadStorefrontMediaAction} style={{ marginTop: 10 }}><input type="hidden" name="target" value="staff" /><input type="hidden" name="staffId" value={member.id} /><input className="input" type="file" name="file" accept="image/*" required /><button className="btn btn-secondary" style={{ width: "100%", marginTop: 8 }}>Upload photo</button></form></div>
                <form action={updateStaffProfileAction} style={{ display: "grid", gap: 12 }}><input type="hidden" name="staffId" value={member.id} /><div><h3 style={{ margin: 0 }}>{member.name}</h3><small>{member.email || "No email"} · {member.phone || "No phone"}</small></div><label><span className="label">Professional title</span><input className="input" name="title" defaultValue={member.title || ""} placeholder="Senior massage therapist" /></label><label><span className="label">Biography</span><textarea className="input" name="bio" rows={4} defaultValue={member.bio || ""} placeholder="Experience, qualifications and approach." /></label><button className="btn btn-primary">Save profile</button></form>
              </div>
            </article>
          ))}
        </div>
        <form action={createStaffAction} className="card" style={{ padding: 22, display: "grid", gap: 14, height: "fit-content" }}><h2 style={{ margin: 0 }}>Add team member</h2><label><span className="label">Name</span><input className="input" name="name" required /></label><label><span className="label">Professional title</span><input className="input" name="title" /></label><label><span className="label">Biography</span><textarea className="input" name="bio" rows={4} /></label><input type="hidden" name="photoUrl" value="" /><label><span className="label">Email</span><input className="input" type="email" name="email" /></label><label><span className="label">Phone</span><input className="input" name="phone" /></label><button className="btn btn-primary">Add team member</button></form>
      </div>
    </>
  );
}
