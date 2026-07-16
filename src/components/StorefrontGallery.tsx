"use client";

import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Maximize2, X } from "lucide-react";

type GalleryItem = { id: string; imageUrl: string; comparisonImageUrl: string | null; imageType: string; altText: string | null };
type Props = { items: GalleryItem[]; businessName: string; radius: number; accent: string; text: string; muted: string };

function BeforeAfter({ before, after, alt, radius }: { before: string; after: string; alt: string; radius: number }) {
  const [position, setPosition] = useState(50);
  return <div style={{ position: "relative", overflow: "hidden", borderRadius: radius, aspectRatio: "16 / 10", background: "#111" }}>
    <img src={after} alt={`${alt} after`} style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
    <div style={{ position: "absolute", inset: 0, width: `${position}%`, overflow: "hidden", borderRight: "2px solid white" }}><img src={before} alt={`${alt} before`} style={{ width: `${10000 / Math.max(position, 1)}%`, maxWidth: "none", height: "100%", objectFit: "cover", display: "block" }} /></div>
    <input aria-label="Compare before and after" type="range" min="1" max="99" value={position} onChange={(event) => setPosition(Number(event.target.value))} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", opacity: 0, cursor: "ew-resize" }} />
    <span style={{ position: "absolute", left: 14, bottom: 14, background: "rgba(0,0,0,.68)", color: "white", borderRadius: 999, padding: "7px 11px", fontSize: 12, fontWeight: 800 }}>Before</span>
    <span style={{ position: "absolute", right: 14, bottom: 14, background: "rgba(0,0,0,.68)", color: "white", borderRadius: 999, padding: "7px 11px", fontSize: 12, fontWeight: 800 }}>After</span>
    <div style={{ position: "absolute", left: `calc(${position}% - 20px)`, top: "50%", width: 40, height: 40, transform: "translateY(-50%)", borderRadius: "50%", background: "white", display: "grid", placeItems: "center", boxShadow: "0 8px 30px rgba(0,0,0,.3)", pointerEvents: "none", color: "#111", fontWeight: 900 }}>↔</div>
  </div>;
}

