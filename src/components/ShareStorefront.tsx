"use client";

import { useState } from "react";

export function ShareStorefront({ url, name, qrDataUrl }: { url: string; name: string; qrDataUrl: string }) {
  const [copied, setCopied] = useState(false);

  async function share() {
    if (navigator.share) {
      await navigator.share({ title: name, text: `Book with ${name} on SureBook`, url });
      return;
    }
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  }

  async function copy() {
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  }

  return (
    <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
      <button type="button" className="btn btn-primary" onClick={share}>Share storefront</button>
      <button type="button" className="btn btn-secondary" onClick={copy}>{copied ? "Copied" : "Copy link"}</button>
      <a className="btn btn-secondary" href={qrDataUrl} download={`${name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-surebook-qr.png`}>Download QR</a>
    </div>
  );
}
