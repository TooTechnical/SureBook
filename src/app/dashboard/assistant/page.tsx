import { desc, eq } from "drizzle-orm";
import { AssistantPanel } from "@/components/AssistantPanel";
import { db } from "@/db";
import { aiGenerations } from "@/db/marketing-schema";
import { requireSession } from "@/lib/session";

export default async function Page() {
  const session = await requireSession();
  const history = await db.query.aiGenerations.findMany({ where: eq(aiGenerations.salonId, session.salonId), orderBy: [desc(aiGenerations.createdAt)], limit: 12 });
  return <>
    <div style={{ marginBottom: 24 }}><span className="badge">AI growth workspace</span><h1 style={{ marginBottom: 8 }}>SureBook Assistant</h1><p style={{ color: "var(--muted)", maxWidth: 760 }}>Create marketing content, improve SEO and diagnose booking performance using the business information already inside SureBook.</p></div>
    <AssistantPanel />
    {history.length > 0 && <section className="card" style={{ marginTop: 24, padding: 22 }}><h2>Recent work</h2><div style={{ display: "grid", gap: 12 }}>{history.map((item) => <details key={item.id} style={{ border: "1px solid var(--border)", borderRadius: 14, padding: 14 }}><summary style={{ cursor: "pointer", fontWeight: 800 }}>{item.task.replaceAll("_", " ")} · {item.createdAt.toLocaleString("en-IE", { timeZone: "Europe/Dublin" })}</summary><p style={{ color: "var(--muted)" }}>{item.prompt}</p><div style={{ whiteSpace: "pre-wrap", lineHeight: 1.7 }}>{item.output}</div></details>)}</div></section>}
  </>;
}
