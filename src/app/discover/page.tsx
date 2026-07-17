import type { Metadata } from "next";
import { DiscoveryClient } from "@/components/discovery/DiscoveryClient";
import { searchMarketplace } from "@/lib/discovery";

export const metadata: Metadata = {
  title: "Discover local services in Ireland | SureBook",
  description: "Find nearby massage therapists, barbers, beauty professionals and tattoo artists on the SureBook marketplace.",
};

export default async function DiscoverPage() {
  const businesses = await searchMarketplace();
  return <DiscoveryClient initialBusinesses={businesses} mapboxToken={process.env.NEXT_PUBLIC_MAPBOX_TOKEN || ""} />;
}
