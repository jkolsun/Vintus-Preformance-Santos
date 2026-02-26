/**
 * Lead scoring and persona classification helpers.
 * Used during intake processing to classify athletes before AI analysis.
 */

export type PersonaType =
  | "executive-athlete"
  | "endurance-competitor"
  | "hybrid-builder"
  | "recovery-first";

export interface ScoringInput {
  primaryGoal: string;
  experienceLevel: string;
  occupation?: string | null;
  trainingDaysPerWeek: number;
  stressLevel?: number | null;
  injuryHistory?: string | null;
  travelFrequency?: string | null;
}

/** Rule-based persona classification (fallback when AI is unavailable) */
export function classifyPersona(input: ScoringInput): PersonaType {
  const { primaryGoal, experienceLevel, occupation, trainingDaysPerWeek } =
    input;

  // Check for executive-athlete pattern
  if (occupation) {
    const executivePattern =
      /\b(exec|ceo|founder|director|vp|manager|partner|president|cfo|cto|coo)\b/i;
    if (executivePattern.test(occupation)) {
      return "executive-athlete";
    }
  }

  // High-level endurance competitors
  if (
    (experienceLevel === "advanced" || experienceLevel === "elite") &&
    primaryGoal === "endurance"
  ) {
    return "endurance-competitor";
  }

  // Muscle / recomposition goals
  if (primaryGoal === "build-muscle" || primaryGoal === "recomposition") {
    return "hybrid-builder";
  }

  // High volume beginners or high stress → recovery-first
  if (
    (experienceLevel === "beginner" && trainingDaysPerWeek >= 6) ||
    (input.stressLevel && input.stressLevel >= 8)
  ) {
    return "recovery-first";
  }

  // Default
  if (primaryGoal === "endurance") {
    return "endurance-competitor";
  }

  return "recovery-first";
}

/** Generate risk flags based on profile data */
export function generateRiskFlags(input: ScoringInput): string[] {
  const flags: string[] = [];

  if (input.injuryHistory && input.injuryHistory.trim().length > 0) {
    flags.push("injury-history");
  }

  if (input.experienceLevel === "beginner" && input.trainingDaysPerWeek >= 6) {
    flags.push("beginner-high-volume");
  }

  if (input.stressLevel && input.stressLevel >= 8 && input.trainingDaysPerWeek >= 5) {
    flags.push("high-stress-high-volume");
  }

  if (input.travelFrequency === "weekly") {
    flags.push("frequent-travel");
  }

  return flags;
}
