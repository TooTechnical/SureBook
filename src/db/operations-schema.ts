import { boolean, index, integer, jsonb, pgEnum, pgTable, text, timestamp, uniqueIndex, uuid, varchar } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { bookings, salons } from "./schema";

export const automationChannel = pgEnum("automation_channel", ["email", "sms"]);
export const automationExecutionStatus = pgEnum("automation_execution_status", ["scheduled", "processing", "sent", "failed", "cancelled", "skipped"]);
export const internalRole = pgEnum("internal_role", ["super_admin", "support", "finance", "operations", "read_only_analyst"]);
export const supportTicketStatus = pgEnum("support_ticket_status", ["open", "in_progress", "waiting", "resolved", "closed"]);
export const supportTicketPriority = pgEnum("support_ticket_priority", ["low", "normal", "high", "urgent"]);

export const weeklyReportPreferences = pgTable("weekly_report_preferences", {
  id: uuid("id").defaultRandom().primaryKey(),
  salonId: uuid("salon_id").references(() => salons.id, { onDelete: "cascade" }).notNull(),
  enabled: boolean("enabled").notNull().default(true),
  emailEnabled: boolean("email_enabled").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [uniqueIndex("weekly_report_salon_unique").on(table.salonId)]);

export const automationDefinitions = pgTable("automation_definitions", {
  id: uuid("id").defaultRandom().primaryKey(),
  salonId: uuid("salon_id").references(() => salons.id, { onDelete: "cascade" }).notNull(),
  automationType: varchar("automation_type", { length: 60 }).notNull(),
  enabled: boolean("enabled").notNull().default(false),
  trigger: varchar("trigger", { length: 60 }).notNull(),
  delayMinutes: integer("delay_minutes").notNull().default(0),
  channel: automationChannel("channel").notNull().default("email"),
  template: text("template").notNull(),
  ownerApprovalRequired: boolean("owner_approval_required").notNull().default(true),
  retryLimit: integer("retry_limit").notNull().default(3),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [uniqueIndex("automation_salon_type_unique").on(table.salonId, table.automationType), index("automation_due_lookup_idx").on(table.enabled, table.trigger)]);

export const automationExecutions = pgTable("automation_executions", {
  id: uuid("id").defaultRandom().primaryKey(),
  salonId: uuid("salon_id").references(() => salons.id, { onDelete: "cascade" }).notNull(),
  automationId: uuid("automation_id").references(() => automationDefinitions.id, { onDelete: "cascade" }).notNull(),
  bookingId: uuid("booking_id").references(() => bookings.id, { onDelete: "set null" }),
  idempotencyKey: varchar("idempotency_key", { length: 220 }).notNull().unique(),
  status: automationExecutionStatus("status").notNull().default("scheduled"),
  scheduledFor: timestamp("scheduled_for", { withTimezone: true }).notNull(),
  attempts: integer("attempts").notNull().default(0),
  failureMessage: text("failure_message"),
  providerMessageId: text("provider_message_id"),
  metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default({}),
  sentAt: timestamp("sent_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [index("automation_execution_due_idx").on(table.status, table.scheduledFor), index("automation_execution_salon_idx").on(table.salonId, table.createdAt)]);

export const growthScoreSnapshots = pgTable("growth_score_snapshots", {
  id: uuid("id").defaultRandom().primaryKey(),
  salonId: uuid("salon_id").references(() => salons.id, { onDelete: "cascade" }).notNull(),
  version: varchar("version", { length: 40 }).notNull(),
  overallScore: integer("overall_score").notNull(),
  categoryScores: jsonb("category_scores").$type<Record<string, number>>().notNull(),
  factors: jsonb("factors").$type<{ positive: string[]; negative: string[] }>().notNull(),
  dataWindowStart: timestamp("data_window_start", { withTimezone: true }).notNull(),
  dataWindowEnd: timestamp("data_window_end", { withTimezone: true }).notNull(),
  calculatedAt: timestamp("calculated_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [index("growth_snapshot_salon_date_idx").on(table.salonId, table.calculatedAt)]);

export const growthRecommendationStates = pgTable("growth_recommendation_states", {
  id: uuid("id").defaultRandom().primaryKey(),
  salonId: uuid("salon_id").references(() => salons.id, { onDelete: "cascade" }).notNull(),
  recommendationKey: varchar("recommendation_key", { length: 120 }).notNull(),
  dismissedAt: timestamp("dismissed_at", { withTimezone: true }),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [uniqueIndex("growth_recommendation_salon_key_unique").on(table.salonId, table.recommendationKey)]);

export const internalUsers = pgTable("internal_users", {
  id: uuid("id").defaultRandom().primaryKey(),
  email: varchar("email", { length: 255 }).notNull().unique(),
  name: varchar("name", { length: 160 }).notNull(),
  passwordHash: text("password_hash").notNull(),
  role: internalRole("role").notNull().default("read_only_analyst"),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const adminAuditLogs = pgTable("admin_audit_logs", {
  id: uuid("id").defaultRandom().primaryKey(),
  actorId: uuid("actor_id").references(() => internalUsers.id, { onDelete: "restrict" }).notNull(),
  action: varchar("action", { length: 120 }).notNull(),
  entityType: varchar("entity_type", { length: 80 }).notNull(),
  entityId: varchar("entity_id", { length: 120 }),
  metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default({}),
  previousState: jsonb("previous_state").$type<Record<string, unknown>>(),
  newState: jsonb("new_state").$type<Record<string, unknown>>(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [index("admin_audit_actor_date_idx").on(table.actorId, table.createdAt), index("admin_audit_entity_idx").on(table.entityType, table.entityId)]);

export const supportTickets = pgTable("support_tickets", {
  id: uuid("id").defaultRandom().primaryKey(),
  salonId: uuid("salon_id").references(() => salons.id, { onDelete: "cascade" }).notNull(),
  subject: varchar("subject", { length: 220 }).notNull(),
  category: varchar("category", { length: 80 }).notNull(),
  priority: supportTicketPriority("priority").notNull().default("normal"),
  status: supportTicketStatus("status").notNull().default("open"),
  assignedToId: uuid("assigned_to_id").references(() => internalUsers.id, { onDelete: "set null" }),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [index("support_ticket_queue_idx").on(table.status, table.priority, table.createdAt), index("support_ticket_salon_idx").on(table.salonId)]);

export const applicationErrors = pgTable("application_errors", {
  id: uuid("id").defaultRandom().primaryKey(),
  salonId: uuid("salon_id").references(() => salons.id, { onDelete: "set null" }),
  fingerprint: varchar("fingerprint", { length: 160 }).notNull(),
  route: varchar("route", { length: 240 }),
  message: text("message").notNull(),
  safeMetadata: jsonb("safe_metadata").$type<Record<string, unknown>>().notNull().default({}),
  resolvedAt: timestamp("resolved_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [index("application_error_queue_idx").on(table.resolvedAt, table.createdAt), index("application_error_fingerprint_idx").on(table.fingerprint)]);

export const automationDefinitionsRelations = relations(automationDefinitions, ({ many }) => ({ executions: many(automationExecutions) }));
export const automationExecutionsRelations = relations(automationExecutions, ({ one }) => ({
  automation: one(automationDefinitions, { fields: [automationExecutions.automationId], references: [automationDefinitions.id] }),
  booking: one(bookings, { fields: [automationExecutions.bookingId], references: [bookings.id] }),
  salon: one(salons, { fields: [automationExecutions.salonId], references: [salons.id] }),
}));
export const supportTicketsRelations = relations(supportTickets, ({ one }) => ({
  salon: one(salons, { fields: [supportTickets.salonId], references: [salons.id] }),
  assignedTo: one(internalUsers, { fields: [supportTickets.assignedToId], references: [internalUsers.id] }),
}));
