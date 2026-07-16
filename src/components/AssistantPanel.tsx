"use client";

import { useState, useTransition } from "react";
import { Bot, Check, Clipboard, Loader2, Sparkles } from "lucide-react";
import { runAssistantAction } from "@/actions/assistant";

type Task = "instagram" | "seo" | "booking_diagnosis" | "promotion" | "loyalty" | "custom";

const tasks: Array<{ id: Task; title: string; description: string; example: string }> = [
  { id: "instagram", title: "Instagram post", description: "Create a polished post grounded in your real services.", example: "Write an Instagram post promoting my most popular service this weekend." },
  { id: "seo", title: "Improve SEO", description: "Audit and improve your storefront search presence.", example: "Audit my storefront SEO and give me the highest-impact fixes." },
  { id: "booking_diagnosis", title: "Booking diagnosis", description: "Find friction and recommend measurable experiments.", example: "Why am I not getting enough bookings and what should I change first?" },
  { id: "promotion", title: "Promotion", description: "Build a complete seasonal or tactical campaign.", example: "Create a Christmas promotion without discounting my premium service too heavily." },
  { id: "loyalty", title: "Loyalty campaign", description: "Create a safe campaign that increases repeat visits.", example: "Create a loyalty campaign for customers who normally return every month." },
  { id: "custom", title: "Ask anything", description: "Use your SureBook data for practical business guidance.", example: "Give me three actions I should take this week to grow the business." },
];

export function AssistantPanel() {
  const [task, setTask] = useState<Task>("instagram");
  const [prompt, setPrompt] = useState(tasks[0].example);
  const [output, setOutput] = useState("");
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
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : "Unable to generate content.");
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
      {tasks.map((item) => <button key={item.id} type="button" onClick={() => choose(item.id)} style={{ textAlign: "left", border: task === item.id ? "2px solid #16a34a" : "1px solid var(--border)", borderRadius: 14, padding: 14, background: task === item.id ? "#f0fdf4" : "white", cursor: "pointer" }}><strong style={{ display: "block", marginBottom: 5 }}>{item.title}</strong><small style={{ color: "var(--muted)", lineHeight: 1.45 }}>{item.description}</small></button>)}
    </aside>

    <section style={{ display: "grid", gap: 18 }}>
      <div className="card" style={{ padding: 24 }}>
        <div style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 16 }}><div style={{ width: 46, height: 46, borderRadius: 14, display: "grid", placeItems: "center", background: "#111827", color: "white" }}><Bot /></div><div><h2 style={{ margin: 0 }}>SureBook Assistant</h2><p style={{ margin: "4px 0 0", color: "var(--muted)" }}>Uses your verified storefront and booking data. You approve everything before publishing.</p></div></div>
        <textarea className="input" rows={7} value={prompt} onChange={(event) => setPrompt(event.target.value)} placeholder="Ask SureBook Assistant…" />
        {error && <p style={{ color: "crimson" }}>{error}</p>}
        <button className="btn btn-primary" type="button" disabled={pending || prompt.trim().length < 3} onClick={generate} style={{ marginTop: 14 }}>{pending ? <><Loader2 size={18} className="spin" /> Generating…</> : <><Sparkles size={18} /> Generate</>}</button>
      </div>

      {output && <article className="card" style={{ padding: 24 }}><div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center" }}><h2 style={{ margin: 0 }}>Ready to use</h2><button className="btn btn-secondary" type="button" onClick={copy}>{copied ? <Check size={17} /> : <Clipboard size={17} />} {copied ? "Copied" : "Copy"}</button></div><div style={{ whiteSpace: "pre-wrap", lineHeight: 1.75, marginTop: 18 }}>{output}</div></article>}
    </section>
  </div>;
}
