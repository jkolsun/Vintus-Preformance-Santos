import type { PlanTier } from "@prisma/client";

export interface PlanRecommendation {
  tier: PlanTier;
  name: string;
  tagline: string;
  price: number;
  period: string;
  isRecurring: boolean;
  durationLabel: string;
  category: "coaching" | "training" | "nutrition";
  features: string[];
  recommended: boolean;
}

const PLANS: Omit<PlanRecommendation, "recommended">[] = [
  {
    tier: "PRIVATE_COACHING",
    name: "Private Coaching",
    tagline: "Your dedicated performance coach, always adapting.",
    price: 500,
    period: "/mo",
    isRecurring: true,
    durationLabel: "Monthly subscription",
    category: "coaching",
    features: [
      "1-on-1 adaptive programming",
      "AI-powered workout personalization",
      "Readiness-based daily adjustments",
      "Wearable device integration",
      "SMS & email coaching nudges",
      "Priority coach access & strategy calls",
      "Full biometric tracking & recovery analytics",
      "Weekly performance digest",
    ],
  },
  {
    tier: "TRAINING_30DAY",
    name: "30-Day Training Plan",
    tagline: "Build habits in one focused month.",
    price: 99,
    period: "",
    isRecurring: false,
    durationLabel: "30-day access",
    category: "training",
    features: [
      "Structured 4-week training plan",
      "Daily readiness check-ins",
      "Automated plan adjustments",
      "Progress tracking dashboard",
    ],
  },
  {
    tier: "TRAINING_60DAY",
    name: "60-Day Training Plan",
    tagline: "Structured progression with periodized phases.",
    price: 149,
    period: "",
    isRecurring: false,
    durationLabel: "60-day access",
    category: "training",
    features: [
      "8-week periodized training plan",
      "Base, build, and peak phases",
      "Daily readiness check-ins",
      "Automated plan adjustments",
      "Progress tracking dashboard",
    ],
  },
  {
    tier: "TRAINING_90DAY",
    name: "90-Day Training Plan",
    tagline: "Full transformation with peak-to-deload cycling.",
    price: 199,
    period: "",
    isRecurring: false,
    durationLabel: "90-day access",
    category: "training",
    features: [
      "12-week full periodization program",
      "Base, build, peak, and deload cycles",
      "Daily readiness check-ins",
      "Automated plan adjustments",
      "Progress tracking dashboard",
      "Weekly performance digest",
    ],
  },
  {
    tier: "NUTRITION_4WEEK",
    name: "4-Week Nutrition Plan",
    tagline: "Dial in your nutrition for real results.",
    price: 229,
    period: "",
    isRecurring: false,
    durationLabel: "28-day access",
    category: "nutrition",
    features: [
      "Personalized macro targets",
      "Meal timing guidance",
      "Supplement recommendations",
      "Weekly nutrition check-ins",
    ],
  },
  {
    tier: "NUTRITION_8WEEK",
    name: "8-Week Nutrition Plan",
    tagline: "Deep nutrition programming for lasting change.",
    price: 399,
    period: "",
    isRecurring: false,
    durationLabel: "56-day access",
    category: "nutrition",
    features: [
      "Personalized macro targets",
      "Phased nutrition periodization",
      "Meal timing guidance",
      "Supplement recommendations",
      "Weekly nutrition check-ins",
      "Body composition tracking",
    ],
  },
];

/**
 * Get plan recommendations.
 * Always recommends PRIVATE_COACHING as the premium conversion target.
 */
export function getPlanRecommendations(
  _persona: string,
  _recommendedTier?: string
): PlanRecommendation[] {
  return PLANS.map((plan) => ({
    ...plan,
    recommended: plan.tier === "PRIVATE_COACHING",
  }));
}
