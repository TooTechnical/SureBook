import { sql } from "drizzle-orm";
import { MapPin, Navigation, ShieldCheck } from "lucide-react";
import { db } from "@/db";
import { updateMarketplaceProfileAction } from "@/actions/marketplace";
import { requireSession } from "@/lib/session";

type MarketplaceProfile = {
  latitude: number | string | null;
  longitude: number | string | null;
  has_female_therapist: boolean;
  has_male_therapist: boolean;
  mobile_service: boolean;
  wheelchair_access: boolean;
  home_visits: boolean;
};

export default async function MarketplaceSettingsPage() {
  const session = await requireSession();
  const rows = await db.execute(sql`
    SELECT latitude, longitude, has_female_therapist, has_male_therapist, mobile_service, wheelchair_access, home_visits
    FROM salons
    WHERE id = ${session.salonId}::uuid
    LIMIT 1
  `) as unknown as MarketplaceProfile[];
  const profile = rows[0];
  if (!profile) return null;

  return <>
    <div style={{ display: "flex", justifyContent: "space-between", gap: 18, alignItems: "end", flexWrap: "wrap" }}>
      <div><span className="badge">Epic 6.1</span><h1 style={{ marginBottom: 6 }}>Marketplace presence</h1><p style={{ color: "var(--muted)", margin: 0 }}>Control where your business appears and which discovery filters match it.</p></div>
      <a className="btn btn-secondary" href="/discover" target="_blank" rel="noreferrer">Open marketplace</a>
    </div>

    <div className="grid-auto" style={{ marginTop: 24 }}>
      <section className="card" style={{ padding: 22 }}><MapPin size={24}/><h2>Accurate map position</h2><p style={{ color: "var(--muted)" }}>Coordinates power distance sorting, radius searches and the clustered Mapbox view.</p></section>
      <section className="card" style={{ padding: 22 }}><Navigation size={24}/><h2>Nearby discovery</h2><p style={{ color: "var(--muted)" }}>Customers can securely share browser location and find businesses using indexed PostGIS queries.</p></section>
      <section className="card" style={{ padding: 22 }}><ShieldCheck size={24}/><h2>Honest capabilities</h2><p style={{ color: "var(--muted)" }}>Only select services and access options your business genuinely provides.</p></section>
    </div>

    <form action={updateMarketplaceProfileAction} className="card" style={{ padding: 24, marginTop: 24, display: "grid", gap: 22 }}>
      <div><h2 style={{ marginBottom: 6 }}>Location</h2><p style={{ color: "var(--muted)", margin: 0 }}>Enter the exact public business location. Home-visit providers may use their service-area centre instead of a private home address.</p></div>
      <div className="grid-auto">
        <label><span className="label">Latitude</span><input className="input" name="latitude" type="number" step="any" min="-90" max="90" defaultValue={profile.latitude == null ? "" : String(profile.latitude)} placeholder="53.3498" /></label>
        <label><span className="label">Longitude</span><input className="input" name="longitude" type="number" step="any" min="-180" max="180" defaultValue={profile.longitude == null ? "" : String(profile.longitude)} placeholder="-6.2603" /></label>
      </div>

      <div><h2 style={{ marginBottom: 6 }}>Discovery capabilities</h2><p style={{ color: "var(--muted)", margin: 0 }}>These fields are persisted and now drive the marketplace filters.</p></div>
      <div className="marketplace-checkbox-grid">
        <label><input type="checkbox" name="hasFemaleTherapist" defaultChecked={profile.has_female_therapist}/> Female therapist available</label>
        <label><input type="checkbox" name="hasMaleTherapist" defaultChecked={profile.has_male_therapist}/> Male therapist available</label>
        <label><input type="checkbox" name="mobileService" defaultChecked={profile.mobile_service}/> Mobile service</label>
        <label><input type="checkbox" name="wheelchairAccess" defaultChecked={profile.wheelchair_access}/> Wheelchair access</label>
        <label><input type="checkbox" name="homeVisits" defaultChecked={profile.home_visits}/> Home visits</label>
      </div>
      <button className="btn btn-primary" style={{ justifySelf: "start" }}>Save marketplace profile</button>
    </form>
  </>;
}
