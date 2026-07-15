"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/db";
import { bookings, reviews } from "@/db/schema";

export async function submitReviewAction(formData: FormData) {
  const input = z.object({
    bookingId: z.string().uuid(),
    rating: z.coerce.number().int().min(1).max(5),
    comment: z.string().trim().max(2000).optional(),
  }).parse(Object.fromEntries(formData));

  const booking = await db.query.bookings.findFirst({
    where: eq(bookings.id, input.bookingId),
    with: { salon: true, review: true },
  });

  if (!booking || booking.status !== "completed") throw new Error("Only completed appointments can be reviewed.");
  if (booking.review) redirect(`/review/${booking.id}?submitted=1`);

  await db.insert(reviews).values({
    salonId: booking.salonId,
    bookingId: booking.id,
    customerId: booking.customerId,
    rating: input.rating,
    comment: input.comment || null,
    approved: true,
  });

  revalidatePath(`/book/${booking.salon.slug}`);
  revalidatePath("/discover");
  redirect(`/review/${booking.id}?submitted=1`);
}
