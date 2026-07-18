import { relations } from "drizzle-orm";
import { integer, pgTable, timestamp, uuid, varchar } from "drizzle-orm/pg-core";
import { bookings } from "./schema";
import { discountCodes } from "./marketing-schema";

export const bookingDiscounts = pgTable("booking_discounts", {
  id: uuid("id").defaultRandom().primaryKey(),
  bookingId: uuid("booking_id").references(() => bookings.id, { onDelete: "cascade" }).notNull().unique(),
  discountCodeId: uuid("discount_code_id").references(() => discountCodes.id, { onDelete: "restrict" }).notNull(),
  code: varchar("code", { length: 40 }).notNull(),
  discountAmountCents: integer("discount_amount_cents").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const bookingDiscountsRelations = relations(bookingDiscounts, ({ one }) => ({
  booking: one(bookings, { fields: [bookingDiscounts.bookingId], references: [bookings.id] }),
  discountCode: one(discountCodes, { fields: [bookingDiscounts.discountCodeId], references: [discountCodes.id] }),
}));
