import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "SureBook Business",
    short_name: "SureBook",
    description: "Run bookings, customers, growth and daily operations from any device.",
    start_url: "/dashboard",
    display: "standalone",
    background_color: "#f7f8f6",
    theme_color: "#1f6b4f",
    orientation: "any",
    icons: [{ src: "/surebook-icon.svg", sizes: "any", type: "image/svg+xml", purpose: "maskable" }],
  };
}
