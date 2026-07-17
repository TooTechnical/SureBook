"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import mapboxgl, { type GeoJSONSource, type Map as MapboxMap } from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import { Clock3, Crosshair, List, Loader2, Map, MapPin, Search, SlidersHorizontal, Star } from "lucide-react";
import type { MarketplaceBusiness } from "@/lib/discovery";

type Props = { initialBusinesses: MarketplaceBusiness[]; mapboxToken: string };
type Coordinates = { latitude: number; longitude: number };

const capabilityFilters = [
  ["femaleTherapist", "Female therapist"],
  ["maleTherapist", "Male therapist"],
  ["mobileService", "Mobile service"],
  ["wheelchairAccess", "Wheelchair access"],
  ["homeVisits", "Home visits"],
] as const;

export function DiscoveryClient({ initialBusinesses, mapboxToken }: Props) {
  const [businesses, setBusinesses] = useState(initialBusinesses);
  const [query, setQuery] = useState("");
  const [view, setView] = useState<"list" | "map">("list");
  const [radiusKm, setRadiusKm] = useState(50);
  const [maxPrice, setMaxPrice] = useState(250);
  const [minRating, setMinRating] = useState(0);
  const [availableToday, setAvailableToday] = useState(false);
  const [openNow, setOpenNow] = useState(false);
  const [capabilities, setCapabilities] = useState<Record<string, boolean>>({});
  const [coordinates, setCoordinates] = useState<Coordinates | null>(null);
  const [locationMessage, setLocationMessage] = useState("Search all of Ireland");
  const [loading, setLoading] = useState(false);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapboxMap | null>(null);

  const locatedBusinesses = useMemo(() => businesses.filter((business) => business.latitude != null && business.longitude != null), [businesses]);

  useEffect(() => {
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setLoading(true);
      const params = new URLSearchParams({
        q: query,
        radiusKm: String(radiusKm),
        maxPrice: String(maxPrice),
        minRating: String(minRating),
        availableToday: String(availableToday),
        openNow: String(openNow),
      });
      if (coordinates) {
        params.set("lat", String(coordinates.latitude));
        params.set("lng", String(coordinates.longitude));
      }
      capabilityFilters.forEach(([key]) => params.set(key, String(Boolean(capabilities[key]))));
      try {
        const response = await fetch(`/api/discovery?${params}`, { signal: controller.signal });
        if (!response.ok) throw new Error("Marketplace search failed");
        const payload = await response.json() as { businesses: MarketplaceBusiness[] };
        setBusinesses(payload.businesses);
      } catch (error) {
        if (!(error instanceof DOMException && error.name === "AbortError")) console.error(error);
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, 250);
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [availableToday, capabilities, coordinates, maxPrice, minRating, openNow, query, radiusKm]);

  useEffect(() => {
    if (view !== "map" || !mapboxToken || !mapContainerRef.current || mapRef.current) return;
    mapboxgl.accessToken = mapboxToken;
    const map = new mapboxgl.Map({
      container: mapContainerRef.current,
      style: "mapbox://styles/mapbox/streets-v12",
      center: coordinates ? [coordinates.longitude, coordinates.latitude] : [-8.0, 53.4],
      zoom: coordinates ? 10 : 5.5,
      attributionControl: true,
    });
    map.addControl(new mapboxgl.NavigationControl(), "top-right");
    map.on("load", () => {
      map.addSource("businesses", { type: "geojson", data: businessGeoJson(locatedBusinesses), cluster: true, clusterMaxZoom: 14, clusterRadius: 52 });
      map.addLayer({ id: "clusters", type: "circle", source: "businesses", filter: ["has", "point_count"], paint: { "circle-color": "#1f6b4f", "circle-radius": ["step", ["get", "point_count"], 20, 10, 26, 35, 34], "circle-stroke-color": "#ffffff", "circle-stroke-width": 3 } });
      map.addLayer({ id: "cluster-count", type: "symbol", source: "businesses", filter: ["has", "point_count"], layout: { "text-field": ["get", "point_count_abbreviated"], "text-size": 13 }, paint: { "text-color": "#ffffff" } });
      map.addLayer({ id: "business-points", type: "circle", source: "businesses", filter: ["!", ["has", "point_count"]], paint: { "circle-color": "#ffffff", "circle-radius": 16, "circle-stroke-color": "#1f6b4f", "circle-stroke-width": 5 } });
      map.addLayer({ id: "business-price", type: "symbol", source: "businesses", filter: ["!", ["has", "point_count"]], layout: { "text-field": ["concat", "€", ["to-string", ["get", "price"]]], "text-size": 11 }, paint: { "text-color": "#17211b" } });
      map.on("click", "clusters", async (event) => {
        const feature = map.queryRenderedFeatures(event.point, { layers: ["clusters"] })[0];
        const clusterId = Number(feature.properties?.cluster_id);
        const source = map.getSource("businesses") as GeoJSONSource;
        const zoom = await source.getClusterExpansionZoom(clusterId);
        const point = (feature.geometry as GeoJSON.Point).coordinates as [number, number];
        map.easeTo({ center: point, zoom });
      });
      map.on("click", "business-points", (event) => {
        const slug = event.features?.[0]?.properties?.slug;
        if (slug) window.location.href = `/s/${slug}`;
      });
      ["clusters", "business-points"].forEach((layer) => {
        map.on("mouseenter", layer, () => { map.getCanvas().style.cursor = "pointer"; });
        map.on("mouseleave", layer, () => { map.getCanvas().style.cursor = ""; });
      });
    });
    mapRef.current = map;
    return () => { map.remove(); mapRef.current = null; };
  }, [coordinates, locatedBusinesses, mapboxToken, view]);

  useEffect(() => {
    const source = mapRef.current?.getSource("businesses") as GeoJSONSource | undefined;
    if (source) source.setData(businessGeoJson(locatedBusinesses));
  }, [locatedBusinesses]);

  function requestLocation() {
    if (!navigator.geolocation) {
      setLocationMessage("Location is not supported by this browser");
      return;
    }
    setLocationMessage("Requesting your location…");
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const next = { latitude: position.coords.latitude, longitude: position.coords.longitude };
        setCoordinates(next);
        setLocationMessage(`Showing businesses within ${radiusKm} km`);
        mapRef.current?.flyTo({ center: [next.longitude, next.latitude], zoom: 10 });
      },
      (error) => setLocationMessage(error.code === error.PERMISSION_DENIED ? "Location permission was declined" : "Could not determine your location"),
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 300000 },
    );
  }

  function toggleCapability(key: string) {
    setCapabilities((current) => ({ ...current, [key]: !current[key] }));
  }

  return <main className="discovery-shell">
    <section className="discovery-hero">
      <div><span className="eyebrow">SureBook Ireland</span><h1>Book trusted local services</h1><p>Discover nearby massage therapists, barbers, beauty professionals and tattoo artists.</p></div>
      <div className="discovery-search"><Search size={20}/><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Massage Dublin, barber Cork, beauty Galway…" aria-label="Search businesses"/>{loading && <Loader2 className="spin" size={18}/>}</div>
    </section>

    <section className="filter-panel" aria-label="Discovery filters">
      <div className="filter-heading"><SlidersHorizontal size={18}/><strong>Filters</strong><span>{businesses.length} places</span></div>
      <button className="location-button" onClick={requestLocation}><Crosshair size={17}/>Use my location</button><small>{locationMessage}</small>
      <label>Distance <b>{radiusKm} km</b><input type="range" min="1" max="250" value={radiusKm} onChange={(event) => setRadiusKm(Number(event.target.value))}/></label>
      <label>Maximum price <b>€{maxPrice}</b><input type="range" min="10" max="250" step="5" value={maxPrice} onChange={(event) => setMaxPrice(Number(event.target.value))}/></label>
      <label>Rating<select value={minRating} onChange={(event) => setMinRating(Number(event.target.value))}><option value="0">Any rating</option><option value="4">4.0+</option><option value="4.5">4.5+</option><option value="4.8">4.8+</option></select></label>
      <button className={availableToday ? "filter-chip active" : "filter-chip"} onClick={() => setAvailableToday(!availableToday)}>Available today</button>
      <button className={openNow ? "filter-chip active" : "filter-chip"} onClick={() => setOpenNow(!openNow)}>Open now</button>
      {capabilityFilters.map(([key, label]) => <button key={key} className={capabilities[key] ? "filter-chip active" : "filter-chip"} onClick={() => toggleCapability(key)}>{label}</button>)}
    </section>

    <div className="discovery-toolbar"><div><strong>{businesses.length} businesses</strong><span>{coordinates ? ` · nearest first within ${radiusKm} km` : " across Ireland"}</span></div><div className="view-toggle"><button className={view === "list" ? "active" : ""} onClick={() => setView("list")}><List size={17}/>List</button><button className={view === "map" ? "active" : ""} onClick={() => setView("map")}><Map size={17}/>Map</button></div></div>

    {view === "map" ? <section className="market-map real-map" aria-label="Marketplace map">
      {mapboxToken ? <div ref={mapContainerRef} className="mapbox-container"/> : <div className="map-unavailable"><MapPin size={30}/><h2>Add NEXT_PUBLIC_MAPBOX_TOKEN</h2><p>The marketplace data and PostGIS search are active; a public Mapbox token enables the clustered map.</p></div>}
      {mapboxToken && locatedBusinesses.length === 0 && <div className="map-caption"><MapPin size={18}/><span>Add coordinates in Marketplace settings to place businesses on the map.</span></div>}
    </section> : <section className="business-grid">
      {businesses.map((business) => <article className="business-card" key={business.id}>
        <Link href={`/s/${business.slug}`} className="business-image" style={business.coverImageUrl ? { backgroundImage: `url(${business.coverImageUrl})` } : undefined}>{!business.coverImageUrl && <span>{business.name.slice(0, 1)}</span>}{business.availableToday && <b className="availability-badge">Available today</b>}</Link>
        <div className="business-card-body"><div className="business-title-row"><div><span>{business.category}</span><h2><Link href={`/s/${business.slug}`}>{business.name}</Link></h2></div><div className="rating"><Star size={15} fill="currentColor"/>{business.rating ? business.rating.toFixed(1) : "New"}</div></div><p>{business.tagline || `Professional ${business.category.toLowerCase()} services in ${business.county}.`}</p><div className="business-meta"><span><MapPin size={15}/>{business.county}{business.distanceKm != null ? ` · ${business.distanceKm.toFixed(1)} km` : ""}</span><span><Clock3 size={15}/>{business.openNow ? "Open now" : "View hours"}</span></div><div className="capability-list">{business.mobileService && <span>Mobile</span>}{business.homeVisits && <span>Home visits</span>}{business.wheelchairAccess && <span>Accessible</span>}</div><div className="business-footer"><span>From <strong>€{Math.round(business.minPriceCents / 100)}</strong></span><span>{business.reviewCount} reviews</span></div></div>
      </article>)}
      {businesses.length === 0 && <div className="empty-marketplace"><h2>No exact matches yet</h2><p>Increase the distance or remove one of the filters.</p></div>}
    </section>}
  </main>;
}

function businessGeoJson(businesses: MarketplaceBusiness[]): GeoJSON.FeatureCollection<GeoJSON.Point> {
  return {
    type: "FeatureCollection",
    features: businesses.flatMap((business) => business.latitude == null || business.longitude == null ? [] : [{
      type: "Feature" as const,
      geometry: { type: "Point" as const, coordinates: [business.longitude, business.latitude] },
      properties: { id: business.id, slug: business.slug, name: business.name, price: Math.round(business.minPriceCents / 100), rating: business.rating },
    }]),
  };
}
