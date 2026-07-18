"use client";

import { useMemo, useState, useTransition } from "react";
import {
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  Clock3,
  CreditCard,
  ShieldCheck,
  Tag,
  UserRound,
} from "lucide-react";
import { Elements, PaymentElement, useElements, useStripe } from "@stripe/react-stripe-js";
import { loadStripe } from "@stripe/stripe-js";
import { createBookingIntent } from "@/actions/booking";
import { validateDiscountCodeAction } from "@/actions/discount";

const stripePromise = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
  ? loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY)
  : null;

type Service = {
  id: string;
  name: string;
  description?: string | null;
  durationMinutes: number;
  priceCents: number;
  depositCents: number;
};

type Staff = {
  id: string;
  name: string;
  title?: string | null;
  photoUrl?: string | null;
};

type Props = {
  slug: string;
  services: Service[];
  staff: Staff[];
  accent?: string;
  accentText?: string;
  surface?: string;
  text?: string;
  muted?: string;
  border?: string;
  radius?: number;
};

type AppliedDiscount = {
  code: string;
  description: string | null;
  discountAmountCents: number;
  discountedServicePriceCents: number;
};

export function BookingCheckout({
  slug,
  services,
  staff,
  accent = "#1f6b4f",
  accentText = "#fff",
  surface = "#fff",
  text = "#111827",
  muted = "#64748b",
  border = "#e2e8f0",
  radius = 20,
}: Props) {
  const [step, setStep] = useState(1);
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [bookingId, setBookingId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [discountError, setDiscountError] = useState("");
  const [appliedDiscount, setAppliedDiscount] = useState<AppliedDiscount | null>(null);
  const [pending, startTransition] = useTransition();
  const [discountPending, startDiscountTransition] = useTransition();
  const [form, setForm] = useState({
    serviceId: services[0]?.id || "",
    staffId: staff[0]?.id || "",
    startsAt: "",
    name: "",
    phone: "",
    email: "",
    marketingConsent: false,
    discountCode: "",
  });

  const selected = useMemo(
    () => services.find((service) => service.id === form.serviceId),
    [services, form.serviceId],
  );
  const selectedStaff = staff.find((member) => member.id === form.staffId);
  const canContinue =
    step === 1
      ? Boolean(form.serviceId)
      : step === 2
        ? Boolean(form.staffId && form.startsAt)
        : Boolean(
            form.name.trim().length >= 2 &&
              form.phone.trim().length >= 6 &&
              /.+@.+\..+/.test(form.email),
          );

  const card = {
    border: `1px solid ${border}`,
    borderRadius: Math.max(12, radius - 4),
    background: surface,
    color: text,
  };

  const pill = (active: boolean) => ({
    display: "flex",
    alignItems: "center",
    gap: 9,
    padding: "10px 12px",
    borderRadius: 999,
    background: active ? accent : "transparent",
    color: active ? accentText : muted,
    border: `1px solid ${active ? accent : border}`,
    fontWeight: 850,
    fontSize: 13,
  });

  function selectService(serviceId: string) {
    setForm({ ...form, serviceId, discountCode: "" });
    setAppliedDiscount(null);
    setDiscountError("");
  }

  function applyDiscount() {
    if (!form.discountCode.trim() || !form.serviceId) return;
    setDiscountError("");

    startDiscountTransition(async () => {
      try {
        setAppliedDiscount(
          await validateDiscountCodeAction({
            slug,
            serviceId: form.serviceId,
            code: form.discountCode,
          }),
        );
      } catch (cause) {
        setAppliedDiscount(null);
        setDiscountError(cause instanceof Error ? cause.message : "Unable to apply that code.");
      }
    });
  }

  function submit() {
    setError("");

    startTransition(async () => {
      try {
        const result = await createBookingIntent({
          ...form,
          slug,
          discountCode: appliedDiscount?.code || "",
          startsAt: new Date(form.startsAt).toISOString(),
        });
        setBookingId(result.bookingId);
        setClientSecret(result.clientSecret);
        if (!result.clientSecret) window.location.href = `/book/${slug}?confirmed=1`;
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : "Unable to create booking");
      }
    });
  }

  if (clientSecret && stripePromise) {
    return (
      <Elements
        stripe={stripePromise}
        options={{
          clientSecret,
          appearance: {
            theme: "stripe",
            variables: {
              colorPrimary: accent,
              colorBackground: "#ffffff",
              colorText: "#111827",
              colorTextSecondary: "#4b5563",
              colorTextPlaceholder: "#6b7280",
              colorDanger: "#dc2626",
              borderRadius: `${Math.max(8, radius / 2)}px`,
            },
            rules: {
              ".Input": {
                backgroundColor: "#ffffff",
                color: "#111827",
                borderColor: "#cbd5e1",
              },
              ".Input:focus": {
                borderColor: accent,
                boxShadow: `0 0 0 1px ${accent}`,
              },
              ".Label": { color: "#111827" },
              ".Tab": { backgroundColor: "#ffffff", color: "#111827" },
              ".TabLabel": { color: "#111827" },
            },
          },
        }}
      >
        <PaymentStep
          bookingId={bookingId!}
          accent={accent}
          accentText={accentText}
          surface={surface}
          text={text}
          muted={muted}
          border={border}
          radius={radius}
        />
      </Elements>
    );
  }

  return (
    <div style={{ marginTop: 28 }}>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 24 }}>
        <div style={pill(step === 1)}><Check size={15} /> Service</div>
        <div style={pill(step === 2)}><CalendarDays size={15} /> Time</div>
        <div style={pill(step === 3)}><UserRound size={15} /> Details</div>
        <div style={pill(step === 4)}><CreditCard size={15} /> Confirm</div>
      </div>

      {step === 1 && (
        <div>
          <h3 style={{ fontSize: 26, margin: "0 0 6px", color: text }}>Choose your service</h3>
          <p style={{ color: muted, marginTop: 0 }}>Select the treatment or appointment you would like.</p>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: 12 }}>
            {services.map((service) => {
              const active = service.id === form.serviceId;
              return (
                <button
                  type="button"
                  key={service.id}
                  onClick={() => selectService(service.id)}
                  style={{ ...card, textAlign: "left", padding: 18, cursor: "pointer", borderColor: active ? accent : border, boxShadow: active ? `0 0 0 2px ${accent}` : "none" }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                    <strong style={{ color: text, fontSize: 17 }}>{service.name}</strong>
                    <strong style={{ color: accent }}>€{(service.priceCents / 100).toFixed(2)}</strong>
                  </div>
                  {service.description && <p style={{ color: muted, lineHeight: 1.5, marginBottom: 10 }}>{service.description}</p>}
                  <span style={{ color: muted, fontSize: 13 }}>{service.durationMinutes} minutes</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {step === 2 && (
        <div>
          <h3 style={{ fontSize: 26, margin: "0 0 6px", color: text }}>Choose a professional and time</h3>
          <p style={{ color: muted, marginTop: 0 }}>Pick who you would like to see, then choose an available date and time.</p>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(190px,1fr))", gap: 12, marginBottom: 18 }}>
            {staff.map((member) => {
              const active = member.id === form.staffId;
              return (
                <button
                  type="button"
                  key={member.id}
                  onClick={() => setForm({ ...form, staffId: member.id })}
                  style={{ ...card, padding: 16, textAlign: "left", cursor: "pointer", borderColor: active ? accent : border, boxShadow: active ? `0 0 0 2px ${accent}` : "none", display: "flex", gap: 12, alignItems: "center" }}
                >
                  {member.photoUrl ? (
                    <img src={member.photoUrl} alt={member.name} style={{ width: 52, height: 52, borderRadius: "50%", objectFit: "cover" }} />
                  ) : (
                    <div style={{ width: 52, height: 52, borderRadius: "50%", background: accent, color: accentText, display: "grid", placeItems: "center", fontWeight: 900 }}>
                      {member.name.charAt(0)}
                    </div>
                  )}
                  <div>
                    <strong style={{ display: "block", color: text }}>{member.name}</strong>
                    {member.title && <small style={{ color: muted }}>{member.title}</small>}
                  </div>
                </button>
              );
            })}
          </div>
          <label style={{ display: "grid", gap: 8 }}>
            <span style={{ fontWeight: 850, color: text }}>Appointment date and time</span>
            <input
              type="datetime-local"
              value={form.startsAt}
              onChange={(event) => setForm({ ...form, startsAt: event.target.value })}
              required
              style={{ width: "100%", boxSizing: "border-box", padding: "15px 16px", border: `1px solid ${border}`, borderRadius: Math.max(10, radius / 2), background: surface, color: text, fontSize: 16 }}
            />
          </label>
        </div>
      )}

      {step === 3 && (
        <div>
          <h3 style={{ fontSize: 26, margin: "0 0 6px", color: text }}>Your details</h3>
          <p style={{ color: muted, marginTop: 0 }}>We will use these details for your confirmation and appointment reminders.</p>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(240px,1fr))", gap: 14 }}>
            <Field label="Your name" value={form.name} onChange={(value) => setForm({ ...form, name: value })} text={text} border={border} surface={surface} radius={radius} />
            <Field label="Mobile number" value={form.phone} onChange={(value) => setForm({ ...form, phone: value })} text={text} border={border} surface={surface} radius={radius} />
            <Field label="Email" type="email" value={form.email} onChange={(value) => setForm({ ...form, email: value })} text={text} border={border} surface={surface} radius={radius} />
          </div>
          <label style={{ display: "flex", gap: 10, alignItems: "flex-start", marginTop: 18, color: muted }}>
            <input type="checkbox" checked={form.marketingConsent} onChange={(event) => setForm({ ...form, marketingConsent: event.target.checked })} />
            <span>Send me occasional offers. This is optional and does not affect my booking.</span>
          </label>
        </div>
      )}

      {step === 4 && selected && (
        <div>
          <h3 style={{ fontSize: 26, margin: "0 0 6px", color: text }}>Review your booking</h3>
          <p style={{ color: muted, marginTop: 0 }}>Confirm the details below before securing your appointment.</p>
          <div style={{ ...card, padding: 20, display: "grid", gap: 14 }}>
            <Summary icon={<Check size={18} />} label="Service" value={`${selected.name} · €${(selected.priceCents / 100).toFixed(2)}`} accent={accent} text={text} muted={muted} />
            <Summary icon={<UserRound size={18} />} label="Professional" value={selectedStaff?.name || "Selected team member"} accent={accent} text={text} muted={muted} />
            <Summary icon={<Clock3 size={18} />} label="Appointment" value={new Date(form.startsAt).toLocaleString("en-IE", { dateStyle: "full", timeStyle: "short" })} accent={accent} text={text} muted={muted} />
            <Summary icon={<CreditCard size={18} />} label="Deposit due today" value={`€${(selected.depositCents / 100).toFixed(2)}`} accent={accent} text={text} muted={muted} />
            {appliedDiscount && (
              <Summary
                icon={<Tag size={18} />}
                label={`Discount ${appliedDiscount.code}`}
                value={`€${(appliedDiscount.discountAmountCents / 100).toFixed(2)} off service · balance price €${(appliedDiscount.discountedServicePriceCents / 100).toFixed(2)}`}
                accent={accent}
                text={text}
                muted={muted}
              />
            )}
          </div>
          <div style={{ marginTop: 16, padding: 16, border: `1px solid ${border}`, borderRadius: Math.max(10, radius / 2) }}>
            <label style={{ display: "block", fontWeight: 850, color: text, marginBottom: 8 }}>Discount code</label>
            <div style={{ display: "flex", gap: 8 }}>
              <input
                value={form.discountCode}
                onChange={(event) => {
                  setForm({ ...form, discountCode: event.target.value.toUpperCase() });
                  setAppliedDiscount(null);
                }}
                placeholder="WELCOME10"
                style={{ flex: 1, minWidth: 0, padding: "12px 14px", border: `1px solid ${border}`, borderRadius: Math.max(8, radius / 2), background: surface, color: text }}
              />
              <button type="button" onClick={applyDiscount} disabled={discountPending || !form.discountCode.trim()} style={{ border: 0, borderRadius: Math.max(8, radius / 2), padding: "0 16px", background: accent, color: accentText, fontWeight: 900 }}>
                {discountPending ? "Checking…" : "Apply"}
              </button>
            </div>
            {discountError && <p style={{ color: "#dc2626", marginBottom: 0 }}>{discountError}</p>}
            {appliedDiscount?.description && <p style={{ color: muted, marginBottom: 0 }}>{appliedDiscount.description}</p>}
            <small style={{ color: muted }}>The service discount is recorded against your booking. Any required deposit is still paid today.</small>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 9, color: muted, marginTop: 16 }}>
            <ShieldCheck size={18} color={accent} />
            <span>Secure payment powered by Stripe. Your card details are never stored by SureBook.</span>
          </div>
          {error && <p style={{ color: "#dc2626", fontWeight: 750 }}>{error}</p>}
        </div>
      )}

      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, marginTop: 26 }}>
        {step > 1 ? (
          <button type="button" onClick={() => setStep(step - 1)} style={{ padding: "13px 18px", borderRadius: Math.max(10, radius / 2), border: `1px solid ${border}`, background: "transparent", color: text, fontWeight: 850, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 7 }}>
            <ChevronLeft size={18} /> Back
          </button>
        ) : (
          <span />
        )}
        {step < 4 ? (
          <button type="button" disabled={!canContinue} onClick={() => canContinue && setStep(step + 1)} style={{ padding: "13px 20px", borderRadius: Math.max(10, radius / 2), border: 0, background: accent, color: accentText, fontWeight: 900, cursor: canContinue ? "pointer" : "not-allowed", opacity: canContinue ? 1 : 0.45, display: "inline-flex", alignItems: "center", gap: 7 }}>
            Continue <ChevronRight size={18} />
          </button>
        ) : (
          <button type="button" disabled={pending} onClick={submit} style={{ padding: "14px 22px", borderRadius: Math.max(10, radius / 2), border: 0, background: accent, color: accentText, fontWeight: 950, cursor: pending ? "wait" : "pointer" }}>
            {pending ? "Securing appointment…" : "Continue to secure payment"}
          </button>
        )}
      </div>
    </div>
  );
}