export function StorefrontGallery({ items, businessName, radius, accent, text, muted }: Props) {
  const [active, setActive] = useState(0);
  const [lightbox, setLightbox] = useState(false);
  const [failed, setFailed] = useState<Set<string>>(new Set());
  const galleryItems = useMemo(() => items.filter((item) => item.imageUrl && !failed.has(item.id)), [items, failed]);
  const safeActive = Math.min(active, Math.max(0, galleryItems.length - 1));
  const current = galleryItems[safeActive];
  const title = current?.altText || `${businessName} gallery image ${safeActive + 1}`;

  useEffect(() => { if (active !== safeActive) setActive(safeActive); }, [active, safeActive]);
  useEffect(() => {
    if (!lightbox || galleryItems.length === 0) return;
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") setLightbox(false); if (event.key === "ArrowRight") setActive((v) => (v + 1) % galleryItems.length); if (event.key === "ArrowLeft") setActive((v) => (v - 1 + galleryItems.length) % galleryItems.length); };
    window.addEventListener("keydown", onKey); return () => window.removeEventListener("keydown", onKey);
  }, [lightbox, galleryItems.length]);

  if (!current) return null;
  const previous = () => setActive((v) => (v - 1 + galleryItems.length) % galleryItems.length);
  const next = () => setActive((v) => (v + 1) % galleryItems.length);
  const markFailed = () => setFailed((old) => new Set(old).add(current.id));
  const media = current.imageType === "before_after" && current.comparisonImageUrl ? <BeforeAfter before={current.imageUrl} after={current.comparisonImageUrl} alt={title} radius={radius} /> : <img src={current.imageUrl} alt={title} onError={markFailed} style={{ width: "100%", height: "clamp(320px,52vw,620px)", objectFit: "cover", borderRadius: radius, display: "block" }} />;

  return <section id="gallery" style={{ margin: "64px 0", scrollMarginTop: 100 }}>
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "end", gap: 16, marginBottom: 18 }}><div><span style={{ color: accent, fontWeight: 900, letterSpacing: ".1em", textTransform: "uppercase", fontSize: 12 }}>Gallery</span><h2 style={{ color: text, fontSize: "clamp(38px,5vw,56px)", margin: "8px 0 0", letterSpacing: "-.035em" }}>See the experience</h2></div><span style={{ color: muted, fontWeight: 800 }}>{safeActive + 1} / {galleryItems.length}</span></div>
    <div style={{ position: "relative" }}>{media}{galleryItems.length > 1 && <><button type="button" aria-label="Previous image" onClick={previous} style={{ position: "absolute", left: 16, top: "50%", transform: "translateY(-50%)", width: 48, height: 48, borderRadius: "50%", border: 0, background: "rgba(255,255,255,.94)", display: "grid", placeItems: "center", cursor: "pointer", boxShadow: "0 10px 30px rgba(0,0,0,.2)" }}><ChevronLeft /></button><button type="button" aria-label="Next image" onClick={next} style={{ position: "absolute", right: 16, top: "50%", transform: "translateY(-50%)", width: 48, height: 48, borderRadius: "50%", border: 0, background: "rgba(255,255,255,.94)", display: "grid", placeItems: "center", cursor: "pointer", boxShadow: "0 10px 30px rgba(0,0,0,.2)" }}><ChevronRight /></button></>}
      <button type="button" aria-label="Open full screen gallery" onClick={() => setLightbox(true)} style={{ position: "absolute", right: 16, bottom: 16, border: 0, borderRadius: 999, padding: "11px 15px", background: "rgba(15,23,42,.86)", color: "white", display: "flex", alignItems: "center", gap: 8, cursor: "pointer", fontWeight: 800 }}><Maximize2 size={17} /> Full screen</button></div>
    <div style={{ display: "flex", gap: 10, overflowX: "auto", padding: "12px 2px 4px", scrollSnapType: "x mandatory" }}>{galleryItems.map((item, index) => <button type="button" key={item.id} onClick={() => setActive(index)} style={{ flex: "0 0 126px", height: 84, borderRadius: Math.max(8, radius / 2), overflow: "hidden", padding: 0, border: index === safeActive ? `3px solid ${accent}` : "3px solid transparent", background: "transparent", cursor: "pointer", scrollSnapAlign: "start" }}><img src={item.comparisonImageUrl || item.imageUrl} alt={item.altText || `Gallery thumbnail ${index + 1}`} onError={() => setFailed((old) => new Set(old).add(item.id))} style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} /></button>)}</div>
    <p style={{ color: muted, marginTop: 10 }}>{title}{current.imageType === "before_after" ? " · Drag to compare" : ""}</p>
    {lightbox && <div role="dialog" aria-modal="true" style={{ position: "fixed", inset: 0, zIndex: 1000, background: "rgba(0,0,0,.95)", display: "grid", placeItems: "center", padding: 24 }}><button type="button" aria-label="Close gallery" onClick={() => setLightbox(false)} style={{ position: "fixed", right: 22, top: 22, width: 48, height: 48, borderRadius: "50%", border: 0, background: "white", display: "grid", placeItems: "center", cursor: "pointer" }}><X /></button>{galleryItems.length > 1 && <button type="button" aria-label="Previous image" onClick={previous} style={{ position: "fixed", left: 22, top: "50%", width: 52, height: 52, borderRadius: "50%", border: 0, background: "white", display: "grid", placeItems: "center", cursor: "pointer" }}><ChevronLeft /></button>}<div style={{ width: "min(1180px,90vw)", maxHeight: "86vh" }}>{current.imageType === "before_after" && current.comparisonImageUrl ? <BeforeAfter before={current.imageUrl} after={current.comparisonImageUrl} alt={title} radius={radius} /> : <img src={current.imageUrl} alt={title} style={{ width: "100%", maxHeight: "86vh", objectFit: "contain", display: "block" }} />}</div>{galleryItems.length > 1 && <button type="button" aria-label="Next image" onClick={next} style={{ position: "fixed", right: 22, top: "50%", width: 52, height: 52, borderRadius: "50%", border: 0, background: "white", display: "grid", placeItems: "center", cursor: "pointer" }}><ChevronRight /></button>}</div>}
  </section>;
}
