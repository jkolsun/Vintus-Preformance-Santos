/**
 * Message template library for Vintus Performance.
 * Templates use {{variable}} interpolation.
 * Each template has a cooldown (hours) and channel compatibility.
 */

export interface MessageTemplate {
  id: string;
  category: string;
  channel: "SMS" | "EMAIL" | "BOTH";
  content: string;
  cooldownHours: number;
  tags: string[];
}

/**
 * Full template library grouped by MessageCategory.
 * Also exported flat for the AI service fallback.
 */
export const messageTemplates: Record<string, MessageTemplate[]> = {
  // ============================================================
  // WELCOME — 10 templates
  // ============================================================
  WELCOME: [
    {
      id: "welcome-sms-1",
      category: "WELCOME",
      channel: "SMS",
      content: "Welcome to Vintus, {{firstName}}. Your plan is built and ready. Let the structure do its job.",
      cooldownHours: 720,
      tags: ["onboarding", "first-message"],
    },
    {
      id: "welcome-sms-2",
      category: "WELCOME",
      channel: "SMS",
      content: "{{firstName}}, you're in. Your first week is loaded — show up, follow the plan, and trust the process.",
      cooldownHours: 720,
      tags: ["onboarding", "first-message"],
    },
    {
      id: "welcome-sms-3",
      category: "WELCOME",
      channel: "SMS",
      content: "Everything is set, {{firstName}}. Day one starts now. Consistency from here.",
      cooldownHours: 720,
      tags: ["onboarding", "first-message"],
    },
    {
      id: "welcome-sms-4",
      category: "WELCOME",
      channel: "SMS",
      content: "{{firstName}} — your programming is live. The plan adapts to you. Your job is to show up.",
      cooldownHours: 720,
      tags: ["onboarding", "first-message"],
    },
    {
      id: "welcome-sms-5",
      category: "WELCOME",
      channel: "SMS",
      content: "You've made the decision. Now we execute. Your first session is queued, {{firstName}}.",
      cooldownHours: 720,
      tags: ["onboarding", "first-message"],
    },
    {
      id: "welcome-email-1",
      category: "WELCOME",
      channel: "EMAIL",
      content: "Welcome to Vintus Performance, {{firstName}}. Your personalized training plan is live and adapting to your goals, schedule, and readiness from day one. Here's what to expect: a daily check-in to calibrate your plan, structured sessions designed for your experience level, and adaptive adjustments based on how you recover. Show up consistently — the system does the rest.",
      cooldownHours: 720,
      tags: ["onboarding", "first-email"],
    },
    {
      id: "welcome-email-2",
      category: "WELCOME",
      channel: "EMAIL",
      content: "{{firstName}}, your Vintus programming is ready. Your first week is structured around {{trainingDaysPerWeek}} training days with sessions tailored to your equipment and experience level. Each session has a clear purpose — nothing is filler. Log your daily readiness check-in each morning and the plan will adapt in real time. Discipline within. Dominance beyond.",
      cooldownHours: 720,
      tags: ["onboarding", "first-email"],
    },
    {
      id: "welcome-email-3",
      category: "WELCOME",
      channel: "EMAIL",
      content: "Good to have you, {{firstName}}. Your plan is calibrated and waiting. Over the coming weeks, your programming will progressively adapt based on your adherence, recovery data, and performance. Your only job is to show up and log your sessions. The system handles the periodization, load management, and deload timing. Let's build something.",
      cooldownHours: 720,
      tags: ["onboarding", "first-email"],
    },
    {
      id: "welcome-sms-6",
      category: "WELCOME",
      channel: "SMS",
      content: "{{firstName}}, the foundation is laid. Your plan is personalized, adaptive, and ready to go. Discipline within, dominance beyond.",
      cooldownHours: 720,
      tags: ["onboarding", "first-message"],
    },
    {
      id: "welcome-sms-7",
      category: "WELCOME",
      channel: "SMS",
      content: "Ready when you are, {{firstName}}. Your training starts now. No guesswork — just structured progression.",
      cooldownHours: 720,
      tags: ["onboarding", "first-message"],
    },
  ],

  // ============================================================
  // WORKOUT_COMPLETED — 15 templates
  // ============================================================
  WORKOUT_COMPLETED: [
    {
      id: "wc-1",
      category: "WORKOUT_COMPLETED",
      channel: "BOTH",
      content: "That's another one logged. Consistency compounds.",
      cooldownHours: 48,
      tags: ["post-workout"],
    },
    {
      id: "wc-2",
      category: "WORKOUT_COMPLETED",
      channel: "BOTH",
      content: "Session done. Tomorrow's plan is adjusted based on today's output.",
      cooldownHours: 48,
      tags: ["post-workout"],
    },
    {
      id: "wc-3",
      category: "WORKOUT_COMPLETED",
      channel: "SMS",
      content: "Solid work. Recovery starts now — hydrate and refuel.",
      cooldownHours: 48,
      tags: ["post-workout"],
    },
    {
      id: "wc-4",
      category: "WORKOUT_COMPLETED",
      channel: "BOTH",
      content: "{{firstName}}, session complete. Your data is logged and your next session is calibrated.",
      cooldownHours: 48,
      tags: ["post-workout"],
    },
    {
      id: "wc-5",
      category: "WORKOUT_COMPLETED",
      channel: "SMS",
      content: "Done. That's {{completedCount}} sessions this week. Building momentum.",
      cooldownHours: 48,
      tags: ["post-workout", "metrics"],
    },
    {
      id: "wc-6",
      category: "WORKOUT_COMPLETED",
      channel: "BOTH",
      content: "Another one in the books. The plan adapts — you just keep showing up.",
      cooldownHours: 48,
      tags: ["post-workout"],
    },
    {
      id: "wc-7",
      category: "WORKOUT_COMPLETED",
      channel: "SMS",
      content: "Session logged. Your consistency this week is on point.",
      cooldownHours: 48,
      tags: ["post-workout"],
    },
    {
      id: "wc-8",
      category: "WORKOUT_COMPLETED",
      channel: "BOTH",
      content: "Good work, {{firstName}}. Your next session builds on what you just did.",
      cooldownHours: 48,
      tags: ["post-workout"],
    },
    {
      id: "wc-9",
      category: "WORKOUT_COMPLETED",
      channel: "SMS",
      content: "Completed. Your body is adapting. Trust the timeline.",
      cooldownHours: 72,
      tags: ["post-workout"],
    },
    {
      id: "wc-10",
      category: "WORKOUT_COMPLETED",
      channel: "SMS",
      content: "That's the work. Now prioritize recovery — sleep, hydration, nutrition.",
      cooldownHours: 48,
      tags: ["post-workout", "recovery"],
    },
    {
      id: "wc-11",
      category: "WORKOUT_COMPLETED",
      channel: "BOTH",
      content: "Done and logged. Small wins stack into real transformation.",
      cooldownHours: 72,
      tags: ["post-workout"],
    },
    {
      id: "wc-12",
      category: "WORKOUT_COMPLETED",
      channel: "BOTH",
      content: "{{workoutTitle}} — complete. The data shapes your next workout automatically.",
      cooldownHours: 24,
      tags: ["post-workout", "specific"],
    },
    {
      id: "wc-13",
      category: "WORKOUT_COMPLETED",
      channel: "SMS",
      content: "Locked in. That's the kind of consistency that moves the needle.",
      cooldownHours: 72,
      tags: ["post-workout"],
    },
    {
      id: "wc-14",
      category: "WORKOUT_COMPLETED",
      channel: "SMS",
      content: "Workout complete. Take the win and recover well tonight.",
      cooldownHours: 48,
      tags: ["post-workout", "evening"],
    },
    {
      id: "wc-15",
      category: "WORKOUT_COMPLETED",
      channel: "BOTH",
      content: "{{firstName}}, that session matters more than you think. Progress logged.",
      cooldownHours: 72,
      tags: ["post-workout"],
    },
  ],

  // ============================================================
  // WORKOUT_MISSED — 12 templates
  // ============================================================
  WORKOUT_MISSED: [
    {
      id: "wm-1",
      category: "WORKOUT_MISSED",
      channel: "BOTH",
      content: "Noticed yesterday's session didn't happen. No stress — today's plan is recalibrated.",
      cooldownHours: 24,
      tags: ["missed"],
    },
    {
      id: "wm-2",
      category: "WORKOUT_MISSED",
      channel: "BOTH",
      content: "Life happens. Plan's been shifted to keep you on track without overload.",
      cooldownHours: 24,
      tags: ["missed"],
    },
    {
      id: "wm-3",
      category: "WORKOUT_MISSED",
      channel: "SMS",
      content: "Missed session noted. Your plan has been adjusted — no catching up needed.",
      cooldownHours: 24,
      tags: ["missed"],
    },
    {
      id: "wm-4",
      category: "WORKOUT_MISSED",
      channel: "BOTH",
      content: "{{firstName}}, yesterday didn't go as planned. That's fine — the system adapts. Today is what matters.",
      cooldownHours: 24,
      tags: ["missed"],
    },
    {
      id: "wm-5",
      category: "WORKOUT_MISSED",
      channel: "SMS",
      content: "Session missed. Your plan is restructured. Just pick up where we left off.",
      cooldownHours: 24,
      tags: ["missed"],
    },
    {
      id: "wm-6",
      category: "WORKOUT_MISSED",
      channel: "BOTH",
      content: "No judgment. The plan accounts for this. Tomorrow's session is ready when you are.",
      cooldownHours: 48,
      tags: ["missed"],
    },
    {
      id: "wm-7",
      category: "WORKOUT_MISSED",
      channel: "SMS",
      content: "Missed one. The plan is adjusted so you don't need to compensate. Just resume.",
      cooldownHours: 24,
      tags: ["missed"],
    },
    {
      id: "wm-8",
      category: "WORKOUT_MISSED",
      channel: "BOTH",
      content: "Yesterday's session didn't happen — noted. Your week is re-balanced automatically.",
      cooldownHours: 24,
      tags: ["missed"],
    },
    {
      id: "wm-9",
      category: "WORKOUT_MISSED",
      channel: "SMS",
      content: "One missed session isn't a setback. The plan is already recalibrated, {{firstName}}.",
      cooldownHours: 24,
      tags: ["missed"],
    },
    {
      id: "wm-10",
      category: "WORKOUT_MISSED",
      channel: "BOTH",
      content: "The plan has shifted to accommodate yesterday. No need to double up — just show up today.",
      cooldownHours: 24,
      tags: ["missed"],
    },
    {
      id: "wm-11",
      category: "WORKOUT_MISSED",
      channel: "SMS",
      content: "Missed session logged. Your program adapts — no guilt, just recalibration.",
      cooldownHours: 24,
      tags: ["missed"],
    },
    {
      id: "wm-12",
      category: "WORKOUT_MISSED",
      channel: "BOTH",
      content: "{{firstName}}, everything okay? Yesterday's session was missed. Plan is adjusted — ready when you are.",
      cooldownHours: 48,
      tags: ["missed", "concern"],
    },
  ],

  // ============================================================
  // ESCALATION — 8 templates
  // ============================================================
  ESCALATION: [
    {
      id: "esc-1",
      category: "ESCALATION",
      channel: "BOTH",
      content: "A few sessions missed this week, {{firstName}}. Everything good? Let's recalibrate — book a quick check-in: {{bookingLink}}",
      cooldownHours: 72,
      tags: ["escalation"],
    },
    {
      id: "esc-2",
      category: "ESCALATION",
      channel: "BOTH",
      content: "{{firstName}}, noticed a pattern of missed sessions. Want to talk through what's going on? {{bookingLink}}",
      cooldownHours: 72,
      tags: ["escalation"],
    },
    {
      id: "esc-3",
      category: "ESCALATION",
      channel: "BOTH",
      content: "Hey {{firstName}} — haven't seen you in a few sessions. No pressure, but I'm here if you want to adjust the plan: {{bookingLink}}",
      cooldownHours: 72,
      tags: ["escalation"],
    },
    {
      id: "esc-4",
      category: "ESCALATION",
      channel: "SMS",
      content: "{{firstName}}, the plan works best when you work the plan. Let's connect and make sure it still fits: {{bookingLink}}",
      cooldownHours: 72,
      tags: ["escalation"],
    },
    {
      id: "esc-5",
      category: "ESCALATION",
      channel: "BOTH",
      content: "Checking in, {{firstName}}. A few missed sessions — want to adjust things? Quick call might help: {{bookingLink}}",
      cooldownHours: 72,
      tags: ["escalation"],
    },
    {
      id: "esc-6",
      category: "ESCALATION",
      channel: "EMAIL",
      content: "{{firstName}} — your training has paused. That's okay, but let's make sure the plan still serves you. A quick 10-minute call can recalibrate everything: {{bookingLink}}",
      cooldownHours: 72,
      tags: ["escalation"],
    },
    {
      id: "esc-7",
      category: "ESCALATION",
      channel: "SMS",
      content: "Haven't seen activity in a bit, {{firstName}}. Let's regroup — 10 minutes to recalibrate: {{bookingLink}}",
      cooldownHours: 72,
      tags: ["escalation"],
    },
    {
      id: "esc-8",
      category: "ESCALATION",
      channel: "BOTH",
      content: "{{firstName}}, consistency dropped this week. No lecture — just want to help. Book a quick check-in: {{bookingLink}}",
      cooldownHours: 72,
      tags: ["escalation"],
    },
  ],

  // ============================================================
  // MOTIVATION — 15 templates
  // ============================================================
  MOTIVATION: [
    {
      id: "mot-1",
      category: "MOTIVATION",
      channel: "SMS",
      content: "The days you least want to train are often the ones that matter most.",
      cooldownHours: 168,
      tags: ["morning"],
    },
    {
      id: "mot-2",
      category: "MOTIVATION",
      channel: "SMS",
      content: "Your plan is loaded for today. Show up and let the structure do its job.",
      cooldownHours: 168,
      tags: ["morning"],
    },
    {
      id: "mot-3",
      category: "MOTIVATION",
      channel: "SMS",
      content: "Progress is quiet. It compounds in the sessions nobody sees.",
      cooldownHours: 168,
      tags: ["morning"],
    },
    {
      id: "mot-4",
      category: "MOTIVATION",
      channel: "SMS",
      content: "You don't need to feel motivated. You need to be disciplined. That's the difference.",
      cooldownHours: 168,
      tags: ["morning"],
    },
    {
      id: "mot-5",
      category: "MOTIVATION",
      channel: "SMS",
      content: "Your body adapts to the demands you place on it. Today's session is one more signal.",
      cooldownHours: 168,
      tags: ["morning"],
    },
    {
      id: "mot-6",
      category: "MOTIVATION",
      channel: "SMS",
      content: "Consistency isn't glamorous. It's just effective.",
      cooldownHours: 168,
      tags: ["morning"],
    },
    {
      id: "mot-7",
      category: "MOTIVATION",
      channel: "SMS",
      content: "Today's session is programmed for a reason. Trust the process, {{firstName}}.",
      cooldownHours: 168,
      tags: ["morning"],
    },
    {
      id: "mot-8",
      category: "MOTIVATION",
      channel: "SMS",
      content: "There are no shortcuts. But there is structure, and structure wins.",
      cooldownHours: 168,
      tags: ["morning"],
    },
    {
      id: "mot-9",
      category: "MOTIVATION",
      channel: "SMS",
      content: "Every session logged is data. Every rep is a signal. Keep showing up.",
      cooldownHours: 168,
      tags: ["morning"],
    },
    {
      id: "mot-10",
      category: "MOTIVATION",
      channel: "SMS",
      content: "{{firstName}}, your plan doesn't need motivation. It needs execution.",
      cooldownHours: 168,
      tags: ["morning"],
    },
    {
      id: "mot-11",
      category: "MOTIVATION",
      channel: "SMS",
      content: "Identity is built through action. Train today.",
      cooldownHours: 168,
      tags: ["morning"],
    },
    {
      id: "mot-12",
      category: "MOTIVATION",
      channel: "SMS",
      content: "The compound effect of consistent training is staggering. Stay the course.",
      cooldownHours: 168,
      tags: ["morning"],
    },
    {
      id: "mot-13",
      category: "MOTIVATION",
      channel: "SMS",
      content: "Good morning, {{firstName}}. Session's ready when you are.",
      cooldownHours: 168,
      tags: ["morning"],
    },
    {
      id: "mot-14",
      category: "MOTIVATION",
      channel: "SMS",
      content: "You chose this. That decision is worth honoring.",
      cooldownHours: 168,
      tags: ["morning"],
    },
    {
      id: "mot-15",
      category: "MOTIVATION",
      channel: "SMS",
      content: "Rest when the plan says rest. Push when the plan says push. Trust the system.",
      cooldownHours: 168,
      tags: ["morning"],
    },
  ],

  // ============================================================
  // RECOVERY_TIP — 10 templates
  // ============================================================
  RECOVERY_TIP: [
    {
      id: "rt-1",
      category: "RECOVERY_TIP",
      channel: "BOTH",
      content: "Recovery reminder: 7-9 hours of sleep is where the real gains happen.",
      cooldownHours: 168,
      tags: ["evening", "sleep"],
    },
    {
      id: "rt-2",
      category: "RECOVERY_TIP",
      channel: "SMS",
      content: "Hydration check — aim for at least half your bodyweight in ounces today.",
      cooldownHours: 168,
      tags: ["morning", "hydration"],
    },
    {
      id: "rt-3",
      category: "RECOVERY_TIP",
      channel: "SMS",
      content: "If you're sore from yesterday, light movement beats sitting still. A 15-min walk works.",
      cooldownHours: 168,
      tags: ["morning", "mobility"],
    },
    {
      id: "rt-4",
      category: "RECOVERY_TIP",
      channel: "BOTH",
      content: "Sleep is your #1 recovery tool. Prioritize it like you prioritize your training.",
      cooldownHours: 168,
      tags: ["evening", "sleep"],
    },
    {
      id: "rt-5",
      category: "RECOVERY_TIP",
      channel: "SMS",
      content: "Post-workout nutrition matters: protein within 2 hours. Don't overthink it — just do it.",
      cooldownHours: 168,
      tags: ["post-workout", "nutrition"],
    },
    {
      id: "rt-6",
      category: "RECOVERY_TIP",
      channel: "BOTH",
      content: "{{firstName}}, your body rebuilds between sessions, not during them. Prioritize downtime today.",
      cooldownHours: 168,
      tags: ["rest-day"],
    },
    {
      id: "rt-7",
      category: "RECOVERY_TIP",
      channel: "SMS",
      content: "Foam rolling for 10 minutes tonight will pay dividends tomorrow. Worth the time.",
      cooldownHours: 168,
      tags: ["evening", "mobility"],
    },
    {
      id: "rt-8",
      category: "RECOVERY_TIP",
      channel: "BOTH",
      content: "Stress impacts recovery more than most realize. Deep breathing for 5 minutes can lower cortisol significantly.",
      cooldownHours: 168,
      tags: ["evening", "stress"],
    },
    {
      id: "rt-9",
      category: "RECOVERY_TIP",
      channel: "SMS",
      content: "Rest day doesn't mean do-nothing day. Light mobility work keeps you primed for tomorrow.",
      cooldownHours: 168,
      tags: ["rest-day", "mobility"],
    },
    {
      id: "rt-10",
      category: "RECOVERY_TIP",
      channel: "BOTH",
      content: "Your sleep score was {{sleepScore}} — if that's trending down, it's worth addressing before volume goes up.",
      cooldownHours: 48,
      tags: ["morning", "data"],
    },
  ],

  // ============================================================
  // CHECK_IN — 8 templates
  // ============================================================
  CHECK_IN: [
    {
      id: "ci-1",
      category: "CHECK_IN",
      channel: "SMS",
      content: "Quick 30-second check-in will help tune today's plan: {{checkInLink}}",
      cooldownHours: 24,
      tags: ["morning"],
    },
    {
      id: "ci-2",
      category: "CHECK_IN",
      channel: "SMS",
      content: "{{firstName}}, a quick readiness check-in helps your plan adapt. Energy, sleep, soreness — takes 30 seconds: {{checkInLink}}",
      cooldownHours: 24,
      tags: ["morning"],
    },
    {
      id: "ci-3",
      category: "CHECK_IN",
      channel: "SMS",
      content: "Morning, {{firstName}}. Drop a quick check-in so your plan can adjust for today: {{checkInLink}}",
      cooldownHours: 24,
      tags: ["morning"],
    },
    {
      id: "ci-4",
      category: "CHECK_IN",
      channel: "SMS",
      content: "Haven't seen your check-in today. A quick log helps keep your plan dialed in: {{checkInLink}}",
      cooldownHours: 24,
      tags: ["afternoon", "reminder"],
    },
    {
      id: "ci-5",
      category: "CHECK_IN",
      channel: "SMS",
      content: "Your plan adapts best with daily data. Quick check-in before your session? {{checkInLink}}",
      cooldownHours: 24,
      tags: ["morning"],
    },
    {
      id: "ci-6",
      category: "CHECK_IN",
      channel: "SMS",
      content: "30 seconds: energy, sleep, soreness. That's all the system needs to optimize your day: {{checkInLink}}",
      cooldownHours: 24,
      tags: ["morning"],
    },
    {
      id: "ci-7",
      category: "CHECK_IN",
      channel: "SMS",
      content: "{{firstName}} — your daily check-in shapes today's workout intensity. Worth the 30 seconds: {{checkInLink}}",
      cooldownHours: 24,
      tags: ["morning"],
    },
    {
      id: "ci-8",
      category: "CHECK_IN",
      channel: "SMS",
      content: "The more data your plan has, the better it adapts. Quick check-in when you get a moment: {{checkInLink}}",
      cooldownHours: 24,
      tags: ["afternoon"],
    },
  ],

  // ============================================================
  // SYSTEM — 3 templates (kept for system notifications)
  // ============================================================
  SYSTEM: [
    {
      id: "sys-1",
      category: "SYSTEM",
      channel: "BOTH",
      content: "Your weekly plan has been updated. Check your dashboard for this week's sessions.",
      cooldownHours: 168,
      tags: ["system"],
    },
    {
      id: "sys-2",
      category: "SYSTEM",
      channel: "BOTH",
      content: "Plan adjustment: today's session has been modified based on your readiness data.",
      cooldownHours: 24,
      tags: ["system", "adjustment"],
    },
    {
      id: "sys-3",
      category: "SYSTEM",
      channel: "EMAIL",
      content: "Your subscription is active. All systems running.",
      cooldownHours: 720,
      tags: ["system"],
    },
  ],

  // ============================================================
  // HUMOR — 3 templates
  // ============================================================
  HUMOR: [
    {
      id: "humor-1",
      category: "HUMOR",
      channel: "SMS",
      content: "Rest day. Yes, that means rest. Put the dumbbells down, {{firstName}}.",
      cooldownHours: 168,
      tags: ["rest-day"],
    },
    {
      id: "humor-2",
      category: "HUMOR",
      channel: "SMS",
      content: "Your plan says recovery today. Fight the urge to 'just do a quick one.'",
      cooldownHours: 168,
      tags: ["rest-day"],
    },
    {
      id: "humor-3",
      category: "HUMOR",
      channel: "SMS",
      content: "Reminder: the gym will be there tomorrow. Today, be horizontal.",
      cooldownHours: 168,
      tags: ["rest-day"],
    },
  ],

  // ============================================================
  // EDUCATION — 3 templates
  // ============================================================
  EDUCATION: [
    {
      id: "edu-1",
      category: "EDUCATION",
      channel: "BOTH",
      content: "Progressive overload doesn't always mean more weight. More reps, better form, and shorter rest all count.",
      cooldownHours: 168,
      tags: ["education"],
    },
    {
      id: "edu-2",
      category: "EDUCATION",
      channel: "BOTH",
      content: "Zone 2 cardio builds the aerobic base that powers everything else. It should feel easy — that's the point.",
      cooldownHours: 168,
      tags: ["education", "endurance"],
    },
    {
      id: "edu-3",
      category: "EDUCATION",
      channel: "BOTH",
      content: "RPE 7 means you could do 3 more reps. RPE 9 means maybe 1 more. Calibrate accordingly.",
      cooldownHours: 168,
      tags: ["education"],
    },
  ],

  // ============================================================
  // ACCOUNTABILITY — 3 templates
  // ============================================================
  ACCOUNTABILITY: [
    {
      id: "acc-1",
      category: "ACCOUNTABILITY",
      channel: "SMS",
      content: "{{firstName}}, you committed to {{trainingDaysPerWeek}} days this week. Today is one of them.",
      cooldownHours: 168,
      tags: ["morning"],
    },
    {
      id: "acc-2",
      category: "ACCOUNTABILITY",
      channel: "SMS",
      content: "Your adherence this week: {{adherenceRate}}. The plan works when you work the plan.",
      cooldownHours: 168,
      tags: ["morning", "metrics"],
    },
    {
      id: "acc-3",
      category: "ACCOUNTABILITY",
      channel: "SMS",
      content: "Session scheduled for today, {{firstName}}. The structure is there — your job is to show up.",
      cooldownHours: 168,
      tags: ["morning"],
    },
  ],
};

/**
 * Flat fallback format for ai.service.ts compatibility.
 * Maps category → array of { id, content }.
 */
export const fallbackTemplates: Record<string, { id: string; content: string }[]> =
  Object.fromEntries(
    Object.entries(messageTemplates).map(([category, templates]) => [
      category,
      templates.map((t) => ({ id: t.id, content: t.content })),
    ])
  );
