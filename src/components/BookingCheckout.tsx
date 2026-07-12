"use client";
import { useState, useTransition } from "react";
import { Elements, PaymentElement, useElements, useStripe } from "@stripe/react-stripe-js";
import { loadStripe } from "@stripe/stripe-js";
import { createBookingIntent } from "@/actions/booking";

const stripePromise = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY ? loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY) : null;

type Service={id:string;name:string;durationMinutes:number;priceCents:number;depositCents:number};
type Staff={id:string;name:string};

export function BookingCheckout({slug,services,staff}:{slug:string;services:Service[];staff:Staff[]}){
 const [clientSecret,setClientSecret]=useState<string|null>(null); const [bookingId,setBookingId]=useState<string|null>(null); const [error,setError]=useState(""); const [pending,startTransition]=useTransition();
 const [form,setForm]=useState({serviceId:services[0]?.id||"",staffId:staff[0]?.id||"",startsAt:"",name:"",phone:"",email:"",marketingConsent:false});
 const selected=services.find(s=>s.id===form.serviceId);
 function submit(e:React.FormEvent){e.preventDefault();setError("");startTransition(async()=>{try{const result=await createBookingIntent({...form,slug,startsAt:new Date(form.startsAt).toISOString()});setBookingId(result.bookingId);setClientSecret(result.clientSecret);if(!result.clientSecret) window.location.href=`/book/${slug}?confirmed=1`;}catch(err){setError(err instanceof Error?err.message:"Unable to create booking");}})}
 if(clientSecret&&stripePromise)return <Elements stripe={stripePromise} options={{clientSecret,appearance:{theme:"stripe",variables:{colorPrimary:"#1f6b4f",borderRadius:"12px"}}}}><PaymentStep bookingId={bookingId!}/></Elements>;
 return <form onSubmit={submit} className="card" style={{padding:24,display:"grid",gap:16}}>
 <div className="grid-auto"><label><span className="label">Service</span><select className="input" value={form.serviceId} onChange={e=>setForm({...form,serviceId:e.target.value})}>{services.map(s=><option key={s.id} value={s.id}>{s.name} · €{(s.priceCents/100).toFixed(2)}</option>)}</select></label><label><span className="label">Team member</span><select className="input" value={form.staffId} onChange={e=>setForm({...form,staffId:e.target.value})}>{staff.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</select></label></div>
 <label><span className="label">Appointment date and time</span><input className="input" type="datetime-local" value={form.startsAt} onChange={e=>setForm({...form,startsAt:e.target.value})} required/></label>
 <div className="grid-auto"><label><span className="label">Your name</span><input className="input" value={form.name} onChange={e=>setForm({...form,name:e.target.value})} required/></label><label><span className="label">Mobile number</span><input className="input" value={form.phone} onChange={e=>setForm({...form,phone:e.target.value})} required/></label></div>
 <label><span className="label">Email</span><input className="input" type="email" value={form.email} onChange={e=>setForm({...form,email:e.target.value})} required/></label>
 <label style={{display:"flex",gap:10,alignItems:"flex-start"}}><input type="checkbox" checked={form.marketingConsent} onChange={e=>setForm({...form,marketingConsent:e.target.checked})}/><span>Send me occasional salon offers. This is optional and does not affect my booking.</span></label>
 {selected&&<div style={{padding:14,borderRadius:12,background:"#eef5f1"}}><strong>Deposit due today: €{(selected.depositCents/100).toFixed(2)}</strong><br/><small>The salon’s cancellation policy applies. Your deposit is credited according to the salon’s terms.</small></div>}
 {error&&<p style={{color:"#a11"}}>{error}</p>}<button className="btn btn-primary" disabled={pending}>{pending?"Securing appointment…":"Continue to secure payment"}</button></form>
}
function PaymentStep({bookingId}:{bookingId:string}){const stripe=useStripe();const elements=useElements();const [loading,setLoading]=useState(false);const [error,setError]=useState("");async function pay(e:React.FormEvent){e.preventDefault();if(!stripe||!elements)return;setLoading(true);const result=await stripe.confirmPayment({elements,confirmParams:{return_url:`${window.location.origin}${window.location.pathname}?confirmed=1&booking=${bookingId}`}});if(result.error){setError(result.error.message||"Payment failed");setLoading(false)}}return <form onSubmit={pay} className="card" style={{padding:24,display:"grid",gap:18}}><h2>Secure your appointment</h2><PaymentElement/>{error&&<p style={{color:"#a11"}}>{error}</p>}<button className="btn btn-primary" disabled={!stripe||loading}>{loading?"Processing…":"Pay deposit and confirm"}</button></form>}
