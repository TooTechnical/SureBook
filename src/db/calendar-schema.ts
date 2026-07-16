import { boolean, integer, jsonb, pgTable, text, timestamp, uniqueIndex, uuid, varchar } from "drizzle-orm/pg-core";
import { bookings, salons, services, staff } from "./schema";

export const availabilityRules = pgTable("availability_rules", {
  id: uuid("id").defaultRandom().primaryKey(),
  salonId: uuid("salon_id").references(() => salons.id, { onDelete: "cascade" }).notNull(),
  staffId: uuid("staff_id").references(() => staff.id, { onDelete: "cascade" }),
  dayOfWeek: integer("day_of_week").notNull(),
  startTime: varchar("start_time", { length: 5 }).notNull(),
  endTime: varchar("end_time", { length: 5 }).notNull(),
  ruleType: varchar("rule_type", { length: 30 }).notNull().default("working"),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [uniqueIndex("availability_rule_unique").on(table.salonId, table.staffId, table.dayOfWeek, table.startTime, table.endTime, table.ruleType)]);

export const calendarBlocks = pgTable("calendar_blocks", {
  id: uuid("id").defaultRandom().primaryKey(),
  salonId: uuid("salon_id").references(() => salons.id, { onDelete: "cascade" }).notNull(),
  staffId: uuid("staff_id").references(() => staff.id, { onDelete: "cascade" }),
  title: varchar("title", { length: 180 }).notNull(),
  blockType: varchar("block_type", { length: 30 }).notNull().default("blocked"),
  startsAt: timestamp("starts_at", { withTimezone: true }).notNull(),
  endsAt: timestamp("ends_at", { withTimezone: true }).notNull(),
  allDay: boolean("all_day").notNull().default(false),
  recurrenceRule: text("recurrence_rule"),
  recurrenceUntil: timestamp("recurrence_until", { withTimezone: true }),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const recurringAppointmentSeries = pgTable("recurring_appointment_series", {
  id: uuid("id").defaultRandom().primaryKey(),
  salonId: uuid("salon_id").references(() => salons.id, { onDelete: "cascade" }).notNull(),
  customerId: uuid("customer_id").notNull(),
  staffId: uuid("staff_id").references(() => staff.id, { onDelete: "restrict" }).notNull(),
  serviceId: uuid("service_id").references(() => services.id, { onDelete: "restrict" }).notNull(),
  frequency: varchar("frequency", { length: 20 }).notNull(),
  interval: integer("interval").notNull().default(1),
  occurrenceCount: integer("occurrence_count").notNull(),
  firstStartsAt: timestamp("first_starts_at", { withTimezone: true }).notNull(),
  metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default({}),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const bookingSeriesLinks = pgTable("booking_series_links", {
  bookingId: uuid("booking_id").references(() => bookings.id, { onDelete: "cascade" }).primaryKey(),
  seriesId: uuid("series_id").references(() => recurringAppointmentSeries.id, { onDelete: "cascade" }).notNull(),
  occurrenceIndex: integer("occurrence_index").notNull(),
});

export const calendarConnections = pgTable("calendar_connections", {
  id: uuid("id").defaultRandom().primaryKey(),
  salonId: uuid("salon_id").references(() => salons.id, { onDelete: "cascade" }).notNull(),
  provider: varchar("provider", { length: 30 }).notNull(),
  externalCalendarId: text("external_calendar_id"),
  accessToken: text("access_token"),
  refreshToken: text("refresh_token"),
  tokenExpiresAt: timestamp("token_expires_at", { withTimezone: true }),
  syncEnabled: boolean("sync_enabled").notNull().default(true),
  lastSyncedAt: timestamp("last_synced_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [uniqueIndex("calendar_connection_provider_unique").on(table.salonId, table.provider)]);
