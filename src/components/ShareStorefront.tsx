"use client";

import { useState } from "react";
import { Copy, Download, Share2 } from "lucide-react";

export function ShareStorefront({ url, name, qrDataUrl, accent = "#1f7a5a", accentText = "#fff", text = "#111827", border = "#d7dde5", surface = "#fff" }: { url: string; name: string; qrDataUrl: string; accent?: string; accentText?: string; text?: string; border?: string; surface?: string }) {
  const [copied, setCopied] = useState(false);
  async function share() { if (navigator.share) { await navigator.share({ title: name, text: `Book with ${name} on SureBook`, url }); return; } await copy(); }
  async function copy() { await navigator.clipboard.writeText(url); setCopied(true); setTimeout(() => setCopied(false), 1600); }
  const primary = { border: 0, borderRadius: 12, padding: "11px 15px", background: accent, color: accentText, fontWeight: 900, display: "inline-flex", alignItems: "center", gap: 8, cursor: "pointer", textDecoration: "none" };
  const secondary = { border: `1px solid ${border}`, borderRadius: 12, padding: "11px 15px", background: surface, color: text, fontWeight: 850, display: "inline-flex", alignItems: "center", gap: 8, cursor: "pointer", textDecoration: "none" };
  return <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}><button type="button" style={primary} onClick={share}><Share2 size={17} /> Share</button><button type="button" style={secondary} onClick={copy}><Copy size={17} /> {copied ? "Copied" : "Copy link"}</button><a style={secondary} href={qrDataUrl} download={`${name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-surebook-qr.png`}><Download size={17} /> QR code</a></div>;
}
