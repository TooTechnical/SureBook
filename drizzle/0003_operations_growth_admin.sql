CREATE TYPE "automation_channel" AS ENUM ('email', 'sms');
CREATE TYPE "automation_execution_status" AS ENUM ('scheduled', 'processing', 'sent', 'failed', 'cancelled', 'skipped');
CREATE TYPE "internal_role" AS ENUM ('super_admin', 'support', 'finance', 'operations', 'read_only_analyst');
CREATE TYPE "support_ticket_status" AS ENUM ('open', 'in_progress', 'waiting', 'resolved', 'closed');
CREATE TYPE "support_ticket_priority" AS ENUM ('low', 'normal', 'high', 'urgent');

CREATE TABLE "weekly_report_preferences" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(), "salon_id" uuid NOT NULL REFERENCES "salons"("id") ON DELETE CASCADE,
  "enabled" boolean NOT NULL DEFAULT true, "email_enabled" boolean NOT NULL DEFAULT false,
  "created_at" timestamptz NOT NULL DEFAULT now(), "updated_at" timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX "weekly_report_salon_unique" ON "weekly_report_preferences" ("salon_id");

CREATE TABLE "automation_definitions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(), "salon_id" uuid NOT NULL REFERENCES "salons"("id") ON DELETE CASCADE,
  "automation_type" varchar(60) NOT NULL, "enabled" boolean NOT NULL DEFAULT false, "trigger" varchar(60) NOT NULL,
  "delay_minutes" integer NOT NULL DEFAULT 0, "channel" automation_channel NOT NULL DEFAULT 'email', "template" text NOT NULL,
  "owner_approval_required" boolean NOT NULL DEFAULT true, "retry_limit" integer NOT NULL DEFAULT 3,
  "created_at" timestamptz NOT NULL DEFAULT now(), "updated_at" timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX "automation_salon_type_unique" ON "automation_definitions" ("salon_id", "automation_type");
CREATE INDEX "automation_due_lookup_idx" ON "automation_definitions" ("enabled", "trigger");

CREATE TABLE "automation_executions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(), "salon_id" uuid NOT NULL REFERENCES "salons"("id") ON DELETE CASCADE,
  "automation_id" uuid NOT NULL REFERENCES "automation_definitions"("id") ON DELETE CASCADE,
  "booking_id" uuid REFERENCES "bookings"("id") ON DELETE SET NULL, "idempotency_key" varchar(220) NOT NULL UNIQUE,
  "status" automation_execution_status NOT NULL DEFAULT 'scheduled', "scheduled_for" timestamptz NOT NULL,
  "attempts" integer NOT NULL DEFAULT 0, "failure_message" text, "provider_message_id" text, "metadata" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "sent_at" timestamptz, "created_at" timestamptz NOT NULL DEFAULT now(), "updated_at" timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX "automation_execution_due_idx" ON "automation_executions" ("status", "scheduled_for");
CREATE INDEX "automation_execution_salon_idx" ON "automation_executions" ("salon_id", "created_at");

CREATE TABLE "growth_score_snapshots" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(), "salon_id" uuid NOT NULL REFERENCES "salons"("id") ON DELETE CASCADE,
  "version" varchar(40) NOT NULL, "overall_score" integer NOT NULL, "category_scores" jsonb NOT NULL, "factors" jsonb NOT NULL,
  "data_window_start" timestamptz NOT NULL, "data_window_end" timestamptz NOT NULL, "calculated_at" timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX "growth_snapshot_salon_date_idx" ON "growth_score_snapshots" ("salon_id", "calculated_at");

CREATE TABLE "growth_recommendation_states" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(), "salon_id" uuid NOT NULL REFERENCES "salons"("id") ON DELETE CASCADE,
  "recommendation_key" varchar(120) NOT NULL, "dismissed_at" timestamptz, "completed_at" timestamptz, "updated_at" timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX "growth_recommendation_salon_key_unique" ON "growth_recommendation_states" ("salon_id", "recommendation_key");

CREATE TABLE "internal_users" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(), "email" varchar(255) NOT NULL UNIQUE, "name" varchar(160) NOT NULL,
  "password_hash" text NOT NULL, "role" internal_role NOT NULL DEFAULT 'read_only_analyst', "active" boolean NOT NULL DEFAULT true,
  "created_at" timestamptz NOT NULL DEFAULT now(), "updated_at" timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE "admin_audit_logs" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(), "actor_id" uuid NOT NULL REFERENCES "internal_users"("id") ON DELETE RESTRICT,
  "action" varchar(120) NOT NULL, "entity_type" varchar(80) NOT NULL, "entity_id" varchar(120), "metadata" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "previous_state" jsonb, "new_state" jsonb, "created_at" timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX "admin_audit_actor_date_idx" ON "admin_audit_logs" ("actor_id", "created_at");
CREATE INDEX "admin_audit_entity_idx" ON "admin_audit_logs" ("entity_type", "entity_id");

CREATE TABLE "support_tickets" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(), "salon_id" uuid NOT NULL REFERENCES "salons"("id") ON DELETE CASCADE,
  "subject" varchar(220) NOT NULL, "category" varchar(80) NOT NULL, "priority" support_ticket_priority NOT NULL DEFAULT 'normal',
  "status" support_ticket_status NOT NULL DEFAULT 'open', "assigned_to_id" uuid REFERENCES "internal_users"("id") ON DELETE SET NULL,
  "notes" text, "created_at" timestamptz NOT NULL DEFAULT now(), "updated_at" timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX "support_ticket_queue_idx" ON "support_tickets" ("status", "priority", "created_at");
CREATE INDEX "support_ticket_salon_idx" ON "support_tickets" ("salon_id");

CREATE TABLE "application_errors" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(), "salon_id" uuid REFERENCES "salons"("id") ON DELETE SET NULL,
  "fingerprint" varchar(160) NOT NULL, "route" varchar(240), "message" text NOT NULL, "safe_metadata" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "resolved_at" timestamptz, "created_at" timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX "application_error_queue_idx" ON "application_errors" ("resolved_at", "created_at");
CREATE INDEX "application_error_fingerprint_idx" ON "application_errors" ("fingerprint");
