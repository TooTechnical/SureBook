# SureBook — OpenAI Build Week 2026

SureBook is an AI growth and operations platform for appointment-based businesses. It combines customer discovery, full-screen storefronts, secure booking and deposits, staff scheduling, CRM, no-show protection, analytics, marketing commerce and a GPT-5.6 Growth Operator in one coherent product.

**Build Week track:** Work & Productivity  
**Submission branch:** `feature/openai-build-week-final-2026`

## The problem

Small appointment businesses lose time and revenue because their operations are fragmented across social DMs, notebooks, spreadsheets, payment links, calendars and generic marketing tools. Owners often cannot answer basic questions quickly:

- Which services are driving completed bookings?
- Where are no-shows or cancellations hurting revenue?
- What should the business promote next?
- Which campaign is safe to send to consented customers?
- How can a customer discover, trust and book the business without friction?

SureBook creates one operating layer for that entire journey.

## Build Week product story

### Customer journey

1. Search local businesses by service, location, price, rating and availability.
2. Compare businesses in list or map view.
3. Open a full-screen storefront with services, staff, reviews, gallery, opening hours and directions.
4. Choose a service, professional, date and time.
5. Pay any required deposit securely through Stripe Connect.

### Business journey

1. Manage services, staff, customers, availability and storefront content.
2. Track revenue, bookings, completed appointments, no-shows, protected deposits and repeat customers.
3. Launch discounts, referrals, gift vouchers, memberships and packages.
4. Ask the SureBook Growth Operator to diagnose booking performance or create a campaign.
5. GPT-5.6 analyses verified business context and returns a measurable, owner-approved action plan.

## GPT-5.6 implementation

SureBook uses the OpenAI Responses API with the `gpt-5.6` alias and high reasoning effort.

The Growth Operator receives only verified, business-level context:

- storefront information
- active services, durations, prices and deposits
- approved review statistics
- aggregate customer statistics
- completed, cancelled and no-show booking counts
- popular services over the previous 30 days

It does **not** send customer identities to the model. The system prompt prohibits fabricated reviews, qualifications, availability, prices, consent, medical claims or financial results. Outputs distinguish verified observations from assumptions and require owner approval before publishing.

Supported decision workflows:

- growth and booking diagnosis
- campaign creation
- Instagram campaign generation
- storefront SEO audit
- retention and loyalty planning
- custom operational advice

Every generation stores the model, context version and reasoning effort for traceability.

## How Codex was used

Codex acted as the primary engineering collaborator during Build Week. It was used to:

- inspect the existing architecture and identify production risks
- design and implement the AI marketing and commerce layer
- build the discovery marketplace and geospatial filtering
- create the full-screen unified storefront
- design the business analytics experience
- diagnose TypeScript, Stripe and Drizzle integration failures
- consolidate feature branches into the final submission branch
- harden prompts, privacy boundaries and model traceability
- prepare submission documentation and judge testing instructions

Human product decisions remained explicit. The entrant selected the problem, target audience, commercial model, booking/deposit policy, feature priorities, visual direction and final scope. Codex accelerated implementation, debugging and integration rather than replacing product ownership.

## What existed before Build Week

Before the submission period, SureBook already had a core booking foundation:

- business signup and login
- public booking page
- services and staff
- appointment scheduling
- Stripe Connect deposits
- reminder emails
- customer records
- no-show outcome tracking

## Meaningful Build Week extensions

The work added during the submission period includes:

- GPT-5.6 Growth Operator using verified business context
- AI generation history and traceability
- discounts and redemption tracking
- referral campaigns and conversion tracking
- gift vouchers and balances
- memberships and service packages
- marketplace discovery and local filters
- PostGIS radius queries and map clustering
- business marketplace settings
- expanded business analytics
- full-screen unified customer storefront
- stronger SEO and structured business metadata
- CI and deployment hardening
- versioned SureBook Growth Score with transparent category scoring
- period-based business KPI dashboard and in-app weekly reports
- owner-controlled lifecycle automation foundation
- installable mobile PWA and offline fallback
- separately authenticated internal operations console

## Epic 7 analytics

