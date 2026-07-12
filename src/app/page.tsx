import Link from "next/link";
import { CalendarCheck, CreditCard, BellRing, BarChart3, ShieldCheck, Users } from "lucide-react";
import { Logo } from "@/components/Logo";

const features=[
  [CalendarCheck,"Smarter scheduling","Services, durations, staff and protected availability in one clean calendar."],
  [CreditCard,"Deposits that work","Take reliable deposits through Stripe Connect and keep salon payouts separate."],
  [BellRing,"Automatic reminders","Reduce forgotten appointments with timed email reminders and WhatsApp-ready messaging."],
  [Users,"Customer history","See visit history, preferences, notes and no-show patterns before accepting risky bookings."],
  [BarChart3,"Revenue protection","Track deposits, completed appointments and revenue saved from no-shows."],
  [ShieldCheck,"Irish and GDPR-aware","Built around Europe/Dublin time, euro pricing and responsible customer-data handling."],
];
export default function Home(){ return <main>
<header className="container" style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"22px 0"}}><Logo/><nav style={{display:"flex",gap:12}}><Link className="btn btn-secondary" href="/login">Log in</Link><Link className="btn btn-primary" href="/signup">Start free</Link></nav></header>
<section className="container" style={{padding:"72px 0 54px",display:"grid",gridTemplateColumns:"1.15fr .85fr",gap:40,alignItems:"center"}}>
<div><span className="badge">Built for salons and barbers in Ireland</span><h1 style={{fontSize:"clamp(44px,7vw,78px)",lineHeight:.98,letterSpacing:"-.055em",margin:"22px 0"}}>Protect every appointment. Grow without the no-shows.</h1><p style={{fontSize:20,lineHeight:1.6,color:"var(--muted)",maxWidth:700}}>SureBook combines online booking, deposits, reminders, staff scheduling and customer history so empty chairs stop draining your revenue.</p><div style={{display:"flex",gap:12,marginTop:28,flexWrap:"wrap"}}><Link href="/signup" className="btn btn-primary">Create your salon</Link><a href="#features" className="btn btn-secondary">See how it works</a></div></div>
<div className="card" style={{padding:24}}><div style={{display:"flex",justifyContent:"space-between",marginBottom:18}}><div><div style={{fontWeight:900,fontSize:22}}>Today</div><div style={{color:"var(--muted)"}}>8 appointments · €80 deposits protected</div></div><span className="badge">Live</span></div>{["09:30 · Cut & Finish · Sarah","11:00 · Balayage · Emma","13:15 · Beard Trim · James","15:00 · Colour & Blow-dry · Aoife"].map((x,i)=><div key={x} style={{padding:"16px 0",borderTop:"1px solid var(--line)",display:"flex",justifyContent:"space-between"}}><span>{x}</span><strong>{i===3?"Pending":"Confirmed"}</strong></div>)}</div>
</section>
<section id="features" className="container" style={{padding:"60px 0 90px"}}><h2 style={{fontSize:42,letterSpacing:"-.04em",maxWidth:700}}>Everything a busy salon needs to run a tighter diary.</h2><div className="grid-auto" style={{marginTop:28}}>{features.map(([Icon,title,body])=><article className="card" style={{padding:22}} key={String(title)}><Icon size={28}/><h3 style={{fontSize:20}}>{String(title)}</h3><p style={{color:"var(--muted)",lineHeight:1.6}}>{String(body)}</p></article>)}</div></section>
</main> }
