import Link from "next/link";
import { CalendarDays, LayoutDashboard, Scissors, Users, Contact, Settings } from "lucide-react";
import { Logo } from "./Logo";
import { logoutAction } from "@/actions/auth";
const items=[["/dashboard",LayoutDashboard,"Overview"],["/dashboard/bookings",CalendarDays,"Bookings"],["/dashboard/services",Scissors,"Services"],["/dashboard/staff",Users,"Staff"],["/dashboard/customers",Contact,"Customers"],["/dashboard/settings",Settings,"Settings"]] as const;
export function DashboardNav(){return <aside style={{padding:22,borderRight:"1px solid var(--line)",minHeight:"100vh",background:"white"}}><Logo/><nav style={{display:"grid",gap:7,marginTop:35}}>{items.map(([href,Icon,label])=><Link key={href} href={href} className="btn btn-secondary" style={{justifyContent:"flex-start",border:"none"}}><Icon size={18}/>{label}</Link>)}</nav><form action={logoutAction} style={{marginTop:30}}><button className="btn btn-secondary" style={{width:"100%"}}>Log out</button></form></aside>}