The business dashboard supports shareable 7-day, 30-day, 90-day and current-year views. KPI definitions are implemented in server-side modules and use real booking, payment, review and customer records. Revenue currently means deposits on records whose payment status is `paid`; the schema does not yet expose a separate successful-payment timestamp, so period attribution uses the booking creation timestamp. Deposits saved includes only paid deposits associated with bookings explicitly marked `no_show`. Repeat customers have more than one completed booking.

Charts use accessible labelled HTML rather than a decorative chart dependency. Empty or low-sample data stays visible as unavailable or receives a documented neutral safeguard.

Weekly reports are always available in-app. Owner email delivery is opt-in and disabled by default.

## Automation workflows

Businesses can configure booking confirmations, appointment reminders, post-appointment thank-you messages, review requests, rebooking reminders and missed-appointment follow-ups. Definitions include trigger, delay, channel, template, owner-approval requirement and retry limit. Executions have a unique idempotency key, scheduled state, attempt count, safe failure message and delivery status.

Email delivery reuses Resend. Marketing rebooking reminders require stored marketing consent. SMS is deliberately behind a provider interface and reports **SMS provider not configured**; no SMS is presented as live. Cron processing is protected by `CRON_SECRET` and runs every 15 minutes on Vercel.

## Mobile and PWA support

SureBook includes an installable web manifest, a branded scalable icon, service-worker registration, safe-area-aware dashboard navigation and a basic offline fallback. Live business and customer records are never cached for offline use. File inputs continue to support normal mobile camera/gallery selection. Native iOS/Android development and push notifications remain roadmap items.

## Internal admin console

`/internal` uses a separate signed cookie, a separate internal-user table and explicit `super_admin`, `support`, `finance`, `operations` and `read_only_analyst` roles. Ordinary business-owner sessions cannot authenticate into it. The core console shows platform businesses, booking/payment outcomes, Stripe connection state, reviews, support tickets, safe application errors, AI generations and automation sends. Sensitive future write actions must check role permissions on the server and append to `admin_audit_logs`.

Internal users must be provisioned through a secure operator-controlled database workflow with a bcrypt password hash. No bootstrap password or test credential is committed.

## SureBook Growth Score methodology

`growth-score-v1` combines deterministic category scores: SEO 20%, Photos 15%, Reviews 20%, Bookings 25% and Marketing 20%. Inputs are measurable SureBook fields only. Booking-rate conclusions use a neutral baseline until at least ten bookings are available, and new businesses are not given a zero review score before having a reasonable opportunity to earn reviews. Each calculation reports positive and negative factors, an explicit data window and deterministic linked recommendations. Daily/history-changing snapshots are stored in `growth_score_snapshots`.

The score is advisory. It is not scientifically validated and does not guarantee improved revenue.

## Privacy and owner-approval boundaries

- GPT-5.6 receives aggregate verified business context, not customer identities.
- AI may improve drafts but cannot configure or send an automation by itself.
- Automation remains disabled until a business owner enables it.
- Transactional and marketing consent are treated separately.
- SMS is skipped when no provider or customer SMS consent exists.
- Internal analytics use customer-safe identifiers and never expose card details, credentials or full payment payloads.

## Build Week limitations and roadmap

- Revenue period attribution needs a first-class successful-payment timestamp for full accounting precision.
- Automated weekly-report email rendering is not yet connected to a weekly sender.
- Advanced admin mutations, suspension, disputes, refunds, blob orphan scanning and webhook-health telemetry remain deferred.
- SMS provider integration, unsubscribe-token endpoints and a dead-letter operations UI remain deferred.
- Native mobile apps and push notifications are future work; the current target is the responsive PWA.
- Production rollout still requires migration review, internal-user provisioning, legal review, monitoring and an end-to-end security assessment.

## Codex development session

Codex was used in this primary development thread for:

- repository inspection
- branch planning
- architecture
- implementation
- debugging
- testing
- security review
- documentation
- pull-request preparation

The `/feedback` Session ID is intentionally not included in this public README.

The dated commit and pull-request history provides evidence of this work.

## Product capabilities

