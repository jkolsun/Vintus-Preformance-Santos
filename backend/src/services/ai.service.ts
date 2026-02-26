import { anthropic } from "../lib/anthropic.js";
import { logger } from "../lib/logger.js";
import {
  classifyPersona,
  generateRiskFlags,
  type PersonaType,
  type ScoringInput,
} from "../utils/scoring.js";
import { fallbackTemplates } from "../data/message-templates.js";

// ============================================================
// Types
// ============================================================

export interface IntakeProfile {
  firstName: string;
  lastName: string;
  primaryGoal: string;
  experienceLevel: string;
  trainingDaysPerWeek: number;
  equipmentAccess: string;
  occupation?: string | null;
  stressLevel?: number | null;
  injuryHistory?: string | null;
  travelFrequency?: string | null;
  secondaryGoals?: string[];
  preferredTrainingTime?: string | null;
  currentActivity?: string | null;
  sleepSchedule?: string | null;
  dateOfBirth?: string | null;
}

export interface ProcessIntakeResult {
  persona: string;
  summary: string;
  riskFlags: string[];
  recommendedTier: string;
  tierReason: string;
}

interface MessageContext {
  firstName?: string;
  workoutTitle?: string;
  completedCount?: number;
  adherenceRate?: number;
  hrvMs?: number;
  sleepScore?: number;
  sleepDurationMin?: number;
  trainingDaysPerWeek?: number;
  bookingLink?: string;
  checkInLink?: string;
  channel?: "SMS" | "EMAIL";
  [key: string]: unknown;
}

// ============================================================
// Rate Limiter (sliding window — 100 calls/minute)
// ============================================================

const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX = 100;
const callTimestamps: number[] = [];

function checkRateLimit(): boolean {
  const now = Date.now();
  // Remove timestamps older than the window
  while (callTimestamps.length > 0 && callTimestamps[0] < now - RATE_LIMIT_WINDOW_MS) {
    callTimestamps.shift();
  }
  if (callTimestamps.length >= RATE_LIMIT_MAX) {
    return false;
  }
  callTimestamps.push(now);
  return true;
}

// ============================================================
// Claude API Constants
// ============================================================

const MODEL = "claude-sonnet-4-20250514";

const INTAKE_SYSTEM_PROMPT = `You are the AI engine behind Vintus Performance, a premium coaching brand. You analyze athlete intake surveys and produce:
1) A persona classification (exactly one of: executive-athlete, endurance-competitor, hybrid-builder, recovery-first)
2) A 2-3 sentence summary of this athlete written in second person ('You are...' or 'You're...'). Tone: premium, calm, disciplined, confident. Never cheesy or generic.
3) Risk flags (array of strings) — flag if: injury history present, beginner + 6+ days/week, high stress + high training volume, age 50+ with no experience
4) A recommended product (one of: PRIVATE_COACHING, TRAINING_30DAY, TRAINING_60DAY, TRAINING_90DAY, NUTRITION_4WEEK, NUTRITION_8WEEK) with a 1-sentence reason. Always recommend PRIVATE_COACHING unless the athlete explicitly only wants a standalone plan.

Respond ONLY in JSON format:
{
  "persona": "...",
  "summary": "...",
  "riskFlags": [...],
  "recommendedTier": "...",
  "tierReason": "..."
}`;

const MESSAGE_SYSTEM_PROMPT = `You are "Jerry" — the AI performance coach behind Vintus Performance. You write short, contextual messages to athletes.

RULES:
- Tone: premium, calm, disciplined, confident. Think high-end personal coach, not Instagram fitness influencer.
- NEVER use: "crushing it", "beast mode", "killing it", "let's gooo", "no excuses", "you got this!", "you're falling behind"
- NEVER use generic motivational poster language
- Use the athlete's first name occasionally (not every time)
- Reference specific data when provided (HRV, sleep score, workout details, adherence rate)
- SMS: keep to 160 characters or 2 sentences max
- EMAIL: can be 2-4 sentences
- The message MUST be different from all previous messages provided
- No emojis unless the context specifically calls for it

Return ONLY the message text, nothing else.`;

