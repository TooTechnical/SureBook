import Link from "next/link";
import { Logo } from "@/components/Logo";

export default function OfflinePage() {
  return <main className="container" style={{ padding: "32px 0" }}><Logo/><section className="card" style={{ maxWidth: 560, margin: "70px auto", padding: 32, textAlign: "center" }}><h1>You’re offline</h1><p style={{ color: "var(--muted)" }}>SureBook needs a connection to load live bookings and customer data. Reconnect, then try again.</p><Link className="btn btn-primary" href="/dashboard">Try dashboard again</Link></section></main>;
}
