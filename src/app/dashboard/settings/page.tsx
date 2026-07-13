import { eq } from "drizzle-orm";
import { db } from "@/db";
import { salons } from "@/db/schema";
import { requireSession } from "@/lib/session";
import { syncStripeConnectStatus } from "@/lib/stripe-connect";
import {
  refreshStripeStatusAction,
  startStripeOnboardingAction,
  updateSalonAction,
} from "@/actions/salon";

type PageProps = {
  searchParams: Promise<{ stripe?: string }>;
};

export default async function Page({ searchParams }: PageProps) {
  const session = await requireSession();
  const params = await searchParams;
  let salon = await db.query.salons.findFirst({
    where: eq(salons.id, session.salonId),
  });

  if (!salon) return null;

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
      salon = {
        ...salon,
        stripeChargesEnabled: connectStatus.chargesEnabled,
        stripePayoutsEnabled: connectStatus.payoutsEnabled,
      };
    } catch (error) {
      console.error("Unable to refresh Stripe Connect status", error);
      stripeError = "SureBook could not refresh the Stripe account status. Check your Stripe configuration and try again.";
    }
  }

  const fullyActive = connectStatus.chargesEnabled && connectStatus.payoutsEnabled;
  const needsInformation = Boolean(connectStatus.accountId) && !fullyActive;

  return (
    <>
      <h1>Salon settings</h1>
      <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) 380px", gap: 20 }}>
        <form action={updateSalonAction} className="card" style={{ padding: 22, display: "grid", gap: 14 }}>
          <h2>Business details</h2>
          <label><span className="label">Salon name</span><input className="input" name="name" defaultValue={salon.name} /></label>
          <label><span className="label">Phone</span><input className="input" name="phone" defaultValue={salon.phone || ""} /></label>
          <label><span className="label">Address</span><textarea className="input" name="address" defaultValue={salon.address || ""} /></label>
          <label><span className="label">County</span><input className="input" name="county" defaultValue={salon.county || ""} /></label>
          <label><span className="label">Free-cancellation window (hours)</span><input className="input" type="number" name="cancellationWindowHours" defaultValue={salon.cancellationWindowHours} /></label>
          <label><span className="label">Default deposit (€)</span><input className="input" type="number" step="0.01" name="defaultDeposit" defaultValue={(salon.defaultDepositCents / 100).toFixed(2)} /></label>
          <button className="btn btn-primary">Save settings</button>
        </form>

        <div>
          <section className="card" style={{ padding: 22 }}>
            <h2>Stripe payments</h2>

            {params.stripe === "return" && (
              <p className="badge" style={{ marginBottom: 12 }}>Returned from Stripe. Account status refreshed.</p>
            )}
            {params.stripe === "refresh" && (
              <p style={{ color: "var(--muted)" }}>Your Stripe setup link expired or was interrupted. Generate a fresh link below.</p>
            )}
            {params.stripe === "checked" && (
              <p className="badge" style={{ marginBottom: 12 }}>Stripe status checked.</p>
            )}
            {stripeError && <p style={{ color: "crimson" }}>{stripeError}</p>}

            {!connectStatus.accountId && (
              <>
                <p style={{ color: "var(--muted)" }}>Connect your salon’s Stripe account to take deposits and receive payouts directly.</p>
                <form action={startStripeOnboardingAction}>
                  <button className="btn btn-primary">Connect Stripe</button>
                </form>
              </>
            )}

            {needsInformation && (
              <>
                <p style={{ color: "var(--muted)" }}>
                  Stripe still needs information before this salon can accept deposits and receive payouts.
                </p>
                <div style={{ display: "grid", gap: 8, marginBottom: 14 }}>
                  <span className="badge">Details submitted: {connectStatus.detailsSubmitted ? "Yes" : "No"}</span>
                  <span className="badge">Payments enabled: {connectStatus.chargesEnabled ? "Yes" : "No"}</span>
                  <span className="badge">Payouts enabled: {connectStatus.payoutsEnabled ? "Yes" : "No"}</span>
                </div>
                {connectStatus.disabledReason && <p><strong>Stripe status:</strong> {connectStatus.disabledReason}</p>}
                {connectStatus.requirementsDue.length > 0 && (
                  <p style={{ color: "var(--muted)" }}>{connectStatus.requirementsDue.length} verification item(s) remain.</p>
                )}
                <form action={startStripeOnboardingAction}>
                  <button className="btn btn-primary">Continue Stripe setup</button>
                </form>
                <form action={refreshStripeStatusAction} style={{ marginTop: 10 }}>
                  <button className="btn btn-secondary">Refresh status</button>
                </form>
              </>
            )}

            {fullyActive && (
              <>
                <p style={{ color: "var(--muted)" }}>Stripe is connected. This salon can accept booking deposits and receive payouts.</p>
                <div style={{ display: "grid", gap: 8, marginBottom: 14 }}>
                  <span className="badge">Payments enabled</span>
                  <span className="badge">Payouts enabled</span>
                </div>
                <form action={refreshStripeStatusAction}>
                  <button className="btn btn-secondary">Refresh status</button>
                </form>
              </>
            )}
          </section>

          <section className="card" style={{ padding: 22, marginTop: 18 }}>
            <h2>Public booking page</h2>
            <code style={{ overflowWrap: "anywhere" }}>/book/{salon.slug}</code>
          </section>
        </div>
      </div>
    </>
  );
}
