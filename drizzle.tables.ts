/**
 * Tables owned by SureBook and safe for Drizzle Kit to manage.
 *
 * Keep this allowlist in sync with pgTable declarations under src/db. Extension
 * relations and tables owned by other applications must never be added here.
 */
export const sureBookTables = [
  "admin_audit_logs",
  "ai_generations",
  "application_errors",
  "audit_log",
  "automation_definitions",
  "automation_executions",
  "availability_rules",
  "booking_discounts",
  "booking_series_links",
  "bookings",
  "business_hours",
  "calendar_blocks",
  "calendar_connections",
  "customers",
  "discount_codes",
  "gift_vouchers",
  "growth_recommendation_states",
  "growth_score_snapshots",
  "internal_users",
  "membership_subscriptions",
  "memberships",
  "package_purchases",
  "recurring_appointment_series",
  "referral_campaigns",
  "referrals",
  "reviews",
  "salons",
  "service_categories",
  "service_packages",
  "service_staff",
  "services",
  "staff",
  "storefront_images",
  "support_tickets",
  "weekly_report_preferences",
] as const;

export const protectedPostgisRelations = [
  "geography_columns",
  "geometry_columns",
  "spatial_ref_sys",
] as const;
