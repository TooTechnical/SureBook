import assert from "node:assert/strict";
import test from "node:test";
import { calculateGrowthScore } from "../src/lib/growth-score";

const base = {
  profile: { name: true, category: true, descriptionLength: 120, seoTitle: true, seoDescription: true, locationComplete: true, openingHoursComplete: true },
  services: { total: 2, withDescriptions: 2, available: 2 },
  photos: { logo: true, cover: true, galleryCount: 5, staffPhotoCount: 2, usefulAltTextCount: 5 },
  reviews: { approvedCount: 10, averageRating: 4.8, recentCount: 4, requestAutomationEnabled: true },
  bookings: { total: 20, completed: 16, cancelled: 2, noShows: 2, completedCustomerCount: 12, repeatCustomerCount: 4, availabilityConfigured: true },
  marketing: { activeTools: 2, referralEnabled: true, audienceSize: 10, weeklyReportEnabled: true, automationCount: 3, recentOperatorUse: true },
};

test("growth score is deterministic, bounded and versioned", () => {
  const first = calculateGrowthScore(base);
  const second = calculateGrowthScore(base);
  assert.deepEqual(first, second);
  assert.equal(first.version, "growth-score-v1");
  assert.ok(first.overall >= 0 && first.overall <= 100);
});

test("new businesses receive minimum-sample safeguards", () => {
  const result = calculateGrowthScore({ ...base, reviews: { approvedCount: 0, averageRating: null, recentCount: 0, requestAutomationEnabled: false }, bookings: { total: 2, completed: 1, cancelled: 0, noShows: 0, completedCustomerCount: 1, repeatCustomerCount: 0, availabilityConfigured: true } });
  assert.match(result.sampleNote || "", /at least 10 bookings/);
  assert.ok(result.categories.reviews > 0, "new businesses are not assigned a zero review score before having a fair opportunity");
});

test("recommendations are derived only from missing measurable signals", () => {
  const result = calculateGrowthScore({ ...base, profile: { ...base.profile, openingHoursComplete: false }, photos: { ...base.photos, galleryCount: 2 } });
  assert.ok(result.recommendations.some((item) => item.key === "complete-hours"));
  assert.ok(result.recommendations.some((item) => item.key === "add-gallery"));
});