// ============================================================
// processIntake — Claude API with rule-based fallback
// ============================================================

export async function processIntake(
  profile: IntakeProfile
): Promise<ProcessIntakeResult> {
  // Rate limit check
  if (!checkRateLimit()) {
    logger.warn("AI rate limit reached for processIntake, using fallback");
    return classifyPersonaFallback(profile);
  }

  const startTime = Date.now();

  try {
    const userPrompt = serializeProfile(profile);

    const response = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 500,
      temperature: 0.3,
      system: INTAKE_SYSTEM_PROMPT,
      messages: [{ role: "user", content: userPrompt }],
    });

    const latency = Date.now() - startTime;
    logger.info({ latency, model: MODEL }, "Claude processIntake call completed");

    const text =
      response.content[0].type === "text" ? response.content[0].text : "";
    const parsed = parseIntakeResponse(text);

    if (parsed) {
      return parsed;
    }

    // Retry once on parse failure
    logger.warn("First Claude response failed to parse, retrying once");
    const retryResponse = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 500,
      temperature: 0.1,
      system: INTAKE_SYSTEM_PROMPT + "\n\nIMPORTANT: Your previous response was not valid JSON. Return ONLY a valid JSON object, nothing else.",
      messages: [{ role: "user", content: userPrompt }],
    });

    const retryLatency = Date.now() - startTime;
    logger.info({ latency: retryLatency }, "Claude processIntake retry completed");

    const retryText =
      retryResponse.content[0].type === "text" ? retryResponse.content[0].text : "";
    const retryParsed = parseIntakeResponse(retryText);

    if (retryParsed) {
      return retryParsed;
    }

    logger.warn("Claude retry also failed to parse, falling back to rule-based");
    return classifyPersonaFallback(profile);
  } catch (err) {
    const latency = Date.now() - startTime;
    logger.error({ err, latency }, "Claude processIntake failed, using fallback");
    return classifyPersonaFallback(profile);
  }
}

function serializeProfile(profile: IntakeProfile): string {
  const lines: string[] = [
    `Name: ${profile.firstName} ${profile.lastName}`,
    `Primary Goal: ${profile.primaryGoal}`,
    `Experience Level: ${profile.experienceLevel}`,
    `Training Days/Week: ${profile.trainingDaysPerWeek}`,
    `Equipment Access: ${profile.equipmentAccess}`,
  ];

  if (profile.secondaryGoals?.length) {
    lines.push(`Secondary Goals: ${profile.secondaryGoals.join(", ")}`);
  }
  if (profile.occupation) lines.push(`Occupation: ${profile.occupation}`);
  if (profile.preferredTrainingTime) lines.push(`Preferred Training Time: ${profile.preferredTrainingTime}`);
  if (profile.currentActivity) lines.push(`Current Activity: ${profile.currentActivity}`);
  if (profile.injuryHistory) lines.push(`Injury History: ${profile.injuryHistory}`);
  if (profile.sleepSchedule) lines.push(`Sleep Schedule: ${profile.sleepSchedule}`);
  if (profile.stressLevel != null) lines.push(`Stress Level (1-10): ${profile.stressLevel}`);
  if (profile.travelFrequency) lines.push(`Travel Frequency: ${profile.travelFrequency}`);
  if (profile.dateOfBirth) lines.push(`Date of Birth: ${profile.dateOfBirth}`);

  return lines.join("\n");
}

