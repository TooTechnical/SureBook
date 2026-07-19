import type { Metadata } from "next";
import { Toaster } from "sonner";
import { PwaRegistration } from "@/components/PwaRegistration";
import "./globals.css";

export const metadata: Metadata = { title: "SureBook | Protect every appointment", description: "Bookings, deposits and no-show protection for Irish salons.", manifest: "/manifest.webmanifest", appleWebApp: { capable: true, title: "SureBook", statusBarStyle: "default" }, icons: { icon: "/surebook-icon.svg" } };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) { return <html lang="en"><body>{children}<PwaRegistration/><Toaster richColors /></body></html>; }
