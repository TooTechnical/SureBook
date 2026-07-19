export type AnalyticsBooking = { customerId: string; serviceId: string; serviceName: string; status: "pending_payment" | "confirmed" | "cancelled" | "completed" | "no_show"; paymentStatus: "not_required" | "pending" | "paid" | "refunded" | "partially_refunded" | "failed" | "disputed"; depositCents: number; createdAt: Date; startsAt: Date };

export function calculateBusinessMetrics(rows: AnalyticsBooking[]) {
  const completed = rows.filter((row) => row.status === "completed");
  const noShows = rows.filter((row) => row.status === "no_show");
  const paid = rows.filter((row) => row.paymentStatus === "paid");
  const customers = new Set(rows.map((row) => row.customerId));
  const completedByCustomer = new Map<string, number>();
  const completedByService = new Map<string, { name: string; count: number }>();
  for (const row of completed) {
    completedByCustomer.set(row.customerId, (completedByCustomer.get(row.customerId) || 0) + 1);
    const service = completedByService.get(row.serviceId) || { name: row.serviceName, count: 0 };
    service.count += 1;
    completedByService.set(row.serviceId, service);
  }
  const repeatCustomers = [...completedByCustomer.values()].filter((count) => count > 1).length;
  const completedCustomers = completedByCustomer.size;
  const topService = [...completedByService.values()].sort((a, b) => b.count - a.count)[0] || null;
  return {
    revenueCents: paid.reduce((sum, row) => sum + row.depositCents, 0),
    bookings: rows.length,
    customers: customers.size,
    noShows: noShows.length,
    depositsSavedCents: noShows.filter((row) => row.paymentStatus === "paid").reduce((sum, row) => sum + row.depositCents, 0),
    topService,
    repeatCustomers,
    completedCustomers,
    repeatCustomerRate: completedCustomers ? repeatCustomers / completedCustomers : null,
  };
}

export function automationIdempotencyKey(input: { automationId: string; bookingId: string; scheduledFor: Date }) {
  return `${input.automationId}:${input.bookingId}:${input.scheduledFor.toISOString()}`;
}
