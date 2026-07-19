import { eq } from "drizzle-orm";
import { saveAutomationAction, saveWeeklyReportPreferenceAction } from "@/actions/automation";
import { db } from "@/db";
import { automationDefinitions, weeklyReportPreferences } from "@/db/operations-schema";
import { requireSession } from "@/lib/session";
import { getSmsProvider } from "@/lib/sms";

const defaults = [
  { type: "booking_confirmation", name: "Booking confirmation", trigger: "booking_confirmed", delay: 0, template: "Your booking with {{business_name}} is confirmed for {{appointment_time}}." },
  { type: "appointment_reminder", name: "Appointment reminder", trigger: "before_appointment", delay: -1440, template: "Reminder: your {{service_name}} appointment is at {{appointment_time}}." },
  { type: "post_appointment_thanks", name: "Post-appointment thank-you", trigger: "appointment_completed", delay: 60, template: "Thank you for visiting {{business_name}}. We hope to see you again." },
  { type: "review_request", name: "Review request", trigger: "appointment_completed", delay: 120, template: "Thank you for visiting. If you have a moment, please leave a verified review: {{review_url}}" },
  { type: "rebooking_reminder", name: "Rebooking reminder", trigger: "appointment_completed", delay: 43200, template: "Ready to book your next {{service_name}} appointment? Visit {{storefront_url}}." },
  { type: "missed_appointment_follow_up", name: "Missed-appointment follow-up", trigger: "appointment_no_show", delay: 60, template: "We missed you today. Contact {{business_name}} if you would like to arrange another appointment." },
] as const;

export default async function AutomationsPage() {
  const session = await requireSession();
  const [saved, reports] = await Promise.all([
    db.query.automationDefinitions.findMany({ where: eq(automationDefinitions.salonId, session.salonId) }),
    db.query.weeklyReportPreferences.findFirst({ where: eq(weeklyReportPreferences.salonId, session.salonId) }),
  ]);
  const sms = getSmsProvider();
  return <><div><span className="badge">Owner-controlled lifecycle</span><h1>Automations</h1><p style={{ color: "var(--muted)", maxWidth: 760 }}>Configure transactional and consent-aware messages. SureBook never enables or sends a workflow without business configuration.</p></div>
    {!sms.configured && <p className="card" role="status" style={{ padding: 14, borderColor: "#e6c978" }}><strong>SMS provider not configured.</strong> SMS workflows can be prepared, but the processor will safely skip them until a provider is connected.</p>}
    <section className="card" style={{ padding: 22, margin: "20px 0" }}><h2>Weekly report delivery</h2><p>The in-app report is always available. Email remains off by default.</p><form action={saveWeeklyReportPreferenceAction} style={{ display: "flex", gap: 18, flexWrap: "wrap", alignItems: "center" }}><label><input type="checkbox" name="enabled" defaultChecked={reports?.enabled ?? true} /> Keep weekly report enabled</label><label><input type="checkbox" name="emailEnabled" defaultChecked={reports?.emailEnabled ?? false} /> Email the owner weekly</label><button className="btn btn-primary">Save preference</button></form></section>
    <div style={{ display: "grid", gap: 18 }}>{defaults.map((definition) => { const value = saved.find((row) => row.automationType === definition.type); return <form action={saveAutomationAction} className="card" style={{ padding: 22, display: "grid", gap: 14 }} key={definition.type}><input type="hidden" name="automationType" value={definition.type}/><input type="hidden" name="trigger" value={definition.trigger}/><div style={{ display: "flex", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}><div><h2 style={{ margin: 0 }}>{definition.name}</h2><small>Trigger: {definition.trigger.replaceAll("_", " ")}</small></div><label><input type="checkbox" name="enabled" defaultChecked={value?.enabled ?? false}/> Enabled</label></div><div className="grid-auto"><label><span className="label">Delay in minutes</span><input className="input" name="delayMinutes" type="number" defaultValue={value?.delayMinutes ?? definition.delay}/></label><label><span className="label">Channel</span><select className="input" name="channel" defaultValue={value?.channel ?? "email"}><option value="email">Email</option><option value="sms">SMS (provider required)</option></select></label><label><span className="label">Retry limit</span><input className="input" name="retryLimit" type="number" min="0" max="5" defaultValue={value?.retryLimit ?? 3}/></label></div><label><span className="label">Message template</span><textarea className="input" name="template" rows={4} defaultValue={value?.template ?? definition.template}/></label><label><input type="checkbox" name="ownerApprovalRequired" defaultChecked={value?.ownerApprovalRequired ?? true}/> Require owner approval when the template changes</label><div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}><small>Last updated: {value?.updatedAt ? value.updatedAt.toLocaleString("en-IE") : "Not configured"}</small><button className="btn btn-primary">Save automation</button></div></form>; })}</div>
  </>;
}