function parseIntakeResponse(text: string): ProcessIntakeResult | null {
  try {
    // Strip markdown code fences if present
    const cleaned = text.replace(/```(?:json)?\s*/g, "").replace(/```\s*/g, "").trim();
    const parsed = JSON.parse(cleaned);

    const validPersonas = ["executive-athlete", "endurance-competitor", "hybrid-builder", "recovery-first"];
    const validTiers = ["PRIVATE_COACHING", "TRAINING_30DAY", "TRAINING_60DAY", "TRAINING_90DAY", "NUTRITION_4WEEK", "NUTRITION_8WEEK"];

    if (
      typeof parsed.persona === "string" &&
      validPersonas.includes(parsed.persona) &&
      typeof parsed.summary === "string" &&
      parsed.summary.length > 10 &&
      Array.isArray(parsed.riskFlags) &&
      typeof parsed.recommendedTier === "string" &&
      validTiers.includes(parsed.recommendedTier) &&
      typeof parsed.tierReason === "string"
    ) {
      return {
        persona: parsed.persona,
        summary: parsed.summary,
        riskFlags: parsed.riskFlags.filter((f: unknown) => typeof f === "string"),
        recommendedTier: parsed.recommendedTier,
        tierReason: parsed.tierReason,
      };
    }

    return null;
  } catch {
    return null;
  }
}

// ============================================================
// generateMessage — Claude API with template fallback
// ============================================================

export async function generateMessage(
  category: string,
  context: MessageContext,
  previousMessages: string[]
): Promise<{ content: string; templateId: null | string }> {
  // Rate limit check
  if (!checkRateLimit()) {
    logger.warn("AI rate limit reached for generateMessage, using template fallback");
    return getTemplateFallback(category, context, previousMessages);
  }

  const startTime = Date.now();

  try {
    const channelNote =
      context.channel === "EMAIL"
        ? "This is for an EMAIL — can be 2-4 sentences."
        : "This is for an SMS — keep to 160 characters or 2 sentences max.";

    const contextLines: string[] = [`Message category: ${category}`, channelNote];

    if (context.firstName) contextLines.push(`Athlete name: ${context.firstName}`);
    if (context.workoutTitle) contextLines.push(`Workout: ${context.workoutTitle}`);
    if (context.completedCount != null) contextLines.push(`Sessions completed this week: ${context.completedCount}`);
    if (context.adherenceRate != null) contextLines.push(`Adherence rate: ${Math.round(context.adherenceRate * 100)}%`);
    if (context.hrvMs != null) contextLines.push(`HRV: ${context.hrvMs}ms`);
    if (context.sleepScore != null) contextLines.push(`Sleep score: ${context.sleepScore}`);
    if (context.sleepDurationMin != null) contextLines.push(`Sleep duration: ${Math.round(context.sleepDurationMin / 60 * 10) / 10} hours`);
    if (context.bookingLink) contextLines.push(`Booking link (include if escalation): ${context.bookingLink}`);

    if (previousMessages.length > 0) {
      contextLines.push(`\nPrevious messages sent to this athlete (DO NOT repeat any of these):`);
      previousMessages.forEach((msg, i) => {
        contextLines.push(`${i + 1}. "${msg}"`);
      });
    }

    const response = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 150,
      temperature: 0.8,
      system: MESSAGE_SYSTEM_PROMPT,
      messages: [{ role: "user", content: contextLines.join("\n") }],
    });

    const latency = Date.now() - startTime;
    logger.info({ latency, category, model: MODEL }, "Claude generateMessage call completed");

    const content =
      response.content[0].type === "text"
        ? response.content[0].text.trim().replace(/^["']|["']$/g, "")
        : "";

    if (content.length > 0) {
      return { content, templateId: null };
    }

    logger.warn("Claude returned empty message, using template fallback");
    return getTemplateFallback(category, context, previousMessages);
  } catch (err) {
    const latency = Date.now() - startTime;
    logger.error({ err, latency, category }, "Claude generateMessage failed, using template fallback");
    return getTemplateFallback(category, context, previousMessages);
  }
}

