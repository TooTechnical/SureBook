"use client";

import { useState, useTransition } from "react";
import { Bot, Check, Clipboard, Loader2, Sparkles, TrendingUp } from "lucide-react";
import { runAssistantAction } from "@/actions/assistant";

type Task = "instagram" | "seo" | "booking_diagnosis" | "promotion" | "loyalty" | "custom";

const tasks: Array<{ id: Task; title: string; description: string; example: string }> = [
  { id: "booking_diagnosis", title: "Growth diagnosis", description: "Analyse live booking, no-show and service data, then prioritise the next actions.", example: "Analyse the last 30 days and give me the three highest-impact actions to increase completed bookings." },
  { id: "promotion", title: "Campaign builder", description: "Turn business context into a measurable campaign with safeguards and launch copy.", example: "Create a two-week campaign that fills quieter appointment slots without damaging my premium positioning." },
  { id: "instagram", title: "Instagram campaign", description: "Create grounded content using real services, pricing and business context.", example: "Create an Instagram campaign promoting my most popular service this weekend." },
  { id: "seo", title: "Storefront SEO", description: "Audit the live storefront and generate prioritised local-search improvements.", example: "Audit my storefront SEO and give me the highest-impact fixes first." },
  { id: "loyalty", title: "Retention plan", description: "Build a GDPR-aware loyalty and repeat-booking strategy.", example: "Create a loyalty campaign for customers who usually return every month." },
  { id: "custom", title: "Ask the operator", description: "Use verified SureBook data for practical business decisions.", example: "What should I focus on this week to protect revenue and grow the business?" },
];

export function AssistantPanel() {
  const [task, setTask] = useState<Task>("booking_diagnosis");
  const [prompt, setPrompt] = useState(tasks[0].example);
  const [output, setOutput] = useState("");
  const [model, setModel] = useState("GPT-5.6");
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const [pending, startTransition] = useTransition();

  function choose(next: Task) {
    const selected = tasks.find((item) => item.id === next)!;
    setTask(next);
    setPrompt(selected.example);
    setOutput("");
    setError("");
  }

  function generate() {
    setError("");
    startTransition(async () => {
      try {
        const result = await runAssistantAction({ task, prompt });
        setOutput(result.output);
        setModel(result.model);
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : "Unable to generate guidance.");
      }
    });
  }

  async function copy() {
    await navigator.clipboard.writeText(output);
    setCopied(true);
    setTimeout(() => setCopied(false), 1400);
  }

  return <div style={{ display: "grid", gridTemplateColumns: "minmax(260px,.55fr) minmax(0,1.45fr)", gap: 20, alignItems: "start" }}>
    <aside className="card" style={{ padding: 16, display: "grid", gap: 8 }}>
      <div style={{ padding: "8px 8px 12px" }}>
        <span className="badge"><TrendingUp size={14} /> Decision workflows</span>
        <p style={{ color: "var(--muted)", lineHeight: 1.55, marginBottom: 0 }}>Choose an outcome. The operator combines verified business context with your request.</p>
      </div>
      {tasks.map((item) => <button key={item.id} type="button" onClick={() => choose(item.id)} style={{ textAlign: "left", border: task === item.id ? "2px solid #16a34a" : "1px solid var(--border)", borderRadius: 14, padding: 14, background: task === item.id ? "#f0fdf4" : "white", cursor: "pointer" }}><strong style={{ display: "block", marginBottom: 5 }}>{item.title}</strong><small style={{ color: "var(--muted)", lineHeight: 1.45 }}>{item.description}</small></button>)}
    </aside>

    <section style={{ display: "grid", gap: 18 }}>
      <div className="card" style={{ padding: 24 }}>
        <div style={{ display: "flex", gap: 12, alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", marginBottom: 16 }}>
          <div style={{ display: "flex", gap: 12, alignItems: "center" }}><div style={{ width: 46, height: 46, borderRadius: 14, display: "grid", placeItems: "center", background: "#111827", color: "white" }}><Bot /></div><div><h2 style={{ margin: 0 }}>SureBook Growth Operator</h2><p style={{ margin: "4px 0 0", color: "var(--muted)" }}>Grounded in your storefront, services, bookings, reviews and customer statistics.</p></div></div>
          <span className="badge"><Sparkles size={14} /> GPT-5.6 · high reasoning</span>
        </div>
        <textarea className="input" rows={7} value={prompt} onChange={(event) => setPrompt(event.target.value)} placeholder="Ask the Growth Operator…" />
        <p style={{ color: "var(--muted)", fontSize: 13, lineHeight: 1.5 }}>No customer identities are sent to the model. Recommendations distinguish verified observations from assumptions and require owner approval before use.</p>
        {error && <p style={{ color: "crimson" }}>{error}</p>}
        <button className="btn btn-primary" type="button" disabled={pending || prompt.trim().length < 3} onClick={generate} style={{ marginTop: 8 }}>{pending ? <><Loader2 size={18} className="spin" /> Analysing business data…</> : <><Sparkles size={18} /> Run growth analysis</>}</button>
      </div>

      {output && <article className="card" style={{ padding: 24 }}><div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", flexWrap: "wrap" }}><div><span className="badge">Generated with {model}</span><h2 style={{ margin: "10px 0 0" }}>Recommended action plan</h2></div><button className="btn btn-secondary" type="button" onClick={copy}>{copied ? <Check size={17} /> : <Clipboard size={17} />} {copied ? "Copied" : "Copy plan"}</button></div><div style={{ whiteSpace: "pre-wrap", lineHeight: 1.75, marginTop: 18 }}>{output}</div></article>}
    </section>
  </div>;
}
