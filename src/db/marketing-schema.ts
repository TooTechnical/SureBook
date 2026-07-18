import { relations } from "drizzle-orm";
import { boolean, integer, jsonb, pgEnum, pgTable, text, timestamp, uniqueIndex, uuid, varchar } from "drizzle-orm/pg-core";
import { customers, salons, services } from "./schema";

export const discountType = pgEnum("discount_type", ["percent", "fixed"]);
export const voucherStatus = pgEnum("voucher_status", ["pending", "active", "redeemed", "expired", "cancelled"]);
export const purchaseStatus = pgEnum("purchase_status", ["pending", "active", "completed", "cancelled", "refunded"]);

export const aiGenerations = pgTable("ai_generations", {
  id: uuid("id").defaultRandom().primaryKey(), salonId: uuid("salon_id").references(() => salons.id, { onDelete: "cascade" }).notNull(),
  task: varchar("task", { length: 80 }).notNull(), prompt: text("prompt").notNull(), output: text("output").notNull(),
  metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default({}), createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const discountCodes = pgTable("discount_codes", {
  id: uuid("id").defaultRandom().primaryKey(), salonId: uuid("salon_id").references(() => salons.id, { onDelete: "cascade" }).notNull(), code: varchar("code", { length: 40 }).notNull(), description: varchar("description", { length: 220 }),
  type: discountType("type").notNull(), amount: integer("amount").notNull(), minimumSpendCents: integer("minimum_spend_cents").notNull().default(0), maximumRedemptions: integer("maximum_redemptions"), redemptionCount: integer("redemption_count").notNull().default(0),
  startsAt: timestamp("starts_at", { withTimezone: true }), endsAt: timestamp("ends_at", { withTimezone: true }), active: boolean("active").notNull().default(true), createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [uniqueIndex("discount_code_salon_unique").on(table.salonId, table.code)]);

export const referralCampaigns = pgTable("referral_campaigns", {
  id: uuid("id").defaultRandom().primaryKey(), salonId: uuid("salon_id").references(() => salons.id, { onDelete: "cascade" }).notNull(), name: varchar("name", { length: 160 }).notNull(),
  advocateRewardCents: integer("advocate_reward_cents").notNull(), friendRewardCents: integer("friend_reward_cents").notNull(), terms: text("terms"), active: boolean("active").notNull().default(true), createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const referrals = pgTable("referrals", {
  id: uuid("id").defaultRandom().primaryKey(), campaignId: uuid("campaign_id").references(() => referralCampaigns.id, { onDelete: "cascade" }).notNull(), salonId: uuid("salon_id").references(() => salons.id, { onDelete: "cascade" }).notNull(),
  referrerCustomerId: uuid("referrer_customer_id").references(() => customers.id, { onDelete: "set null" }), referredCustomerId: uuid("referred_customer_id").references(() => customers.id, { onDelete: "set null" }), code: varchar("code", { length: 40 }).notNull().unique(), status: varchar("status", { length: 30 }).notNull().default("issued"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(), convertedAt: timestamp("converted_at", { withTimezone: true }),
});

export const giftVouchers = pgTable("gift_vouchers", {
  id: uuid("id").defaultRandom().primaryKey(), salonId: uuid("salon_id").references(() => salons.id, { onDelete: "cascade" }).notNull(), code: varchar("code", { length: 40 }).notNull().unique(),
  purchaserName: varchar("purchaser_name", { length: 160 }), purchaserEmail: varchar("purchaser_email", { length: 255 }), recipientName: varchar("recipient_name", { length: 160 }), recipientEmail: varchar("recipient_email", { length: 255 }), message: text("message"),
  amountCents: integer("amount_cents").notNull(), balanceCents: integer("balance_cents").notNull(), status: voucherStatus("status").notNull().default("active"), stripeCheckoutSessionId: text("stripe_checkout_session_id"), expiresAt: timestamp("expires_at", { withTimezone: true }), createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const memberships = pgTable("memberships", {
  id: uuid("id").defaultRandom().primaryKey(), salonId: uuid("salon_id").references(() => salons.id, { onDelete: "cascade" }).notNull(), name: varchar("name", { length: 160 }).notNull(), description: text("description"),
  priceCents: integer("price_cents").notNull(), billingInterval: varchar("billing_interval", { length: 20 }).notNull().default("month"), visitsIncluded: integer("visits_included").notNull().default(0), priorityBooking: boolean("priority_booking").notNull().default(false), stripePriceId: text("stripe_price_id"), active: boolean("active").notNull().default(true), createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const membershipSubscriptions = pgTable("membership_subscriptions", {
  id: uuid("id").defaultRandom().primaryKey(), membershipId: uuid("membership_id").references(() => memberships.id, { onDelete: "restrict" }).notNull(), salonId: uuid("salon_id").references(() => salons.id, { onDelete: "cascade" }).notNull(), customerId: uuid("customer_id").references(() => customers.id, { onDelete: "restrict" }).notNull(),
  stripeSubscriptionId: text("stripe_subscription_id"), status: purchaseStatus("status").notNull().default("active"), visitsRemaining: integer("visits_remaining").notNull().default(0), currentPeriodStart: timestamp("current_period_start", { withTimezone: true }).defaultNow().notNull(), currentPeriodEnd: timestamp("current_period_end", { withTimezone: true }), createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const servicePackages = pgTable("service_packages", {
  id: uuid("id").defaultRandom().primaryKey(), salonId: uuid("salon_id").references(() => salons.id, { onDelete: "cascade" }).notNull(), serviceId: uuid("service_id").references(() => services.id, { onDelete: "set null" }), name: varchar("name", { length: 160 }).notNull(), description: text("description"),
  sessionCount: integer("session_count").notNull(), priceCents: integer("price_cents").notNull(), validityDays: integer("validity_days").notNull().default(365), active: boolean("active").notNull().default(true), createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const packagePurchases = pgTable("package_purchases", {
  id: uuid("id").defaultRandom().primaryKey(), packageId: uuid("package_id").references(() => servicePackages.id, { onDelete: "restrict" }).notNull(), salonId: uuid("salon_id").references(() => salons.id, { onDelete: "cascade" }).notNull(), customerId: uuid("customer_id").references(() => customers.id, { onDelete: "restrict" }).notNull(),
  sessionsRemaining: integer("sessions_remaining").notNull(), amountPaidCents: integer("amount_paid_cents").notNull(), status: purchaseStatus("status").notNull().default("active"), stripeCheckoutSessionId: text("stripe_checkout_session_id"), expiresAt: timestamp("expires_at", { withTimezone: true }), createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const membershipsRelations = relations(memberships, ({ one, many }) => ({ salon: one(salons, { fields: [memberships.salonId], references: [salons.id] }), subscriptions: many(membershipSubscriptions) }));
export const membershipSubscriptionsRelations = relations(membershipSubscriptions, ({ one }) => ({ membership: one(memberships, { fields: [membershipSubscriptions.membershipId], references: [memberships.id] }), salon: one(salons, { fields: [membershipSubscriptions.salonId], references: [salons.id] }), customer: one(customers, { fields: [membershipSubscriptions.customerId], references: [customers.id] }) }));
export const servicePackagesRelations = relations(servicePackages, ({ one, many }) => ({ salon: one(salons, { fields: [servicePackages.salonId], references: [salons.id] }), service: one(services, { fields: [servicePackages.serviceId], references: [services.id] }), purchases: many(packagePurchases) }));
export const packagePurchasesRelations = relations(packagePurchases, ({ one }) => ({ package: one(servicePackages, { fields: [packagePurchases.packageId], references: [servicePackages.id] }), customer: one(customers, { fields: [packagePurchases.customerId], references: [customers.id] }), salon: one(salons, { fields: [packagePurchases.salonId], references: [salons.id] }) }));
