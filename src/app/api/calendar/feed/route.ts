import { jwtVerify } from "jose";
import { and, asc, eq, gte } from "drizzle-orm";
import { db } from "@/db";
import { bookings } from "@/db/schema";
import { env } from "@/lib/env";

export const dynamic = "force-dynamic";

function icsDate(date: Date) {
  return date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
}

function escape(value: string) {
  return value.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\n/g, "\\n");
}

export async function GET(request: Request) {
  const token = new URL(request.url).searchParams.get("token");
  if (!token) return new Response("Missing token", { status: 401 });
  let salonId: string;
  try {
    const verified = await jwtVerify(token, new TextEncoder().encode(env.SESSION_SECRET));
    if (verified.payload.purpose !== "calendar-feed" || typeof verified.payload.salonId !== "string") throw new Error("Invalid feed token");
    salonId = verified.payload.salonId;
  } catch {
    return new Response("Invalid token", { status: 401 });
  }

  const rows = await db.query.bookings.findMany({
    where: and(eq(bookings.salonId, salonId), gte(bookings.endsAt, new Date(Date.now() - 90 * 24 * 60 * 60 * 1000))),
    with: { customer: true, service: true, staff: true, salon: true },
    orderBy: [asc(bookings.startsAt)],
    limit: 3000,
  });

  const lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//SureBook//Business Calendar//EN", "CALSCALE:GREGORIAN", "METHOD:PUBLISH", "X-WR-CALNAME:SureBook Appointments"];
  for (const row of rows) {
    lines.push(
      "BEGIN:VEVENT",
      `UID:${row.id}@surebook`,
      `DTSTAMP:${icsDate(row.updatedAt)}`,
      `DTSTART:${icsDate(row.startsAt)}`,
      `DTEND:${icsDate(row.endsAt)}`,
      `SUMMARY:${escape(`${row.service.name} — ${row.customer.name}`)}`,
      `DESCRIPTION:${escape(`Staff: ${row.staff.name}\nStatus: ${row.status}\nManaged in SureBook`)}`,
      row.salon.address ? `LOCATION:${escape(row.salon.address)}` : "",
      `STATUS:${row.status === "cancelled" ? "CANCELLED" : "CONFIRMED"}`,
      "END:VEVENT",
    );
  }
  lines.push("END:VCALENDAR");
  return new Response(lines.filter(Boolean).join("\r\n"), { headers: { "Content-Type": "text/calendar; charset=utf-8", "Content-Disposition": "inline; filename=surebook-calendar.ics", "Cache-Control": "private, max-age=300" } });
}