function getTemplateFallback(
  category: string,
  context: MessageContext,
  previousMessages: string[]
): { content: string; templateId: string } {
  const templates = fallbackTemplates[category] ?? fallbackTemplates["MOTIVATION"];

  // Filter out templates whose content matches any previous message
  const available = templates.filter((t) => {
    const interpolated = interpolateTemplate(t.content, context);
    return !previousMessages.some((prev) => prev === interpolated);
  });

  // Pick randomly from available, or from all if none available
  const pool = available.length > 0 ? available : templates;
  const selected = pool[Math.floor(Math.random() * pool.length)];

  return {
    content: interpolateTemplate(selected.content, context),
    templateId: selected.id,
  };
}

function interpolateTemplate(
  template: string,
  context: MessageContext
): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_match, key: string) => {
    const value = context[key];
    if (value == null) return "";
    if (typeof value === "number" && key === "adherenceRate") {
      return `${Math.round(value * 100)}%`;
    }
    return String(value);
  });
}

// ============================================================
// classifyPersonaFallback — rule-based (kept from Prompt 4)
// ============================================================

export function classifyPersonaFallback(
  profile: IntakeProfile
): ProcessIntakeResult {
  const scoringInput: ScoringInput = {
    primaryGoal: profile.primaryGoal,
    experienceLevel: profile.experienceLevel,
    trainingDaysPerWeek: profile.trainingDaysPerWeek,
    occupation: profile.occupation,
    stressLevel: profile.stressLevel,
    injuryHistory: profile.injuryHistory,
    travelFrequency: profile.travelFrequency,
  };

  const persona = classifyPersona(scoringInput);
  const riskFlags = generateRiskFlags(scoringInput);
  const summary = buildSummaryTemplate(profile, persona);
  const { recommendedTier, tierReason } = getRecommendedTier(persona, profile);

  return { persona, summary, riskFlags, recommendedTier, tierReason };
}

function buildSummaryTemplate(
  profile: IntakeProfile,
  persona: PersonaType
): string {
  const name = profile.firstName;
  const goalLabel: Record<string, string> = {
    "build-muscle": "building muscle",
    "lose-fat": "fat loss",
    endurance: "endurance performance",
    recomposition: "body recomposition",
    "well-rounded": "well-rounded fitness",
    other: "your fitness goals",
  };
  const goal = goalLabel[profile.primaryGoal] ?? "your fitness goals";

  const personaSummaries: Record<PersonaType, string> = {
    "executive-athlete": `${name}, you're a high-performing professional who treats training like a strategic priority. With ${profile.trainingDaysPerWeek} days per week dedicated to ${goal}, you need a structured plan that maximizes efficiency within a demanding schedule. Your programming will adapt around your workload and recovery capacity to keep you progressing without burnout.`,

    "endurance-competitor": `${name}, your ${profile.experienceLevel}-level endurance focus sets you apart. With ${profile.trainingDaysPerWeek} training days targeting ${goal}, your plan will balance aerobic development with the strength work needed to stay resilient. Expect structured periodization that builds your base while pushing your threshold.`,

    "hybrid-builder": `${name}, you're focused on ${goal} with a solid foundation of ${profile.experienceLevel}-level experience. Training ${profile.trainingDaysPerWeek} days per week with ${profile.equipmentAccess.replace("-", " ")} access, your plan will combine progressive strength programming with strategic conditioning to reshape your body composition.`,

    "recovery-first": `${name}, building a sustainable foundation is your first priority. At ${profile.trainingDaysPerWeek} days per week, your plan focuses on ${goal} with an emphasis on proper recovery, movement quality, and gradual progression. Consistency beats intensity — your programming will build habits that last.`,
  };

  return personaSummaries[persona];
}

function getRecommendedTier(
  _persona: PersonaType,
  _profile: IntakeProfile
): { recommendedTier: string; tierReason: string } {
  return {
    recommendedTier: "PRIVATE_COACHING",
    tierReason:
      "Private Coaching gives you fully adaptive, 1-on-1 AI programming that adjusts to your schedule, recovery, and goals every single day.",
  };
}
