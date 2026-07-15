import QRCode from "qrcode";
import { asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { businessHours, reviews, salons, services, staff, storefrontImages } from "@/db/schema";
import { requireSession } from "@/lib/session";
import { syncStripeConnectStatus } from "@/lib/stripe-connect";
import { ShareStorefront } from "@/components/ShareStorefront";
import {
  moderateReviewAction, refreshStripeStatusAction, removeStorefrontImageAction, startStripeOnboardingAction,
  updateBusinessHoursAction, updateSalonAction, updateStorefrontAction, uploadStorefrontMediaAction,
} from "@/actions/salon";

const categories = ["Massage therapy", "Barber", "Hair salon", "Aesthetics", "Beauty & wellness", "Nail technician", "Tattoo studio", "Physiotherapy", "Personal training", "Other appointment service"];
const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

type PageProps = { searchParams: Promise<{ stripe?: string }> };

export default async function Page({ searchParams }: PageProps) {
  const session = await requireSession();
  const params = await searchParams;
  let salon = await db.query.salons.findFirst({ where: eq(salons.id, session.salonId) });
  if (!salon) return null;

  const [gallery, team, svc, hours, reviewRows] = await Promise.all([
    db.query.storefrontImages.findMany({ where: eq(storefrontImages.salonId, salon.id), orderBy: [asc(storefrontImages.sortOrder)] }),
    db.query.staff.findMany({ where: eq(staff.salonId, salon.id) }),
    db.query.services.findMany({ where: eq(services.salonId, salon.id) }),
    db.query.businessHours.findMany({ where: eq(businessHours.salonId, salon.id), orderBy: [asc(businessHours.dayOfWeek)] }),
    db.query.reviews.findMany({ where: eq(reviews.salonId, salon.id), with: { customer: true }, orderBy: [asc(reviews.createdAt)] }),
  ]);

  let connectStatus = { accountId: salon.stripeAccountId, detailsSubmitted: false, chargesEnabled: salon.stripeChargesEnabled, payoutsEnabled: salon.stripePayoutsEnabled, requirementsDue: [] as string[], disabledReason: null as string | null };
  let stripeError: string | null = null;
  if (salon.stripeAccountId) {
    try {
      connectStatus = await syncStripeConnectStatus(salon.id);
      salon = { ...salon, stripeChargesEnabled: connectStatus.chargesEnabled, stripePayoutsEnabled: connectStatus.payoutsEnabled };
    } catch (error) {
      console.error("Unable to refresh Stripe Connect status", error);
      stripeError = "SureBook could not refresh the Stripe account status.";
    }
  }

  const storefrontUrl = `${appUrl}/book/${salon.slug}`;
  const qrDataUrl = await QRCode.toDataURL(storefrontUrl, { width: 720, margin: 2 });
  const checks = [
    { label: "Add a logo", done: Boolean(salon.logoUrl) },
    { label: "Add a cover image", done: Boolean(salon.coverImageUrl) },
    { label: "Write your business description", done: Boolean(salon.description && salon.description.length > 80) },
    { label: "Add your address and Eircode", done: Boolean(salon.address && salon.eircode) },
    { label: "Add at least one service", done: svc.length > 0 },
    { label: "Add a team profile", done: team.some((member) => member.bio || member.photoUrl) },
    { label: "Set opening hours", done: hours.length === 7 },
    { label: "Add gallery photos", done: gallery.length >= 3 },
    { label: "Connect Stripe", done: salon.stripeChargesEnabled },
    { label: "Add SEO title and description", done: Boolean(salon.seoTitle && salon.seoDescription) },
  ];
  const completed = checks.filter((check) => check.done).length;
  const completion = Math.round((completed / checks.length) * 100);
  const fullyActive = connectStatus.chargesEnabled && connectStatus.payoutsEnabled;
  const needsInformation = Boolean(connectStatus.accountId) && !fullyActive;

  return (
    <>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 16, alignItems: "end", flexWrap: "wrap" }}>
        <div><h1>Business settings</h1><p style={{ color: "var(--muted)" }}>Build and manage the storefront customers discover, trust and book through.</p></div>
        <a className="btn btn-secondary" href={`/book/${salon.slug}`} target="_blank" rel="noreferrer">Preview storefront</a>
      </div>

      <section className="card" style={{ padding: 24, marginTop: 24 }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 16, alignItems: "center", flexWrap: "wrap" }}><div><span className="badge">Storefront readiness</span><h2 style={{ marginBottom: 4 }}>{completion}% complete</h2><p style={{ color: "var(--muted)", margin: 0 }}>{completed} of {checks.length} launch essentials completed.</p></div><div style={{ width: 220, height: 14, borderRadius: 999, background: "#e5e7eb", overflow: "hidden" }}><div style={{ width: `${completion}%`, height: "100%", background: salon.accentColor }} /></div></div>
        <div className="grid-auto" style={{ marginTop: 18 }}>{checks.map((check) => <div key={check.label} style={{ display: "flex", gap: 10, alignItems: "center" }}><span style={{ width: 24, height: 24, borderRadius: "50%", display: "grid", placeItems: "center", background: check.done ? "#dcfce7" : "#f3f4f6" }}>{check.done ? "✓" : "○"}</span><span>{check.label}</span></div>)}</div>
      </section>

      <div style={{ display: "grid", gap: 22, marginTop: 24 }}>
        <section className="card" style={{ padding: 24 }}>
          <h2>Logo, cover and gallery uploads</h2><p style={{ color: "var(--muted)" }}>Upload JPG, PNG, WebP or GIF images up to 5 MB. Images are stored securely in Vercel Blob.</p>
          <div className="grid-auto">
            <form action={uploadStorefrontMediaAction} style={{ display: "grid", gap: 12 }}><input type="hidden" name="target" value="logo" />{salon.logoUrl && <img src={salon.logoUrl} alt="Current logo" style={{ width: 96, height: 96, objectFit: "cover", borderRadius: 20 }} />}<label><span className="label">Business logo</span><input className="input" type="file" name="file" accept="image/*" required /></label><button className="btn btn-secondary">Upload logo</button></form>
            <form action={uploadStorefrontMediaAction} style={{ display: "grid", gap: 12 }}><input type="hidden" name="target" value="cover" />{salon.coverImageUrl && <img src={salon.coverImageUrl} alt="Current cover" style={{ width: "100%", height: 96, objectFit: "cover", borderRadius: 16 }} />}<label><span className="label">Cover image</span><input className="input" type="file" name="file" accept="image/*" required /></label><button className="btn btn-secondary">Upload cover</button></form>
            <form action={uploadStorefrontMediaAction} style={{ display: "grid", gap: 12 }}><input type="hidden" name="target" value="gallery" /><label><span className="label">Gallery image</span><input className="input" type="file" name="file" accept="image/*" required /></label><label><span className="label">Image description</span><input className="input" name="altText" maxLength={180} placeholder="Sports massage treatment room" /></label><button className="btn btn-primary">Upload gallery photo</button></form>
          </div>
          {gallery.length > 0 && <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(180px,1fr))", gap: 14, marginTop: 22 }}>{gallery.map((image) => <article key={image.id} style={{ border: "1px solid var(--border)", borderRadius: 16, overflow: "hidden" }}><img src={image.imageUrl} alt={image.altText || "Gallery"} style={{ width: "100%", height: 150, objectFit: "cover", display: "block" }} /><form action={removeStorefrontImageAction} style={{ padding: 10 }}><input type="hidden" name="imageId" value={image.id} /><button className="btn btn-secondary" style={{ width: "100%" }}>Remove</button></form></article>)}</div>}
        </section>

        <form action={updateStorefrontAction} className="card" style={{ padding: 24, display: "grid", gap: 18 }}>
          <div><h2 style={{ marginBottom: 6 }}>Storefront design and SEO</h2><p style={{ color: "var(--muted)", margin: 0 }}>Control how your SureBook website looks and appears in search.</p></div>
          <div className="grid-auto"><label><span className="label">Business category</span><select className="input" name="businessCategory" defaultValue={salon.businessCategory}>{categories.map((category) => <option key={category}>{category}</option>)}</select></label><label><span className="label">Tagline</span><input className="input" name="tagline" maxLength={180} defaultValue={salon.tagline || ""} /></label></div>
          <label><span className="label">About your business</span><textarea className="input" name="description" rows={6} maxLength={4000} defaultValue={salon.description || ""} /></label>
          <input type="hidden" name="logoUrl" value={salon.logoUrl || ""} /><input type="hidden" name="coverImageUrl" value={salon.coverImageUrl || ""} />
          <div className="grid-auto"><label><span className="label">Storefront theme</span><select className="input" name="storefrontTheme" defaultValue={salon.storefrontTheme}><option value="modern">Modern</option><option value="minimal">Minimal</option><option value="warm">Warm</option><option value="bold">Bold</option></select></label><label><span className="label">Brand colour</span><input className="input" name="accentColor" type="color" defaultValue={salon.accentColor} style={{ minHeight: 48 }} /></label><label style={{ display: "flex", alignItems: "center", gap: 10, paddingTop: 24 }}><input name="storefrontPublished" type="checkbox" defaultChecked={salon.storefrontPublished} /> Storefront is published</label></div>
          <div className="grid-auto"><label><span className="label">Instagram URL</span><input className="input" name="instagramUrl" type="url" defaultValue={salon.instagramUrl || ""} /></label><label><span className="label">Facebook URL</span><input className="input" name="facebookUrl" type="url" defaultValue={salon.facebookUrl || ""} /></label><label><span className="label">TikTok URL</span><input className="input" name="tiktokUrl" type="url" defaultValue={salon.tiktokUrl || ""} /></label><label><span className="label">Existing website URL</span><input className="input" name="websiteUrl" type="url" defaultValue={salon.websiteUrl || ""} /></label></div>
          <label><span className="label">SEO page title</span><input className="input" name="seoTitle" maxLength={180} defaultValue={salon.seoTitle || ""} /></label><label><span className="label">SEO description</span><textarea className="input" name="seoDescription" rows={3} maxLength={320} defaultValue={salon.seoDescription || ""} /></label>
          <button className="btn btn-primary" style={{ background: salon.accentColor, justifySelf: "start" }}>Save storefront</button>
        </form>

        <form action={updateBusinessHoursAction} className="card" style={{ padding: 24 }}><h2>Opening hours</h2><p style={{ color: "var(--muted)" }}>These hours appear publicly and support appointment availability.</p><div style={{ display: "grid", gap: 10 }}>{dayNames.map((day, index) => { const row = hours.find((h) => h.dayOfWeek === index); return <div key={day} style={{ display: "grid", gridTemplateColumns: "150px 1fr 1fr 100px", gap: 10, alignItems: "center" }}><strong>{day}</strong><input className="input" type="time" name={`open_${index}`} defaultValue={row?.openTime || "09:00"} /><input className="input" type="time" name={`close_${index}`} defaultValue={row?.closeTime || "17:00"} /><label><input type="checkbox" name={`closed_${index}`} defaultChecked={row?.closed ?? (index === 0)} /> Closed</label></div>; })}</div><button className="btn btn-primary" style={{ marginTop: 18 }}>Save opening hours</button></form>

        <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) minmax(320px,.7fr)", gap: 20 }}>
          <form action={updateSalonAction} className="card" style={{ padding: 22, display: "grid", gap: 14 }}><h2>Business and booking details</h2><label><span className="label">Business name</span><input className="input" name="name" defaultValue={salon.name} /></label><label><span className="label">Phone</span><input className="input" name="phone" defaultValue={salon.phone || ""} /></label><label><span className="label">Address</span><textarea className="input" name="address" defaultValue={salon.address || ""} /></label><div className="grid-auto"><label><span className="label">County</span><input className="input" name="county" defaultValue={salon.county || ""} /></label><label><span className="label">Eircode</span><input className="input" name="eircode" defaultValue={salon.eircode || ""} /></label></div><label><span className="label">Free-cancellation window (hours)</span><input className="input" type="number" name="cancellationWindowHours" defaultValue={salon.cancellationWindowHours} /></label><label><span className="label">Default deposit (€)</span><input className="input" type="number" step="0.01" name="defaultDeposit" defaultValue={(salon.defaultDepositCents / 100).toFixed(2)} /></label><button className="btn btn-primary">Save business settings</button></form>
          <div><section className="card" style={{ padding: 22 }}><h2>Stripe payments</h2>{params.stripe === "return" && <p className="badge">Returned from Stripe. Status refreshed.</p>}{stripeError && <p style={{ color: "crimson" }}>{stripeError}</p>}{!connectStatus.accountId && <><p>Connect Stripe to receive deposits and payments.</p><form action={startStripeOnboardingAction}><button className="btn btn-primary">Connect Stripe</button></form></>}{needsInformation && <><p>Stripe still needs information.</p><span className="badge">Payments: {connectStatus.chargesEnabled ? "Enabled" : "Pending"}</span> <span className="badge">Payouts: {connectStatus.payoutsEnabled ? "Enabled" : "Pending"}</span><form action={startStripeOnboardingAction} style={{ marginTop: 14 }}><button className="btn btn-primary">Continue setup</button></form><form action={refreshStripeStatusAction} style={{ marginTop: 10 }}><button className="btn btn-secondary">Refresh status</button></form></>}{fullyActive && <><p>Stripe is fully connected.</p><span className="badge">Payments enabled</span> <span className="badge">Payouts enabled</span></>}</section><section className="card" style={{ padding: 22, marginTop: 18 }}><h2>Share your storefront</h2><code style={{ overflowWrap: "anywhere", display: "block", marginBottom: 14 }}>{storefrontUrl}</code><ShareStorefront url={storefrontUrl} name={salon.name} qrDataUrl={qrDataUrl} /></section></div>
        </div>

        <section className="card" style={{ padding: 24 }}><h2>Customer reviews</h2><p style={{ color: "var(--muted)" }}>Only customers with completed bookings can publish verified reviews.</p>{reviewRows.length === 0 ? <p>No reviews yet.</p> : <div style={{ display: "grid", gap: 12 }}>{reviewRows.slice().reverse().map((review) => <article key={review.id} style={{ border: "1px solid var(--border)", borderRadius: 16, padding: 16 }}><strong>{"★".repeat(review.rating)}{"☆".repeat(5 - review.rating)} · {review.customer.name}</strong>{review.comment && <p>{review.comment}</p>}<form action={moderateReviewAction}><input type="hidden" name="reviewId" value={review.id} /><input type="hidden" name="approved" value={review.approved ? "false" : "true"} /><button className="btn btn-secondary">{review.approved ? "Hide review" : "Publish review"}</button></form></article>)}</div>}</section>
      </div>
    </>
  );
}
