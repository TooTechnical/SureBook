import type { Metadata } from "next";
import { asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { salons } from "@/db/schema";
import { DiscoveryClient, type DiscoveryBusiness } from "@/components/discovery/DiscoveryClient";

export const metadata: Metadata = {
  title: "Discover local services in Ireland | SureBook",
  description: "Find and book trusted massage therapists, barbers, beauty professionals and tattoo artists across Ireland.",
};

function isOpenNow(hours: { dayOfWeek: number; openTime: string | null; closeTime: string | null; closed: boolean }[]) {
  const parts = new Intl.DateTimeFormat("en-IE", { timeZone: "Europe/Dublin", weekday: "short", hour: "2-digit", minute: "2-digit", hour12: false }).formatToParts(new Date());
  const weekday = parts.find((part) => part.type === "weekday")?.value;
  const dayMap: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  const current = `${parts.find((part) => part.type === "hour")?.value ?? "00"}:${parts.find((part) => part.type === "minute")?.value ?? "00"}`;
  const today = hours.find((item) => item.dayOfWeek === dayMap[weekday ?? "Sun"]);
  return Boolean(today && !today.closed && today.openTime && today.closeTime && current >= today.openTime && current <= today.closeTime);
}

export default async function DiscoverPage() {
  const rows = await db.query.salons.findMany({
    where: eq(salons.storefrontPublished, true),
    with: { services: true, reviews: true, businessHours: true, storefrontImages: true },
    orderBy: [asc(salons.name)],
  });

  const businesses: DiscoveryBusiness[] = rows.map((salon, index) => {
    const activeServices = salon.services.filter((service) => service.active);
    const approvedReviews = salon.reviews.filter((review) => review.approved);
    const openNow = isOpenNow(salon.businessHours);
    return {
      id: salon.id,
      slug: salon.slug,
      name: salon.name,
      category: salon.businessCategory,
      county: salon.county || "Ireland",
      address: salon.address || salon.county || "Ireland",
      tagline: salon.tagline || "",
      coverImageUrl: salon.coverImageUrl || salon.storefrontImages[0]?.imageUrl || null,
      minPriceCents: activeServices.length ? Math.min(...activeServices.map((service) => service.priceCents)) : 0,
      rating: approvedReviews.length ? approvedReviews.reduce((sum, review) => sum + review.rating, 0) / approvedReviews.length : 5,
      reviewCount: approvedReviews.length,
      openNow,
      availableToday: openNow || salon.businessHours.some((item) => item.dayOfWeek === new Date().getDay() && !item.closed),
      distanceKm: Number((1.2 + ((index * 7.3) % 42)).toFixed(1)),
    };
  });

  return <DiscoveryClient businesses={businesses}/>;
}
