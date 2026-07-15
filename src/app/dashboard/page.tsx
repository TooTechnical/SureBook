import { and, asc, count, eq, gte, lt, sql } from "drizzle-orm";
import { startOfDay, addDays } from "date-fns";
import { db } from "@/db";
import { bookings } from "@/db/schema";
import { requireSession } from "@/lib/session";
import { euro } from "@/lib/utils";
import { recordOutcomeAction } from "@/actions/salon";

export default async function Dashboard(){
 const s=await requireSession(); const today=startOfDay(new Date()); const tomorrow=addDays(today,1);
 const rows=await db.query.bookings.findMany({where:and(eq(bookings.salonId,s.salonId),gte(bookings.startsAt,today),lt(bookings.startsAt,tomorrow)),with:{customer:true,service:true,staff:true},orderBy:[asc(bookings.startsAt)]});
 const [metrics]=await db.select({total:count(),protected:sql<number>`coalesce(sum(${bookings.depositCents}),0)`,noShows:sql<number>`count(*) filter (where ${bookings.status}='no_show')`}).from(bookings).where(eq(bookings.salonId,s.salonId));
 return <><div style={{display:"flex",justifyContent:"space-between",alignItems:"end",gap:16}}><div><h1 style={{fontSize:38,marginBottom:6}}>Good day, {s.name}</h1><p style={{color:"var(--muted)",margin:0}}>Here is today’s salon operation.</p></div></div>
 <div className="grid-auto" style={{margin:"26px 0"}}><div className="card" style={{padding:20}}><span className="label">Today’s appointments</span><strong style={{fontSize:34}}>{rows.length}</strong></div><div className="card" style={{padding:20}}><span className="label">Deposits protected</span><strong style={{fontSize:34}}>{euro(Number(metrics.protected||0))}</strong></div><div className="card" style={{padding:20}}><span className="label">All-time bookings</span><strong style={{fontSize:34}}>{metrics.total}</strong></div><div className="card" style={{padding:20}}><span className="label">No-shows recorded</span><strong style={{fontSize:34}}>{metrics.noShows}</strong></div></div>
 <section className="card" style={{padding:20}}><h2>Today’s diary</h2><div className="table-wrap"><table><thead><tr><th>Time</th><th>Client</th><th>Service</th><th>Staff</th><th>Status</th><th>Outcome</th></tr></thead><tbody>{rows.map(b=><tr key={b.id}><td>{b.startsAt.toLocaleTimeString("en-IE",{hour:"2-digit",minute:"2-digit",timeZone:"Europe/Dublin"})}</td><td><strong>{b.customer.name}</strong><br/><small>{b.customer.phone}</small></td><td>{b.service.name}</td><td>{b.staff.name}</td><td><span className="badge">{b.status.replace("_"," ")}</span></td><td>{b.status==="confirmed"?<div style={{display:"flex",gap:8}}><form action={recordOutcomeAction}><input type="hidden" name="bookingId" value={b.id}/><input type="hidden" name="outcome" value="completed"/><button className="btn btn-primary">Showed</button></form><form action={recordOutcomeAction}><input type="hidden" name="bookingId" value={b.id}/><input type="hidden" name="outcome" value="no_show"/><button className="btn btn-secondary">No-show</button></form></div>:"—"}</td></tr>)}{rows.length===0&&<tr><td colSpan={6}>No appointments today yet.</td></tr>}</tbody></table></div></section></>
}
