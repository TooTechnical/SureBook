"use client";

import { useMemo, useState, useTransition } from "react";
import { moveBookingAction } from "@/actions/calendar";

type CalendarEvent = { id: string; title: string; customer: string; staff: string; startsAt: string; endsAt: string; status: string };
type CalendarBlock = { id: string; title: string; startsAt: string; endsAt: string; blockType: string };

const hours = Array.from({ length: 24 }, (_, index) => index);
const pad = (value: number) => String(value).padStart(2, "0");

export function CalendarBoard({ weekStart, events, blocks }: { weekStart: string; events: CalendarEvent[]; blocks: CalendarBlock[] }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const days = useMemo(() => Array.from({ length: 7 }, (_, index) => { const date = new Date(weekStart); date.setUTCDate(date.getUTCDate() + index); return date; }), [weekStart]);

  function dropBooking(event: React.DragEvent, day: Date, hour: number, minute: number) {
    event.preventDefault();
    const bookingId = event.dataTransfer.getData("bookingId");
    if (!bookingId) return;
    const startsAt = new Date(day);
    startsAt.setUTCHours(hour, minute, 0, 0);
    setError(null);
    startTransition(async () => {
      try {
        await moveBookingAction({ bookingId, startsAt: startsAt.toISOString() });
        window.location.reload();
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : "Could not move the appointment.");
      }
    });
  }

  return <section className="card" style={{ overflow: "auto", position: "relative" }}>
    {pending && <div style={{ padding: 10, background: "#eff6ff" }}>Moving appointment…</div>}
    {error && <div style={{ padding: 10, background: "#fee2e2", color: "#991b1b" }}>{error}</div>}
    <div style={{ minWidth: 1050, display: "grid", gridTemplateColumns: "76px repeat(7,minmax(135px,1fr))" }}>
      <div style={{ position: "sticky", left: 0, zIndex: 3, background: "white", borderBottom: "1px solid var(--line)" }} />
      {days.map((day) => <div key={day.toISOString()} style={{ padding: 12, textAlign: "center", fontWeight: 800, borderBottom: "1px solid var(--line)", borderLeft: "1px solid var(--line)" }}>{day.toLocaleDateString("en-IE", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" })}</div>)}
      {hours.flatMap((hour) => [0, 30].map((minute) => <CalendarRow key={`${hour}-${minute}`} hour={hour} minute={minute} days={days} events={events} blocks={blocks} onDrop={dropBooking} />))}
    </div>
  </section>;
}

function CalendarRow({ hour, minute, days, events, blocks, onDrop }: { hour: number; minute: number; days: Date[]; events: CalendarEvent[]; blocks: CalendarBlock[]; onDrop: (event: React.DragEvent, day: Date, hour: number, minute: number) => void }) {
  return <>
    <div style={{ height: 42, padding: "6px 8px", fontSize: 12, color: "var(--muted)", position: "sticky", left: 0, zIndex: 2, background: "white", borderBottom: "1px solid var(--line)" }}>{pad(hour)}:{pad(minute)}</div>
    {days.map((day) => {
      const cellStart = new Date(day); cellStart.setUTCHours(hour, minute, 0, 0);
      const cellEnd = new Date(cellStart.getTime() + 30 * 60_000);
      const cellEvents = events.filter((item) => { const start = new Date(item.startsAt); return start >= cellStart && start < cellEnd; });
      const cellBlocks = blocks.filter((item) => { const start = new Date(item.startsAt); const end = new Date(item.endsAt); return start < cellEnd && end > cellStart; });
      return <div key={day.toISOString()} onDragOver={(event) => event.preventDefault()} onDrop={(event) => onDrop(event, day, hour, minute)} style={{ minHeight: 42, borderLeft: "1px solid var(--line)", borderBottom: "1px solid var(--line)", padding: 3, background: cellBlocks.length ? "#fef3c7" : undefined }}>
        {cellBlocks.map((block) => <div key={block.id} title={block.title} style={{ fontSize: 11, padding: "3px 5px", borderRadius: 6, background: "#fde68a", marginBottom: 2 }}>{block.title}</div>)}
        {cellEvents.map((item) => <article key={item.id} draggable onDragStart={(event) => event.dataTransfer.setData("bookingId", item.id)} style={{ cursor: "grab", padding: 7, borderRadius: 8, background: "#dbeafe", borderLeft: "4px solid #2563eb", fontSize: 12, lineHeight: 1.35 }}><strong>{item.title}</strong><br />{item.customer}<br /><small>{item.staff}</small></article>)}
      </div>;
    })}
  </>;
}
