# SureBook Assistant and Marketing Setup

## 1. Install dependencies

```bash
npm install
```

This installs `pdf-lib` and refreshes `package-lock.json`.

## 2. Configure SureBook Assistant

Add these values to `.env.local` and the matching Vercel environments:

```env
OPENAI_API_KEY=
OPENAI_MODEL=gpt-5-mini
```

`OPENAI_API_KEY` is server-only. Never prefix it with `NEXT_PUBLIC_`.

## 3. Apply the database schema

```bash
npx drizzle-kit push
```

This creates the AI history, discount, referral, voucher, membership, package and redemption tables.

## 4. Update Stripe webhook events

The SureBook webhook endpoint is:

```text
https://YOUR_DOMAIN/api/stripe/webhook
```

Keep the existing events and add:

```text
checkout.session.completed
customer.subscription.deleted
invoice.paid
```

Use the endpoint signing secret as `STRIPE_WEBHOOK_SECRET`.

## 5. Validate locally

```bash
rm -rf .next
rm -f tsconfig.tsbuildinfo
npm run typecheck
npm run build
npm run dev -- --webpack -p 3001
```

Test these routes:

```text
/dashboard/assistant
/dashboard/marketing
/dashboard/marketing/referrals
/offers/YOUR_SLUG
```

## 6. Stripe test checklist

1. Connect a test-mode Stripe account for the business.
2. Create one membership and one package.
3. Open the public offers page.
4. Complete each checkout with Stripe's standard test card.
5. Confirm the webhook activates the purchase record.
6. Create a gift voucher, download its PDF and scan its QR code.
7. Create a referral campaign and issue a customer referral link.
8. Open the referral link in a private browser and complete a deposit payment.
9. Confirm the referral changes to `converted`.
10. Create a discount code and apply it during a booking.

## Current boundaries

- AI output is saved as a draft. It does not automatically publish content or modify pricing.
- Referral conversions are tracked, but reward settlement is currently managed by the business rather than an automatic customer wallet.
- Membership and package entitlements are stored as balances. Staff redemption workflows should be tested before production launch.
- Gift voucher purchases, package purchases and memberships require a fully connected Stripe account.
