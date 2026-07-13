import { asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { salons, storefrontImages } from "@/db/schema";
import { requireSession } from "@/lib/session";
import { syncStripeConnectStatus } from "@/lib/stripe-connect";
import {
  addStorefrontImageAction,
  refreshStripeStatusAction,
  removeStorefrontImageAction,
  startStripeOnboardingAction,
  updateSalonAction,
  updateStorefrontAction,
} from "@/actions/salon";

const categories = [
  "Massage therapy",
  "Barber",
  "Hair salon",
  "Aesthetics",
  "Beauty & wellness",
  "Nail technician",
  "Tattoo studio",
  "Physiotherapy",
  "Personal training",
  "Other appointment service",
];

type PageProps = { searchParams: Promise<{ stripe?: string }> };

export default async function Page({ searchParams }: PageProps) {
  const session = await requireSession();
  const params = await searchParams;
  let salon = await db.query.salons.findFirst({ where: eq(salons.id, session.salonId) });
  if (!salon) return null;

  const gallery = await db.query.storefrontImages.findMany({
    where: eq(storefrontImages.salonId, salon.id),
    orderBy: [asc(storefrontImages.sortOrder), asc(storefrontImages.createdAt)],
  });

  let connectStatus = {
    accountId: salon.stripeAccountId,
    detailsSubmitted: false,
    chargesEnabled: salon.stripeChargesEnabled,
    payoutsEnabled: salon.stripePayoutsEnabled,
    requirementsDue: [] as string[],
    disabledReason: null as string | null,
  };
  let stripeError: string | null = null;

  if (salon.stripeAccountId) {
    try {
      connectStatus = await syncStripeConnectStatus(salon.id);
      salon = { ...salon, stripeChargesEnabled: connectStatus.chargesEnabled, stripePayoutsEnabled: connectStatus.payoutsEnabled };
    } catch (error) {
      console.error("Unable to refresh Stripe Connect status", error);
      stripeError = "SureBook could not refresh the Stripe account status. Check your Stripe configuration and try again.";
    }
  }

  const fullyActive = connectStatus.chargesEnabled && connectStatus.payoutsEnabled;
  const needsInformation = Boolean(connectStatus.accountId) && !fullyActive;

  return (
    <>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 16, alignItems: "end", flexWrap: "wrap" }}>
        <div>
          <h1>Business settings</h1>
          <p style={{ color: "var(--muted)" }}>Edit the storefront customers see, manage payments and control booking policies.</p>
        </div>
        <a className="btn btn-secondary" href={`/book/${salon.slug}`} target="_blank" rel="noreferrer">Preview storefront</a>
      </div>

      <div style={{ display: "grid", gap: 22, marginTop: 24 }}>
        <form action={updateStorefrontAction} className="card" style={{ padding: 24, display: "grid", gap: 18 }}>
          <div><h2 style={{ marginBottom: 6 }}>Storefront</h2><p style={{ color: "var(--muted)", margin: 0 }}>This is your simple website inside SureBook.</p></div>
          <div className="grid-auto">
            <label><span className="label">Business category</span><select className="input" name="businessCategory" defaultValue={salon.businessCategory}>{categories.map((category) => <option key={category}>{category}</option>)}</select></label>
            <label><span className="label">Tagline</span><input className="input" name="tagline" maxLength={180} defaultValue={salon.tagline || ""} placeholder="Expert care, easy booking" /></label>
          </div>
          <label><span className="label">About your business</span><textarea className="input" name="description" rows={6} maxLength={4000} defaultValue={salon.description || ""} placeholder="Tell customers what makes your business different, who you help and what experience they can expect." /></label>
          <div className="grid-auto">
            <label><span className="label">Logo image URL</span><input className="input" name="logoUrl" type="url" defaultValue={salon.logoUrl || ""} placeholder="https://..." /></label>
            <label><span className="label">Cover image URL</span><input className="input" name="coverImageUrl" type="url" defaultValue={salon.coverImageUrl || ""} placeholder="https://..." /></label>
          </div>
          <div className="grid-auto">
            <label><span className="label">Brand colour</span><input className="input" name="accentColor" type="color" defaultValue={salon.accentColor} style={{ minHeight: 48 }} /></label>
            <label style={{ display: "flex", alignItems: "center", gap: 10, paddingTop: 24 }}><input name="storefrontPublished" type="checkbox" defaultChecked={salon.storefrontPublished} /> Storefront is published</label>
          </div>
          <div className="grid-auto">
            <label><span className="label">Instagram URL</span><input className="input" name="instagramUrl" type="url" defaultValue={salon.instagramUrl || ""} /></label>
            <label><span className="label">Facebook URL</span><input className="input" name="facebookUrl" type="url" defaultValue={salon.facebookUrl || ""} /></label>
            <label><span className="label">TikTok URL</span><input className="input" name="tiktokUrl" type="url" defaultValue={salon.tiktokUrl || ""} /></label>
            <label><span className="label">Existing website URL</span><input className="input" name="websiteUrl" type="url" defaultValue={salon.websiteUrl || ""} /></label>
          </div>
          <div style={{ borderTop: "1px solid var(--border)", paddingTop: 18 }}>
            <h3>Search appearance</h3>
            <p style={{ color: "var(--muted)" }}>SureBook will create sensible defaults when these are blank.</p>
            <div style={{ display: "grid", gap: 14 }}>
              <label><span className="label">SEO page title</span><input className="input" name="seoTitle" maxLength={180} defaultValue={salon.seoTitle || ""} placeholder={`${salon.name} | ${salon.businessCategory} in ${salon.county || "Ireland"}`} /></label>
              <label><span className="label">SEO description</span><textarea className="input" name="seoDescription" rows={3} maxLength={320} defaultValue={salon.seoDescription || ""} placeholder="Describe your services, location and why customers should book." /></label>
            </div>
          </div>
          <button className="btn btn-primary" style={{ background: salon.accentColor, justifySelf: "start" }}>Save storefront</button>
        </form>

        <section className="card" style={{ padding: 24 }}>
          <h2>Photo gallery</h2>
          <p style={{ color: "var(--muted)" }}>Add up to 12 photos. Direct uploads will be added after the storefront model is validated.</p>
          <form action={addStorefrontImageAction} className="grid-auto" style={{ alignItems: "end", marginBottom: 20 }}>
            <label><span className="label">Image URL</span><input className="input" name="imageUrl" type="url" required placeholder="https://..." /></label>
            <label><span className="label">Image description</span><input className="input" name="altText" maxLength={180} placeholder="Treatment room, haircut result, team photo..." /></label>
            <button className="btn btn-primary">Add photo</button>
          </form>
          {gallery.length === 0 ? <p style={{ color: "var(--muted)" }}>No gallery photos yet.</p> : <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(180px,1fr))", gap: 14 }}>{gallery.map((image) => <article key={image.id} style={{ border: "1px solid var(--border)", borderRadius: 16, overflow: "hidden" }}><img src={image.imageUrl} alt={image.altText || `${salon.name} gallery image`} style={{ width: "100%", height: 150, objectFit: "cover", display: "block" }} /><div style={{ padding: 10 }}><small>{image.altText || "Gallery photo"}</small><form action={removeStorefrontImageAction} style={{ marginTop: 8 }}><input type="hidden" name="imageId" value={image.id} /><button className="btn btn-secondary" style={{ width: "100%" }}>Remove</button></form></div></article>)}</div>}
        </section>

        <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) minmax(320px,0.7fr)", gap: 20 }}>
          <form action={updateSalonAction} className="card" style={{ padding: 22, display: "grid", gap: 14 }}>
            <h2>Business and booking details</h2>
            <label><span className="label">Business name</span><input className="input" name="name" defaultValue={salon.name} /></label>
            <label><span className="label">Phone</span><input className="input" name="phone" defaultValue={salon.phone || ""} /></label>
            <label><span className="label">Address</span><textarea className="input" name="address" defaultValue={salon.address || ""} /></label>
            <label><span className="label">County</span><input className="input" name="county" defaultValue={salon.county || ""} /></label>
            <label><span className="label">Free-cancellation window (hours)</span><input className="input" type="number" name="cancellationWindowHours" defaultValue={salon.cancellationWindowHours} /></label>
            <label><span className="label">Default deposit (€)</span><input className="input" type="number" step="0.01" name="defaultDeposit" defaultValue={(salon.defaultDepositCents / 100).toFixed(2)} /></label>
            <button className="btn btn-primary">Save business settings</button>
          </form>

          <div>
            <section className="card" style={{ padding: 22 }}>
              <h2>Stripe payments</h2>
              {params.stripe === "return" && <p className="badge">Returned from Stripe. Account status refreshed.</p>}
              {params.stripe === "refresh" && <p style={{ color: "var(--muted)" }}>Your Stripe setup link expired or was interrupted. Generate a fresh link below.</p>}
              {params.stripe === "checked" && <p className="badge">Stripe status checked.</p>}
              {stripeError && <p style={{ color: "crimson" }}>{stripeError}</p>}
              {!connectStatus.accountId && <><p style={{ color: "var(--muted)" }}>Connect Stripe to take deposits and receive payouts directly.</p><form action={startStripeOnboardingAction}><button className="btn btn-primary">Connect Stripe</button></form></>}
              {needsInformation && <><p style={{ color: "var(--muted)" }}>Stripe still needs information before this business can accept payments.</p><div style={{ display: "grid", gap: 8, marginBottom: 14 }}><span className="badge">Details submitted: {connectStatus.detailsSubmitted ? "Yes" : "No"}</span><span className="badge">Payments enabled: {connectStatus.chargesEnabled ? "Yes" : "No"}</span><span className="badge">Payouts enabled: {connectStatus.payoutsEnabled ? "Yes" : "No"}</span></div>{connectStatus.disabledReason && <p><strong>Stripe status:</strong> {connectStatus.disabledReason}</p>}<form action={startStripeOnboardingAction}><button className="btn btn-primary">Continue Stripe setup</button></form><form action={refreshStripeStatusAction} style={{ marginTop: 10 }}><button className="btn btn-secondary">Refresh status</button></form></>}
              {fullyActive && <><p style={{ color: "var(--muted)" }}>Stripe is connected. You can accept booking deposits and receive payouts.</p><div style={{ display: "grid", gap: 8, marginBottom: 14 }}><span className="badge">Payments enabled</span><span className="badge">Payouts enabled</span></div><form action={refreshStripeStatusAction}><button className="btn btn-secondary">Refresh status</button></form></>}
            </section>
            <section className="card" style={{ padding: 22, marginTop: 18 }}><h2>Share your storefront</h2><code style={{ overflowWrap: "anywhere" }}>/book/{salon.slug}</code><p style={{ color: "var(--muted)" }}>Use this link on Instagram, Facebook, WhatsApp, Google Business Profile or an existing website.</p></section>
          </div>
        </div>
      </div>
    </>
  );
}