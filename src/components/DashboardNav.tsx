import Link from "next/link";
import { Bot, CalendarDays, CalendarRange, Contact, Handshake, LayoutDashboard, Megaphone, Scissors, Settings, Users, Workflow } from "lucide-react";
import { Logo } from "./Logo";
import { logoutAction } from "@/actions/auth";

const items = [
  ["/dashboard", LayoutDashboard, "Overview"],
  ["/dashboard/calendar", CalendarRange, "Calendar"],
  ["/dashboard/bookings", CalendarDays, "Bookings"],
  ["/dashboard/services", Scissors, "Services"],
  ["/dashboard/staff", Users, "Staff"],
  ["/dashboard/customers", Contact, "Customers"],
  ["/dashboard/assistant", Bot, "SureBook Assistant"],
  ["/dashboard/automations", Workflow, "Automations"],
  ["/dashboard/marketing", Megaphone, "Marketing & offers"],
  ["/dashboard/marketing/referrals", Handshake, "Referral links"],
  ["/dashboard/settings", Settings, "Settings"],
] as const;

export function DashboardNav() {
  return <aside className="dashboard-nav" aria-label="Business dashboard navigation"><Logo /><nav className="dashboard-nav-links">{items.map(([href, Icon, label]) => <Link key={href} href={href} className="btn btn-secondary dashboard-nav-link"><Icon size={18} aria-hidden="true" /><span>{label}</span></Link>)}</nav><form action={logoutAction} style={{ marginTop: 30 }}><button className="btn btn-secondary" style={{ width: "100%" }}>Log out</button></form></aside>;
}
