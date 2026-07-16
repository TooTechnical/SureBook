import QRCode from "qrcode";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { giftVouchers } from "@/db/marketing-schema";
import { salons } from "@/db/schema";
import { requireSession } from "@/lib/session";

export async function GET(_: Request, { params }: { params: Promise<{ voucherId: string }> }) {
  const session = await requireSession();
  const { voucherId } = await params;
  const voucher = await db.query.giftVouchers.findFirst({ where: and(eq(giftVouchers.id, voucherId), eq(giftVouchers.salonId, session.salonId)) });
  if (!voucher) return new Response("Voucher not found", { status: 404 });
  const salon = await db.query.salons.findFirst({ where: eq(salons.id, session.salonId) });
  if (!salon) return new Response("Business not found", { status: 404 });

  const pdf = await PDFDocument.create();
  const page = pdf.addPage([842, 595]);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const dark = rgb(0.035, 0.047, 0.067);
  const accent = rgb(0.91, 0.25, 0.14);
  const cream = rgb(0.98, 0.96, 0.91);
  page.drawRectangle({ x: 0, y: 0, width: 842, height: 595, color: dark });
  page.drawRectangle({ x: 24, y: 24, width: 794, height: 547, borderColor: accent, borderWidth: 3, color: rgb(0.055, 0.067, 0.087) });
  page.drawText("SUREBOOK GIFT VOUCHER", { x: 58, y: 510, size: 15, font: bold, color: accent, characterSpacing: 2 });
  page.drawText(salon.name, { x: 58, y: 454, size: 34, font: bold, color: cream });
  page.drawText(`€${(voucher.amountCents / 100).toFixed(2)}`, { x: 58, y: 365, size: 66, font: bold, color: cream });
  page.drawText(`For ${voucher.recipientName || "the recipient"}`, { x: 58, y: 318, size: 20, font: bold, color: accent });
  if (voucher.message) {
    const safeMessage = voucher.message.slice(0, 180);
    page.drawText(safeMessage, { x: 58, y: 272, size: 14, font: regular, color: rgb(0.78, 0.8, 0.84), maxWidth: 480, lineHeight: 20 });
  }
  page.drawText(`Voucher code: ${voucher.code}`, { x: 58, y: 170, size: 18, font: bold, color: cream });
  page.drawText(`Balance: €${(voucher.balanceCents / 100).toFixed(2)}`, { x: 58, y: 140, size: 13, font: regular, color: rgb(0.78, 0.8, 0.84) });
  if (voucher.expiresAt) page.drawText(`Expires: ${voucher.expiresAt.toLocaleDateString("en-IE", { timeZone: "Europe/Dublin" })}`, { x: 58, y: 116, size: 13, font: regular, color: rgb(0.78, 0.8, 0.84) });
  page.drawText("Present this code to the business when redeeming. Subject to the business's published terms.", { x: 58, y: 66, size: 10, font: regular, color: rgb(0.58, 0.62, 0.68), maxWidth: 650 });

  const qrData = await QRCode.toDataURL(`${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/voucher/${voucher.code}`, { width: 420, margin: 1 });
  const qrBytes = Buffer.from(qrData.split(",")[1], "base64");
  const qr = await pdf.embedPng(qrBytes);
  page.drawImage(qr, { x: 618, y: 176, width: 150, height: 150 });
  page.drawText("Scan to verify", { x: 647, y: 152, size: 11, font: regular, color: rgb(0.78, 0.8, 0.84) });

  const bytes = await pdf.save();
  return new Response(bytes, { headers: { "Content-Type": "application/pdf", "Content-Disposition": `inline; filename="${voucher.code}.pdf"`, "Cache-Control": "private, no-store" } });
}
