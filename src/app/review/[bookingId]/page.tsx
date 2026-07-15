import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { submitReviewAction } from "@/actions/reviews";
import { db } from "@/db";
import { bookings } from "@/db/schema";

export default async function ReviewPage({ params, searchParams }: { params: Promise<{ bookingId: string }>; searchParams: Promise<{ submitted?: string }> }) {
  const { bookingId } = await params;
  const query = await searchParams;
  const booking = await db.query.bookings.findFirst({
    where: eq(bookings.id, bookingId),
    with: { salon: true, customer: true, service: true, review: true },
  });
  if (!booking) notFound();

  const submitted = query.submitted === "1" || Boolean(booking.review);
  return (
    <main className="container" style={{ maxWidth: 720, padding: "64px 0" }}>
      <section className="card" style={{ padding: 32 }}>
        {submitted ? (
          <><span className="badge">Review received</span><h1>Thank you for supporting {booking.salon.name}</h1><p>Your verified review helps other customers book with confidence.</p></>
        ) : booking.status !== "completed" ? (
          <><h1>Review unavailable</h1><p>This appointment must be marked completed before it can be reviewed.</p></>
        ) : (
          <>
            <span className="badge">Verified appointment</span>
            <h1>How was your visit to {booking.salon.name}?</h1>
            <p>{booking.service.name} for {booking.customer.name}</p>
            <form action={submitReviewAction} style={{ display: "grid", gap: 16 }}>
              <input type="hidden" name="bookingId" value={booking.id} />
              <label><span className="label">Rating</span><select className="input" name="rating" defaultValue="5"><option value="5">5 — Excellent</option><option value="4">4 — Very good</option><option value="3">3 — Good</option><option value="2">2 — Fair</option><option value="1">1 — Poor</option></select></label>
              <label><span className="label">Your review</span><textarea className="input" name="comment" rows={6} placeholder="Tell others what stood out about your appointment." /></label>
              <button className="btn btn-primary">Publish verified review</button>
            </form>
          </>
        )}
      </section>
    </main>
  );
}
