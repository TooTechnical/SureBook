export const GROWTH_SCORE_VERSION = "growth-score-v1";

export type GrowthScoreInput = {
  profile: { name: boolean; category: boolean; descriptionLength: number; seoTitle: boolean; seoDescription: boolean; locationComplete: boolean; openingHoursComplete: boolean };
  services: { total: number; withDescriptions: number; available: number };
  photos: { logo: boolean; cover: boolean; galleryCount: number; staffPhotoCount: number; usefulAltTextCount: number };
  reviews: { approvedCount: number; averageRating: number | null; recentCount: number; requestAutomationEnabled: boolean };
  bookings: { total: number; completed: number; cancelled: number; noShows: number; completedCustomerCount: number; repeatCustomerCount: number; availabilityConfigured: boolean };
  marketing: { activeTools: number; referralEnabled: boolean; audienceSize: number; weeklyReportEnabled: boolean; automationCount: number; recentOperatorUse: boolean };
};

export type GrowthRecommendation = { key: string; title: string; href: string; impact: "high" | "medium"; effort: "low" | "medium" };
export type GrowthScore = { version: typeof GROWTH_SCORE_VERSION; overall: number; categories: { seo: number; photos: number; reviews: number; bookings: number; marketing: number }; positiveFactors: string[]; negativeFactors: string[]; recommendations: GrowthRecommendation[]; sampleNote?: string };

const clamp = (value: number) => Math.max(0, Math.min(100, Math.round(value)));

export function calculateGrowthScore(input: GrowthScoreInput): GrowthScore {
  const positive: string[] = [];
  const negative: string[] = [];
  const recommendations: GrowthRecommendation[] = [];
  const serviceDescriptionRate = input.services.total ? input.services.withDescriptions / input.services.total : 0;
  const seo = clamp((input.profile.name ? 10 : 0) + (input.profile.category ? 10 : 0) + Math.min(20, input.profile.descriptionLength / 6) + (input.profile.seoTitle ? 10 : 0) + (input.profile.seoDescription ? 10 : 0) + (input.profile.locationComplete ? 15 : 0) + (input.profile.openingHoursComplete ? 10 : 0) + serviceDescriptionRate * 15);
  const photos = clamp((input.photos.logo ? 20 : 0) + (input.photos.cover ? 20 : 0) + Math.min(35, input.photos.galleryCount * 7) + Math.min(15, input.photos.staffPhotoCount * 5) + Math.min(10, input.photos.usefulAltTextCount * 2));

  const reviewOpportunity = input.bookings.completed >= 5;
  const reviewVolume = reviewOpportunity ? Math.min(35, input.reviews.approvedCount * 5) : 25;
  const reviews = clamp(reviewVolume + (input.reviews.averageRating === null ? (reviewOpportunity ? 0 : 20) : Math.max(0, (input.reviews.averageRating - 3) * 20)) + Math.min(20, input.reviews.recentCount * 5) + (input.reviews.requestAutomationEnabled ? 15 : 0));

  const hasStableSample = input.bookings.total >= 10;
  const completionRate = input.bookings.total ? input.bookings.completed / input.bookings.total : 0;
  const cancellationRate = input.bookings.total ? input.bookings.cancelled / input.bookings.total : 0;
  const noShowRate = input.bookings.total ? input.bookings.noShows / input.bookings.total : 0;
  const repeatRate = input.bookings.completedCustomerCount ? input.bookings.repeatCustomerCount / input.bookings.completedCustomerCount : 0;
  const outcomePoints = hasStableSample ? completionRate * 35 + (1 - cancellationRate) * 15 + (1 - noShowRate) * 15 : 35;
  const bookings = clamp(outcomePoints + (input.bookings.availabilityConfigured ? 15 : 0) + (input.services.available > 0 ? 10 : 0) + (hasStableSample ? repeatRate * 10 : 5));
  const marketing = clamp(Math.min(25, input.marketing.activeTools * 8) + (input.marketing.referralEnabled ? 15 : 0) + Math.min(15, input.marketing.audienceSize * 1.5) + (input.marketing.weeklyReportEnabled ? 15 : 0) + Math.min(20, input.marketing.automationCount * 5) + (input.marketing.recentOperatorUse ? 10 : 0));

  if (seo >= 75) positive.push("Your storefront information is strong and search-ready.");
  if (photos >= 70) positive.push("Your visual profile gives customers useful booking context.");
  if (input.bookings.availabilityConfigured) positive.push("Bookable availability is configured.");
  if (!input.profile.openingHoursComplete) { negative.push("Opening hours are incomplete."); recommendations.push({ key: "complete-hours", title: "Complete opening hours", href: "/dashboard/settings", impact: "high", effort: "low" }); }
  if (input.photos.galleryCount < 5) { negative.push("The gallery has fewer than five photos."); recommendations.push({ key: "add-gallery", title: `Upload ${5 - input.photos.galleryCount} more gallery photo${5 - input.photos.galleryCount === 1 ? "" : "s"}`, href: "/dashboard/settings", impact: "medium", effort: "medium" }); }
  if (serviceDescriptionRate < 1) { negative.push("Some services are missing useful descriptions."); recommendations.push({ key: "service-descriptions", title: "Add missing service descriptions", href: "/dashboard/services", impact: "high", effort: "medium" }); }
  if (!input.reviews.requestAutomationEnabled && input.bookings.completed > 0) recommendations.push({ key: "review-automation", title: "Enable review requests", href: "/dashboard/automations", impact: "high", effort: "low" });
  if (input.marketing.automationCount === 0) recommendations.push({ key: "appointment-reminders", title: "Configure an appointment reminder", href: "/dashboard/automations", impact: "high", effort: "low" });

  recommendations.sort((a, b) => (a.impact === b.impact ? (a.effort === "low" ? -1 : 1) : a.impact === "high" ? -1 : 1));
  return { version: GROWTH_SCORE_VERSION, overall: clamp(seo * .2 + photos * .15 + reviews * .2 + bookings * .25 + marketing * .2), categories: { seo, photos, reviews, bookings, marketing }, positiveFactors: positive, negativeFactors: negative, recommendations, sampleNote: hasStableSample ? undefined : "Booking-rate insights use a neutral baseline until at least 10 bookings are available." };
}
