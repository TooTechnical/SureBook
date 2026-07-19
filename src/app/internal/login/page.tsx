import { internalLoginAction } from "@/actions/internal-auth";
import { Logo } from "@/components/Logo";

export default async function InternalLogin({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const params = await searchParams;
  return <main className="container" style={{ padding: "32px 0" }}><Logo/><section className="card" style={{ maxWidth: 460, margin: "70px auto", padding: 28 }}><span className="badge">Restricted internal access</span><h1>SureBook operations</h1><p style={{ color: "var(--muted)" }}>Business-owner accounts cannot access this console.</p>{params.error && <p role="alert" style={{ color: "#a52b2b" }}>The internal account details were not accepted.</p>}<form action={internalLoginAction} style={{ display: "grid", gap: 14 }}><label><span className="label">Internal email</span><input className="input" type="email" name="email" autoComplete="username" required/></label><label><span className="label">Password</span><input className="input" type="password" name="password" autoComplete="current-password" required/></label><button className="btn btn-primary">Sign in securely</button></form></section></main>;
}