function Field({ label, value, onChange, type = "text", text, border, surface, radius }: { label: string; value: string; onChange: (value: string) => void; type?: string; text: string; border: string; surface: string; radius: number }) {
  return (
    <label style={{ display: "grid", gap: 8 }}>
      <span style={{ fontWeight: 850, color: text }}>{label}</span>
      <input type={type} value={value} onChange={(event) => onChange(event.target.value)} required style={{ width: "100%", boxSizing: "border-box", padding: "14px 15px", border: `1px solid ${border}`, borderRadius: Math.max(10, radius / 2), background: surface, color: text, fontSize: 16 }} />
    </label>
  );
}

function Summary({ icon, label, value, accent, text, muted }: { icon: React.ReactNode; label: string; value: string; accent: string; text: string; muted: string }) {
  return (
    <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
      <span style={{ color: accent }}>{icon}</span>
      <div>
        <small style={{ display: "block", color: muted }}>{label}</small>
        <strong style={{ color: text }}>{value}</strong>
      </div>
    </div>
  );
}

function PaymentStep({ bookingId, accent, accentText, surface, text, muted, border, radius }: { bookingId: string; accent: string; accentText: string; surface: string; text: string; muted: string; border: string; radius: number }) {
  const stripe = useStripe();
  const elements = useElements();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function pay(event: React.FormEvent) {
    event.preventDefault();
    if (!stripe || !elements) return;
    setLoading(true);
    setError("");

    const result = await stripe.confirmPayment({
      elements,
      confirmParams: {
        return_url: `${window.location.origin}${window.location.pathname}?confirmed=1&booking=${bookingId}`,
      },
    });

    if (result.error) {
      setError(result.error.message || "Payment failed");
      setLoading(false);
    }
  }

  return (
    <form onSubmit={pay} style={{ padding: 24, display: "grid", gap: 18, border: `1px solid ${border}`, borderRadius: radius, background: surface, color: text }}>
      <div>
        <h3 style={{ fontSize: 27, marginBottom: 6 }}>Secure your appointment</h3>
        <p style={{ color: muted, marginTop: 0 }}>Complete the payment step to confirm your booking.</p>
      </div>
      <PaymentElement />
      {error && <p style={{ color: "#dc2626" }}>{error}</p>}
      <button style={{ padding: 14, borderRadius: Math.max(10, radius / 2), border: 0, background: accent, color: accentText, fontWeight: 950 }} disabled={!stripe || loading}>
        {loading ? "Processing…" : "Pay deposit and confirm"}
      </button>
    </form>
  );
}
