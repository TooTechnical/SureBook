"use client";

import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Maximize2, X } from "lucide-react";

type GalleryItem = {
  id: string;
  imageUrl: string;
  comparisonImageUrl: string | null;
  imageType: string;
  altText: string | null;
};

type Props = {
  items: GalleryItem[];
  businessName: string;
  radius: number;
  accent: string;
  text: string;
  muted: string;
};

function BeforeAfter({ before, after, alt, radius }: { before: string; after: string; alt: string; radius: number }) {
  const [position, setPosition] = useState(50);
  return (
    <div style={{ position: "relative", overflow: "hidden", borderRadius: radius, aspectRatio: "4 / 3", background: "#111" }}>
      <img src={after} alt={`${alt} after`} style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
      <div style={{ position: "absolute", inset: 0, width: `${position}%`, overflow: "hidden", borderRight: "2px solid white" }}>
        <img src={before} alt={`${alt} before`} style={{ width: `${10000 / position}%`, maxWidth: "none", height: "100%", objectFit: "cover", display: "block" }} />
      </div>
      <input aria-label="Compare before and after" type="range" min="0" max="100" value={position} onChange={(event) => setPosition(Number(event.target.value))} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", opacity: 0, cursor: "ew-resize" }} />
      <span style={{ position: "absolute", left: 12, bottom: 12, background: "rgba(0,0,0,.65)", color: "white", borderRadius: 999, padding: "6px 10px", fontSize: 12 }}>Before</span>
      <span style={{ position: "absolute", right: 12, bottom: 12, background: "rgba(0,0,0,.65)", color: "white", borderRadius: 999, padding: "6px 10px", fontSize: 12 }}>After</span>
      <div style={{ position: "absolute", left: `calc(${position}% - 18px)`, top: "50%", width: 36, height: 36, transform: "translateY(-50%)", borderRadius: "50%", background: "white", display: "grid", placeItems: "center", boxShadow: "0 8px 30px rgba(0,0,0,.25)", pointerEvents: "none" }}>↔</div>
    </div>
  );
}

export function StorefrontGallery({ items, businessName, radius, accent, text, muted }: Props) {
  const [active, setActive] = useState(0);
  const [lightbox, setLightbox] = useState(false);
  const current = items[active];
  const title = current?.altText || `${businessName} gallery image ${active + 1}`;

  const galleryItems = useMemo(() => items.filter((item) => item.imageUrl), [items]);

  useEffect(() => {
    if (!lightbox) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setLightbox(false);
      if (event.key === "ArrowRight") setActive((value) => (value + 1) % galleryItems.length);
      if (event.key === "ArrowLeft") setActive((value) => (value - 1 + galleryItems.length) % galleryItems.length);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [lightbox, galleryItems.length]);

  if (!current || galleryItems.length === 0) return null;

  const previous = () => setActive((value) => (value - 1 + galleryItems.length) % galleryItems.length);
  const next = () => setActive((value) => (value + 1) % galleryItems.length);

  const media = current.imageType === "before_after" && current.comparisonImageUrl
    ? <BeforeAfter before={current.imageUrl} after={current.comparisonImageUrl} alt={title} radius={radius} />
    : <img src={current.imageUrl} alt={title} style={{ width: "100%", height: "100%", minHeight: 420, maxHeight: 620, objectFit: "cover", borderRadius: radius, display: "block" }} />;

  return (
    <section style={{ margin: "56px 0" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "end", gap: 16, marginBottom: 18 }}>
        <div><span style={{ color: accent, fontWeight: 800, letterSpacing: ".08em", textTransform: "uppercase", fontSize: 12 }}>Gallery</span><h2 style={{ color: text, fontSize: "clamp(32px,5vw,48px)", margin: "8px 0 0" }}>See the experience</h2></div>
        <span style={{ color: muted }}>{active + 1} / {galleryItems.length}</span>
      </div>
      <div style={{ position: "relative" }}>
        {media}
        <button type="button" aria-label="Previous image" onClick={previous} style={{ position: "absolute", left: 16, top: "50%", transform: "translateY(-50%)", width: 46, height: 46, borderRadius: "50%", border: 0, background: "rgba(255,255,255,.92)", display: "grid", placeItems: "center", cursor: "pointer" }}><ChevronLeft /></button>
        <button type="button" aria-label="Next image" onClick={next} style={{ position: "absolute", right: 16, top: "50%", transform: "translateY(-50%)", width: 46, height: 46, borderRadius: "50%", border: 0, background: "rgba(255,255,255,.92)", display: "grid", placeItems: "center", cursor: "pointer" }}><ChevronRight /></button>
        <button type="button" aria-label="Open full screen gallery" onClick={() => setLightbox(true)} style={{ position: "absolute", right: 16, bottom: 16, border: 0, borderRadius: 999, padding: "10px 14px", background: "rgba(15,23,42,.82)", color: "white", display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}><Maximize2 size={17} /> View full screen</button>
      </div>
      <div style={{ display: "flex", gap: 10, overflowX: "auto", padding: "12px 2px 4px", scrollSnapType: "x mandatory" }}>
        {galleryItems.map((item, index) => <button type="button" key={item.id} onClick={() => setActive(index)} style={{ flex: "0 0 112px", height: 78, borderRadius: Math.max(6, radius / 2), overflow: "hidden", padding: 0, border: index === active ? `3px solid ${accent}` : "3px solid transparent", background: "transparent", cursor: "pointer", scrollSnapAlign: "start" }}><img src={item.comparisonImageUrl || item.imageUrl} alt={item.altText || `Gallery thumbnail ${index + 1}`} style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} /></button>)}
      </div>
      <p style={{ color: muted, marginTop: 10 }}>{title}{current.imageType === "before_after" ? " · Drag the slider to compare" : ""}</p>

      {lightbox && <div role="dialog" aria-modal="true" style={{ position: "fixed", inset: 0, zIndex: 1000, background: "rgba(0,0,0,.94)", display: "grid", placeItems: "center", padding: 24 }}>
        <button type="button" aria-label="Close gallery" onClick={() => setLightbox(false)} style={{ position: "fixed", right: 22, top: 22, width: 48, height: 48, borderRadius: "50%", border: 0, background: "white", display: "grid", placeItems: "center", cursor: "pointer" }}><X /></button>
        <button type="button" aria-label="Previous image" onClick={previous} style={{ position: "fixed", left: 22, top: "50%", width: 52, height: 52, borderRadius: "50%", border: 0, background: "white", display: "grid", placeItems: "center", cursor: "pointer" }}><ChevronLeft /></button>
        <div style={{ width: "min(1100px,88vw)", maxHeight: "84vh" }}>{current.imageType === "before_after" && current.comparisonImageUrl ? <BeforeAfter before={current.imageUrl} after={current.comparisonImageUrl} alt={title} radius={radius} /> : <img src={current.imageUrl} alt={title} style={{ width: "100%", maxHeight: "84vh", objectFit: "contain", display: "block" }} />}</div>
        <button type="button" aria-label="Next image" onClick={next} style={{ position: "fixed", right: 22, top: "50%", width: 52, height: 52, borderRadius: "50%", border: 0, background: "white", display: "grid", placeItems: "center", cursor: "pointer" }}><ChevronRight /></button>
      </div>}
    </section>
  );
}