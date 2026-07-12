import type { Metadata } from "next";
import { Toaster } from "sonner";
import "./globals.css";

export const metadata: Metadata = { title: "SureBook | Protect every appointment", description: "Bookings, deposits and no-show protection for Irish salons." };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) { return <html lang="en"><body>{children}<Toaster richColors /></body></html>; }
