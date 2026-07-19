import assert from "node:assert/strict";
import test from "node:test";
import { automationIdempotencyKey, calculateBusinessMetrics, type AnalyticsBooking } from "../src/lib/analytics";

const now = new Date("2026-07-19T12:00:00Z");
const row = (overrides: Partial<AnalyticsBooking>): AnalyticsBooking => ({ customerId: "customer-a", serviceId: "service-a", serviceName: "Cut", status: "completed", paymentStatus: "paid", depositCents: 1000, createdAt: now, startsAt: now, ...overrides });

test("repeat customers require more than one completed booking", () => {
  const metrics = calculateBusinessMetrics([row({}), row({}), row({ customerId: "customer-b" }), row({ customerId: "customer-c", status: "cancelled" })]);
  assert.equal(metrics.repeatCustomers, 1);
  assert.equal(metrics.completedCustomers, 2);
  assert.equal(metrics.repeatCustomerRate, .5);
});

test("deposits saved includes only paid no-show deposits", () => {
  const metrics = calculateBusinessMetrics([row({ status: "no_show", depositCents: 2000 }), row({ status: "no_show", paymentStatus: "failed", depositCents: 3000 }), row({ status: "completed", depositCents: 4000 })]);
  assert.equal(metrics.depositsSavedCents, 2000);
});

test("automation idempotency key is stable per workflow, booking and schedule", () => {
  const input = { automationId: "automation-a", bookingId: "booking-a", scheduledFor: now };
  assert.equal(automationIdempotencyKey(input), automationIdempotencyKey(input));
  assert.notEqual(automationIdempotencyKey(input), automationIdempotencyKey({ ...input, bookingId: "booking-b" }));
});

test("weekly report calculations use the same auditable metrics", () => {
  const report = calculateBusinessMetrics([row({ depositCents: 1500 }), row({ customerId: "customer-b", status: "cancelled", paymentStatus: "pending" })]);
  assert.equal(report.bookings, 2);
  assert.equal(report.revenueCents, 1500);
});
