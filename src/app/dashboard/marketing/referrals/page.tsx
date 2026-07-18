import { and, desc, eq } from "drizzle-orm";
import { issueReferralLinkAction } from "@/actions/referral";
import { db } from "@/db";
import { referralCampaigns, referrals } from "@/db/marketing-schema";
import { customers } from "@/db/schema";
import { requireSession } from "@/lib/session";

export default async function Page() {
  const session = await requireSession();
  const [campaigns, customerRows, referralRows] = await Promise.all([
    db.query.referralCampaigns.findMany({ where: and(eq(referralCampaigns.salonId, session.salonId), eq(referralCampaigns.active, true)), orderBy: [desc(referralCampaigns.createdAt)] }),
    db.query.customers.findMany({ where: eq(customers.salonId, session.salonId), orderBy: [desc(customers.updatedAt)], limit: 500 }),
    db.query.referrals.findMany({ where: eq(referrals.salonId, session.salonId), orderBy: [desc(referrals.createdAt)], limit: 500 }),
  ]);

  const customerMap = new Map(customerRows.map((customer) => [customer.id, customer]));
  const campaignMap = new Map(campaigns.map((campaign) => [campaign.id, campaign]));
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

  return <>
    <a href="/dashboard/marketing">← Back to marketing</a>
    <div style={{ margin: "18px 0 24px" }}><span className="badge">Referral engine</span><h1 style={{ marginBottom: 8 }}>Customer referral links</h1><p style={{ color: "var(--muted)", maxWidth: 760 }}>Issue a unique link to an existing customer. SureBook tracks when their friend starts a booking and when Stripe confirms the qualifying payment.</p></div>

    <form action={issueReferralLinkAction} className="card" style={{ padding: 22, display: "grid", gap: 14, maxWidth: 760 }}><h2>Issue referral link</h2><label><span className="label">Campaign</span><select className="input" name="campaignId" required><option value="">Choose campaign</option>{campaigns.map((campaign) => <option value={campaign.id} key={campaign.id}>{campaign.name}</option>)}</select></label><label><span className="label">Existing customer</span><select className="input" name="customerId" required><option value="">Choose customer</option>{customerRows.map((customer) => <option value={customer.id} key={customer.id}>{customer.name} · {customer.phone}</option>)}</select></label><button className="btn btn-primary">Create referral link</button></form>

    <section className="card table-wrap" style={{ padding: 16, marginTop: 24 }}><h2>Issued links</h2><table><thead><tr><th>Customer</th><th>Campaign</th><th>Referral link</th><th>Status</th><th>Created</th></tr></thead><tbody>{referralRows.length === 0 ? <tr><td colSpan={5}>No referral links issued.</td></tr> : referralRows.map((referral) => { const customer = referral.referrerCustomerId ? customerMap.get(referral.referrerCustomerId) : null; const campaign = campaignMap.get(referral.campaignId); const url = `${appUrl}/r/${referral.code}`; return <tr key={referral.id}><td>{customer?.name || "Customer removed"}</td><td>{campaign?.name || "Campaign"}</td><td><code style={{ overflowWrap: "anywhere" }}>{url}</code></td><td><span className="badge">{referral.status}</span></td><td>{referral.createdAt.toLocaleDateString("en-IE", { timeZone: "Europe/Dublin" })}</td></tr>; })}</tbody></table></section>
  </>;
}
