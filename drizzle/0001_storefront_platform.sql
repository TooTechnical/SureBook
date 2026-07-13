ALTER TABLE "salons" ADD COLUMN IF NOT EXISTS "business_category" varchar(80) DEFAULT 'Beauty & wellness' NOT NULL;
ALTER TABLE "salons" ADD COLUMN IF NOT EXISTS "tagline" varchar(180);
ALTER TABLE "salons" ADD COLUMN IF NOT EXISTS "description" text;
ALTER TABLE "salons" ADD COLUMN IF NOT EXISTS "logo_url" text;
ALTER TABLE "salons" ADD COLUMN IF NOT EXISTS "cover_image_url" text;
ALTER TABLE "salons" ADD COLUMN IF NOT EXISTS "accent_color" varchar(20) DEFAULT '#111827' NOT NULL;
ALTER TABLE "salons" ADD COLUMN IF NOT EXISTS "instagram_url" text;
ALTER TABLE "salons" ADD COLUMN IF NOT EXISTS "facebook_url" text;
ALTER TABLE "salons" ADD COLUMN IF NOT EXISTS "tiktok_url" text;
ALTER TABLE "salons" ADD COLUMN IF NOT EXISTS "website_url" text;
ALTER TABLE "salons" ADD COLUMN IF NOT EXISTS "seo_title" varchar(180);
ALTER TABLE "salons" ADD COLUMN IF NOT EXISTS "seo_description" varchar(320);
ALTER TABLE "salons" ADD COLUMN IF NOT EXISTS "storefront_published" boolean DEFAULT true NOT NULL;

CREATE TABLE IF NOT EXISTS "storefront_images" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "salon_id" uuid NOT NULL,
  "image_url" text NOT NULL,
  "alt_text" varchar(180),
  "sort_order" integer DEFAULT 0 NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

DO $$ BEGIN
 ALTER TABLE "storefront_images" ADD CONSTRAINT "storefront_images_salon_id_salons_id_fk" FOREIGN KEY ("salon_id") REFERENCES "public"."salons"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

CREATE INDEX IF NOT EXISTS "storefront_images_salon_idx" ON "storefront_images" USING btree ("salon_id");