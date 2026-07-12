import { boolean, integer, jsonb, pgEnum, pgTable, text, timestamp, uniqueIndex, uuid, varchar } from "drizzle-orm/pg-core";

export const bookingStatus = pgEnum("booking_status", ["pending_payment", "confirmed", "cancelled", "completed", "no_show"]);
export const paymentStatus = pgEnum("payment_status", ["not_required", "pending", "paid", "refunded", "partially_refunded", "failed", "disputed"]);
export const staffRole = pgEnum("staff_role", ["owner", "manager", "staff"]);

export const salons = pgTable("salons", {
  id: uuid("id").defaultRandom().primaryKey(),
  slug: varchar("slug", { length: 120 }).notNull().unique(),
  name: varchar("name", { length: 160 }).notNull(),
  email: varchar("email", { length: 255 }).notNull().unique(),
  phone: varchar("phone", { length: 40 }),
  address: text("address"),
  county: varchar("county", { length: 80 }),
  timezone: varchar("timezone", { length: 80 }).notNull().default("Europe/Dublin"),
  passwordHash: text("password_hash").notNull(),
  stripeAccountId: text("stripe_account_id"),
  stripeChargesEnabled: boolean("stripe_charges_enabled").notNull().default(false),
  stripePayoutsEnabled: boolean("stripe_payouts_enabled").notNull().default(false),
  cancellationWindowHours: integer("cancellation_window_hours").notNull().default(24),
  defaultDepositCents: integer("default_deposit_cents").notNull().default(1000),
  reminderHours: jsonb("reminder_hours").$type<number[]>().notNull().default([24, 2]),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const staff = pgTable("staff", {
  id: uuid("id").defaultRandom().primaryKey(),
  salonId: uuid("salon_id").references(() => salons.id, { onDelete: "cascade" }).notNull(),
  name: varchar("name", { length: 160 }).notNull(),
  email: varchar("email", { length: 255 }),
  phone: varchar("phone", { length: 40 }),
  role: staffRole("role").notNull().default("staff"),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const services = pgTable("services", {
  id: uuid("id").defaultRandom().primaryKey(),
  salonId: uuid("salon_id").references(() => salons.id, { onDelete: "cascade" }).notNull(),
  name: varchar("name", { length: 160 }).notNull(),
  description: text("description"),
  durationMinutes: integer("duration_minutes").notNull(),
  priceCents: integer("price_cents").notNull(),
  depositCents: integer("deposit_cents").notNull().default(1000),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const serviceStaff = pgTable("service_staff", {
  serviceId: uuid("service_id").references(() => services.id, { onDelete: "cascade" }).notNull(),
  staffId: uuid("staff_id").references(() => staff.id, { onDelete: "cascade" }).notNull(),
}, (table) => [uniqueIndex("service_staff_unique").on(table.serviceId, table.staffId)]);

export const businessHours = pgTable("business_hours", {
  id: uuid("id").defaultRandom().primaryKey(),
  salonId: uuid("salon_id").references(() => salons.id, { onDelete: "cascade" }).notNull(),
  dayOfWeek: integer("day_of_week").notNull(),
  openTime: varchar("open_time", { length: 5 }),
  closeTime: varchar("close_time", { length: 5 }),
  closed: boolean("closed").notNull().default(false),
}, (table) => [uniqueIndex("hours_salon_day_unique").on(table.salonId, table.dayOfWeek)]);

export const customers = pgTable("customers", {
  id: uuid("id").defaultRandom().primaryKey(),
  salonId: uuid("salon_id").references(() => salons.id, { onDelete: "cascade" }).notNull(),
  name: varchar("name", { length: 160 }).notNull(),
  email: varchar("email", { length: 255 }),
  phone: varchar("phone", { length: 40 }).notNull(),
  marketingConsent: boolean("marketing_consent").notNull().default(false),
  notes: text("notes"),
  noShowCount: integer("no_show_count").notNull().default(0),
  totalBookings: integer("total_bookings").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [uniqueIndex("customer_salon_phone_unique").on(table.salonId, table.phone)]);

export const bookings = pgTable("bookings", {
  id: uuid("id").defaultRandom().primaryKey(),
  salonId: uuid("salon_id").references(() => salons.id, { onDelete: "cascade" }).notNull(),
  customerId: uuid("customer_id").references(() => customers.id, { onDelete: "restrict" }).notNull(),
  staffId: uuid("staff_id").references(() => staff.id, { onDelete: "restrict" }).notNull(),
  serviceId: uuid("service_id").references(() => services.id, { onDelete: "restrict" }).notNull(),
  startsAt: timestamp("starts_at", { withTimezone: true }).notNull(),
  endsAt: timestamp("ends_at", { withTimezone: true }).notNull(),
  status: bookingStatus("status").notNull().default("pending_payment"),
  paymentStatus: paymentStatus("payment_status").notNull().default("pending"),
  depositCents: integer("deposit_cents").notNull(),
  stripePaymentIntentId: text("stripe_payment_intent_id"),
  stripeChargeId: text("stripe_charge_id"),
  cancellationReason: text("cancellation_reason"),
  internalNotes: text("internal_notes"),
  reminder24hSentAt: timestamp("reminder_24h_sent_at", { withTimezone: true }),
  reminder2hSentAt: timestamp("reminder_2h_sent_at", { withTimezone: true }),
  outcomeRecordedAt: timestamp("outcome_recorded_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const auditLog = pgTable("audit_log", {
  id: uuid("id").defaultRandom().primaryKey(),
  salonId: uuid("salon_id").references(() => salons.id, { onDelete: "cascade" }).notNull(),
  actorId: uuid("actor_id"),
  action: varchar("action", { length: 120 }).notNull(),
  entityType: varchar("entity_type", { length: 80 }).notNull(),
  entityId: uuid("entity_id"),
  metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default({}),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

import { relations } from "drizzle-orm";

export const salonsRelations = relations(salons, ({ many }) => ({
  staff: many(staff), services: many(services), customers: many(customers), bookings: many(bookings),
}));
export const staffRelations = relations(staff, ({ one, many }) => ({ salon: one(salons, { fields: [staff.salonId], references: [salons.id] }), bookings: many(bookings) }));
export const servicesRelations = relations(services, ({ one, many }) => ({ salon: one(salons, { fields: [services.salonId], references: [salons.id] }), bookings: many(bookings) }));
export const customersRelations = relations(customers, ({ one, many }) => ({ salon: one(salons, { fields: [customers.salonId], references: [salons.id] }), bookings: many(bookings) }));
export const bookingsRelations = relations(bookings, ({ one }) => ({
  salon: one(salons, { fields: [bookings.salonId], references: [salons.id] }),
  customer: one(customers, { fields: [bookings.customerId], references: [customers.id] }),
  staff: one(staff, { fields: [bookings.staffId], references: [staff.id] }),
  service: one(services, { fields: [bookings.serviceId], references: [services.id] }),
}));
