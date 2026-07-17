"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Clock3, List, Map, MapPin, Search, SlidersHorizontal, Star } from "lucide-react";

export type DiscoveryBusiness = {
  id: string;
  slug: string;
  name: string;
  category: string;
  county: string;
  address: string;
  tagline: string;
  coverImageUrl: string | null;
  minPriceCents: number;
  rating: number;
  reviewCount: number;
  openNow: boolean;
  availableToday: boolean;
  distanceKm: number;
};

type Props = { businesses: DiscoveryBusiness[] };

const serviceFilters = ["Female therapist", "Male therapist", "Mobile service", "Wheelchair access", "Home visits"];

export function DiscoveryClient({ businesses }: Props) {
  const [query, setQuery] = useState("");
  const [view, setView] = useState<"list" | "map">("list");
  const [maxDistance, setMaxDistance] = useState(50);
  const [maxPrice, setMaxPrice] = useState(250);
  const [minRating, setMinRating] = useState(0);
  const [todayOnly, setTodayOnly] = useState(false);
  const [openOnly, setOpenOnly] = useState(false);
  const [extraFilters, setExtraFilters] = useState<string[]>([]);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return businesses.filter((business) => {
      const matchesQuery = !needle || [business.name, business.category, business.county, business.address].some((value) => value.toLowerCase().includes(needle));
      return matchesQuery && business.distanceKm <= maxDistance && business.minPriceCents <= maxPrice * 100 && business.rating >= minRating && (!todayOnly || business.availableToday) && (!openOnly || business.openNow);
    });
  }, [businesses, maxDistance, maxPrice, minRating, openOnly, query, todayOnly]);

  function toggleExtra(label: string) {
    setExtraFilters((current) => current.includes(label) ? current.filter((item) => item !== label) : [...current, label]);
  }

  return <main className="discovery-shell">
    <section className="discovery-hero">
      <div>
        <span className="eyebrow">SureBook Ireland</span>
        <h1>Book trusted local services</h1>
        <p>Discover massage therapists, barbers, beauty professionals and tattoo artists across Ireland.</p>
      </div>
      <div className="discovery-search">
        <Search size={20}/>
        <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Massage Dublin, barber Cork, beauty Galway..." aria-label="Search businesses"/>
      </div>
    </section>

    <section className="filter-panel" aria-label="Discovery filters">
      <div className="filter-heading"><SlidersHorizontal size={18}/><strong>Filters</strong><span>{filtered.length} places</span></div>
      <label>Distance <b>{maxDistance} km</b><input type="range" min="1" max="100" value={maxDistance} onChange={(event) => setMaxDistance(Number(event.target.value))}/></label>
      <label>Maximum price <b>€{maxPrice}</b><input type="range" min="10" max="250" step="5" value={maxPrice} onChange={(event) => setMaxPrice(Number(event.target.value))}/></label>
      <label>Rating<select value={minRating} onChange={(event) => setMinRating(Number(event.target.value))}><option value="0">Any rating</option><option value="4">4.0+</option><option value="4.5">4.5+</option><option value="4.8">4.8+</option></select></label>
      <button className={todayOnly ? "filter-chip active" : "filter-chip"} onClick={() => setTodayOnly(!todayOnly)}>Available today</button>
      <button className={openOnly ? "filter-chip active" : "filter-chip"} onClick={() => setOpenOnly(!openOnly)}>Open now</button>
      {serviceFilters.map((filter) => <button key={filter} className={extraFilters.includes(filter) ? "filter-chip active" : "filter-chip"} onClick={() => toggleExtra(filter)}>{filter}</button>)}
    </section>

    <div className="discovery-toolbar">
      <div><strong>{filtered.length} businesses</strong><span>{extraFilters.length > 0 ? ` · ${extraFilters.join(", ")}` : " across Ireland"}</span></div>
      <div className="view-toggle"><button className={view === "list" ? "active" : ""} onClick={() => setView("list")}><List size={17}/>List</button><button className={view === "map" ? "active" : ""} onClick={() => setView("map")}><Map size={17}/>Map</button></div>
    </div>

    {view === "map" ? <section className="market-map" aria-label="Marketplace map">
      <div className="map-grid"/>
      {filtered.slice(0, 12).map((business, index) => <Link key={business.id} href={`/s/${business.slug}`} className="map-price-pin" style={{left:`${12 + ((index * 23) % 74)}%`,top:`${16 + ((index * 31) % 66)}%`}}>€{Math.round(business.minPriceCents / 100)}</Link>)}
      <div className="map-caption"><MapPin size={18}/><span>Interactive map foundation ready for Mapbox or Google Maps coordinates.</span></div>
    </section> : <section className="business-grid">
      {filtered.map((business) => <article className="business-card" key={business.id}>
        <Link href={`/s/${business.slug}`} className="business-image" style={business.coverImageUrl ? {backgroundImage:`url(${business.coverImageUrl})`} : undefined}>
          {!business.coverImageUrl && <span>{business.name.slice(0, 1)}</span>}
          {business.availableToday && <b className="availability-badge">Available today</b>}
        </Link>
        <div className="business-card-body">
          <div className="business-title-row"><div><span>{business.category}</span><h2><Link href={`/s/${business.slug}`}>{business.name}</Link></h2></div><div className="rating"><Star size={15} fill="currentColor"/>{business.rating.toFixed(1)}</div></div>
          <p>{business.tagline || `Professional ${business.category.toLowerCase()} services in ${business.county}.`}</p>
          <div className="business-meta"><span><MapPin size={15}/>{business.county} · {business.distanceKm.toFixed(1)} km</span><span><Clock3 size={15}/>{business.openNow ? "Open now" : "View hours"}</span></div>
          <div className="business-footer"><span>From <strong>€{Math.round(business.minPriceCents / 100)}</strong></span><span>{business.reviewCount} reviews</span></div>
        </div>
      </article>)}
      {filtered.length === 0 && <div className="empty-marketplace"><h2>No exact matches yet</h2><p>Try increasing the distance or price range.</p></div>}
    </section>}
  </main>;
}