- Secure business authentication
- Multi-staff scheduling and overlap protection
- Services, categories, durations, prices and deposits
- Customer CRM and consent tracking
- Stripe Connect Standard payouts
- Webhook-driven booking confirmation
- Automated reminders and stale-payment cleanup
- Attendance, no-show and audit records
- Business analytics dashboard
- Discovery marketplace and map view
- Full-screen public storefront
- Reviews, galleries, team profiles and opening hours
- Discounts, referrals, vouchers, memberships and packages
- GPT-5.6 Growth Operator

## Architecture

- Next.js 16 App Router
- React 19
- TypeScript
- PostgreSQL / Neon
- Drizzle ORM
- PostGIS
- OpenAI Responses API
- Stripe and Stripe Connect
- Resend
- Vercel and Vercel Cron
- Mapbox GL
- Zod validation
- Signed HTTP-only session cookies

## Local setup

```bash
npm install
cp .env.example .env.local
npx drizzle-kit push
npm run dev
```

Open `http://localhost:3000`.

## Required environment variables

```env
DATABASE_URL=
SESSION_SECRET=
NEXT_PUBLIC_APP_URL=http://localhost:3000
OPENAI_API_KEY=
OPENAI_MODEL=gpt-5.6
STRIPE_SECRET_KEY=
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=
STRIPE_WEBHOOK_SECRET=
RESEND_API_KEY=
EMAIL_FROM=SureBook <onboarding@resend.dev>
CRON_SECRET=
PLATFORM_FEE_PERCENT=5
DEFAULT_DEPOSIT_CENTS=1000
NEXT_PUBLIC_MAPBOX_TOKEN=
BLOB_READ_WRITE_TOKEN=
```

Generate a session secret:

```bash
openssl rand -base64 48
```

## Database setup

Apply Drizzle-managed schemas:

```bash
npx drizzle-kit push
```

Apply the geospatial marketplace migration when PostGIS is available:

```bash
npm run db:geo
```

## Stripe test setup

Register:

```text
https://YOUR_DOMAIN/api/stripe/webhook
```

Required events include:

- `payment_intent.succeeded`
- `payment_intent.payment_failed`
- `charge.dispute.created`
- `account.updated`
- `checkout.session.completed`
- `customer.subscription.deleted`
- `invoice.paid`

Test card:

```text
4242 4242 4242 4242
```

Use any future expiry date, any three-digit CVC and a valid postcode.

## Judge testing path

The deployed test account and exact credentials must be placed in the private Devpost testing instructions, not committed publicly.

Recommended test flow:

1. Open `/discover` and inspect marketplace search and filters.
2. Open a business through `/s/[slug]`.
3. Review services, team, gallery, reviews and location.
4. Start the booking flow.
5. Log in to the supplied business test account.
6. Open `/dashboard` to inspect operational analytics.
7. Open `/dashboard/assistant`.
8. Run **Growth diagnosis** using the prefilled prompt.
9. Verify the response identifies observations, assumptions and measurable next actions.
10. Open `/dashboard/marketing` and `/dashboard/marketing/referrals`.

## Validation

Run before every release:

```bash
rm -rf .next
npm run typecheck
npm run lint
npm run build
```

Then test the deployed production-like preview in an incognito browser.

## Demo video structure

The submission video must remain under three minutes:

- 0:00–0:20 — problem and product promise
- 0:20–0:55 — discovery and storefront
- 0:55–1:25 — booking and deposit protection
- 1:25–2:15 — dashboard and GPT-5.6 Growth Operator
- 2:15–2:40 — marketing commerce and impact
- 2:40–2:55 — Codex collaboration and closing statement

## Security and privacy

- Passwords are hashed with bcrypt.
- Sessions use signed HTTP-only cookies.
- Server actions validate input with Zod.
- Stripe webhooks validate signatures.
- Cron routes require bearer authentication.
- Connected-account status is verified through Stripe.
- Marketing consent is stored independently.
- Customer identities are excluded from GPT-5.6 context.
- AI outputs are owner-reviewed before use.
- Payment and attendance outcomes are auditable.

## Production note

Before accepting live client payments, SureBook still requires final legal wording, privacy and processor terms, refund/dispute procedures, monitoring, accessibility review and a formal production security assessment. The Build Week deployment is intended as a functioning evaluation environment and commercial-quality product demonstration.
