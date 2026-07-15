# SureBook Storefront Release Setup

This release adds direct media uploads, team profiles, business hours, maps, service categories, themes, verified reviews, QR sharing, storefront completion tracking, and public discovery.

## 1. Install new dependencies

```bash
npm install
```

The release adds `@vercel/blob` for image uploads and `qrcode` for downloadable storefront QR codes.

## 2. Configure Vercel Blob

Create a Blob store in the Vercel project and copy the read/write token into local and deployed environment variables:

```env
BLOB_READ_WRITE_TOKEN=vercel_blob_rw_...
```

Uploads accept images up to 5 MB. Storefronts support one logo, one cover image, up to 12 gallery images, and staff profile photos.

## 3. Apply the database schema

For the current development database:

```bash
export DATABASE_URL="$(grep '^DATABASE_URL=' .env.local | cut -d '=' -f2-)"
npx drizzle-kit push
```

Review and approve the schema changes. They add:

- `eircode` and `storefront_theme` to businesses
- staff titles, biographies, and photos
- custom service categories
- service-to-category assignment
- verified customer reviews

## 4. Start locally

```bash
rm -rf .next
npm run dev -- --webpack -p 3001
```

Open:

- Business settings: `http://localhost:3001/dashboard/settings`
- Team profiles: `http://localhost:3001/dashboard/staff`
- Services and categories: `http://localhost:3001/dashboard/services`
- Public discovery: `http://localhost:3001/discover`

## Review flow

When a business marks a confirmed booking as completed, SureBook emails the customer a unique `/review/[bookingId]` link. Only completed bookings can create a review, and each booking can create only one review.

## Discovery eligibility

A storefront appears in `/discover` when it is published and its Stripe connected account can accept charges. Customers can filter by keyword, category, and county/city.
