# SureBook

SureBook is a production-oriented booking, deposit, reminder, staff, and no-show protection platform designed for salons and barbers in Ireland.

## What it solves

- Empty chairs caused by forgotten appointments and no-shows
- Manual deposit collection and awkward bank-transfer follow-up
- Double-booked staff and inconsistent service durations
- Customer details spread across notebooks, DMs, and personal phones
- No reliable record of attendance, no-shows, deposits, or disputes
- Salon owners lacking a clear view of protected revenue and daily operations

## Product capabilities

- Salon signup and secure cookie-based authentication
- Public booking page at `/book/[slug]`
- Configurable services, durations, prices, and deposits
- Multi-staff scheduling with overlap protection
- Customer records, marketing consent, visit counts, and no-show history
- Stripe Connect Standard onboarding for direct salon payouts
- Immediate deposit charging, avoiding unreliable long-lived card holds
- Stripe webhook-driven booking confirmation and payment state
- Automatic 24-hour and 2-hour email reminders
- Stale incomplete-payment cleanup through Vercel Cron
- Attendance and no-show outcome recording with an audit trail
- Europe/Dublin timezone and euro formatting
- Mobile-first salon dashboard

## Architecture

- Next.js 16 App Router and React 19
- TypeScript
- PostgreSQL (Neon compatible)
- Drizzle ORM and SQL migrations
- Stripe and Stripe Connect Standard
- Resend email
- Vercel Cron
- Zod input validation
- Encrypted, HTTP-only JWT session cookie

## Local setup

```bash
npm install
cp .env.example .env.local
npm run db:migrate
npm run dev
```

Open `http://localhost:3000`.

## Environment variables

```env
DATABASE_URL=
SESSION_SECRET=
NEXT_PUBLIC_APP_URL=http://localhost:3000
STRIPE_SECRET_KEY=
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=
STRIPE_WEBHOOK_SECRET=
RESEND_API_KEY=
EMAIL_FROM=SureBook <onboarding@resend.dev>
CRON_SECRET=
PLATFORM_FEE_PERCENT=5
DEFAULT_DEPOSIT_CENTS=1000
WA_PHONE_ID=
WA_TOKEN=
```

Generate a session secret:

```bash
openssl rand -base64 48
```

## Database

Generate a migration after changing the schema:

```bash
npm run db:generate
```

Apply migrations:

```bash
npm run db:migrate
```

## Stripe setup

1. Create or use a Stripe platform account.
2. Enable Stripe Connect.
3. Add the secret and publishable keys.
4. Register this webhook endpoint:

```text
https://YOUR_DOMAIN/api/stripe/webhook
```

Subscribe to:

- `payment_intent.succeeded`
- `payment_intent.payment_failed`
- `charge.dispute.created`
- `account.updated`

For local webhook testing:

```bash
stripe listen --forward-to localhost:3000/api/stripe/webhook
```

Use Stripe's standard test card:

```text
4242 4242 4242 4242
```

Use any future expiry date, any three-digit CVC, and a valid postcode.

## Vercel deployment

1. Import the repository into Vercel.
2. Add every required environment variable.
3. Provision Neon Postgres and apply the migration.
4. Set `NEXT_PUBLIC_APP_URL` to the production URL.
5. Register the production Stripe webhook.
6. Ensure `CRON_SECRET` is configured in Vercel.

The included `vercel.json` runs reminders hourly and removes abandoned payment attempts hourly.

## Validation

```bash
npm run typecheck
npm run lint
npm run build
```

All three checks pass for this branch.

## Payment policy design

SureBook charges the deposit immediately and records it against the appointment. This is deliberate: ordinary online card authorisations generally cannot be held safely for appointments booked weeks in advance. The salon can credit the deposit against the final service price, retain it for an eligible no-show, or later process a policy-compliant refund.

## Security and compliance notes

- Passwords are hashed with bcrypt.
- Sessions use signed, HTTP-only, secure cookies in production.
- Server actions validate input with Zod.
- Stripe webhooks validate signatures.
- Cron routes require bearer-token authentication.
- Connected-account status comes from Stripe, not redirect URLs.
- Marketing consent is stored separately from booking consent.
- Payment and attendance outcomes are recorded in an audit log.

Before taking live payments, add the salon's legal cancellation wording, privacy policy, processor terms, support process, and refund/dispute procedures.
