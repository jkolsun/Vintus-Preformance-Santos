/**
 * Exercise Library — typed exercise templates for workout generation.
 * Used by workout.service.ts to build session content JSON.
 *
 * Minimum requirements:
 * - 6 upper body strength (3 push, 3 pull)
 * - 4 lower body strength
 * - 4 full body strength
 * - 4 Zone 2 endurance
 * - 3 interval/tempo endurance
 * - 3 HIIT
 * - 3 mobility/recovery
 */

// ============================================================
// Types
// ============================================================

export interface WarmupExercise {
  exercise: string;
  duration: string;
  notes: string;
}

export interface MainExercise {
  exercise: string;
  sets: number;
  reps: string;
  rest: string;
  intensity: string;
  notes?: string;
}

export interface CooldownExercise {
  exercise: string;
  duration: string;
}

export interface SessionTemplate {
  id: string;
  sessionType: string;
  label: string;
  equipment: "full-gym" | "home-gym" | "minimal" | "bodyweight-only";
  warmup: WarmupExercise[];
  main: MainExercise[];
  cooldown: CooldownExercise[];
  estimatedDuration: number;
  estimatedTSS: number;
}

// ============================================================
// Experience-level volume/intensity modifiers
// ============================================================

export interface ExperienceModifiers {
  setsMultiplier: number;
  restMultiplier: number;
  intensityLabel: string;
  repRange: string;
}

export const EXPERIENCE_MODIFIERS: Record<string, ExperienceModifiers> = {
  beginner: {
    setsMultiplier: 0.75,   // 3 sets → ~3 (floor applied)
    restMultiplier: 1.5,    // longer rest
    intensityLabel: "RPE 6",
    repRange: "10-12",
  },
  intermediate: {
    setsMultiplier: 1.0,
    restMultiplier: 1.0,
    intensityLabel: "RPE 7",
    repRange: "8-10",
  },
  advanced: {
    setsMultiplier: 1.25,
    restMultiplier: 0.85,
    intensityLabel: "RPE 8",
    repRange: "6-8",
  },
  elite: {
    setsMultiplier: 1.5,
    restMultiplier: 0.75,
    intensityLabel: "RPE 8-9",
    repRange: "4-6",
  },
};

// ============================================================
// Standard warmups & cooldowns
// ============================================================

const STRENGTH_WARMUP: WarmupExercise[] = [
  { exercise: "Foam Roll — Full Body", duration: "3 min", notes: "Focus on tight areas" },
  { exercise: "Band Pull-Aparts", duration: "15 reps", notes: "Shoulder activation" },
  { exercise: "Bodyweight Squats", duration: "10 reps", notes: "Hip and ankle mobility" },
  { exercise: "Cat-Cow", duration: "8 reps", notes: "Spinal mobility" },
];

const UPPER_WARMUP: WarmupExercise[] = [
  { exercise: "Arm Circles", duration: "30 sec each direction", notes: "Progressive range" },
  { exercise: "Band Pull-Aparts", duration: "15 reps", notes: "Rear delt activation" },
  { exercise: "Push-up to Downward Dog", duration: "8 reps", notes: "Upper body activation" },
  { exercise: "Scapular Push-ups", duration: "10 reps", notes: "Serratus activation" },
];

const LOWER_WARMUP: WarmupExercise[] = [
  { exercise: "Foam Roll — Quads & Glutes", duration: "2 min", notes: "Focus on tight spots" },
  { exercise: "Hip 90/90 Transitions", duration: "8 each side", notes: "Hip mobility" },
  { exercise: "Glute Bridges", duration: "12 reps", notes: "Glute activation" },
  { exercise: "Walking Lunges", duration: "8 each side", notes: "Dynamic hip stretch" },
];

const ENDURANCE_WARMUP: WarmupExercise[] = [
  { exercise: "Easy Walk/Jog", duration: "5 min", notes: "Gradually increase pace" },
  { exercise: "Leg Swings", duration: "10 each side", notes: "Front-to-back and lateral" },
  { exercise: "High Knees", duration: "30 sec", notes: "Light, controlled" },
];

const HIIT_WARMUP: WarmupExercise[] = [
  { exercise: "Jumping Jacks", duration: "1 min", notes: "Easy pace" },
  { exercise: "High Knees", duration: "30 sec", notes: "Build tempo" },
  { exercise: "Arm Circles", duration: "30 sec", notes: "Both directions" },
  { exercise: "Bodyweight Squats", duration: "10 reps", notes: "Full depth" },
  { exercise: "Inchworms", duration: "5 reps", notes: "Pause at push-up position" },
];

const STRENGTH_COOLDOWN: CooldownExercise[] = [
  { exercise: "Static Stretch — Worked Muscles", duration: "3 min" },
  { exercise: "Deep Breathing", duration: "2 min" },
];

const ENDURANCE_COOLDOWN: CooldownExercise[] = [
  { exercise: "Easy Walk", duration: "3 min" },
  { exercise: "Static Stretch — Lower Body", duration: "3 min" },
  { exercise: "Deep Breathing", duration: "2 min" },
];

const HIIT_COOLDOWN: CooldownExercise[] = [
  { exercise: "Walk It Out", duration: "2 min" },
  { exercise: "Full Body Static Stretch", duration: "4 min" },
  { exercise: "Controlled Breathing", duration: "2 min" },
];

// ============================================================
// UPPER BODY STRENGTH — PUSH FOCUSED (3)
// ============================================================

const UPPER_PUSH_GYM: SessionTemplate[] = [
  {
    id: "upper-push-gym-1",
    sessionType: "STRENGTH_PUSH",
    label: "Push Strength A — Horizontal Press Focus",
    equipment: "full-gym",
    warmup: UPPER_WARMUP,
    main: [
      { exercise: "Barbell Bench Press", sets: 4, reps: "8-10", rest: "90s", intensity: "RPE 7" },
      { exercise: "Incline Dumbbell Press", sets: 3, reps: "10-12", rest: "75s", intensity: "RPE 7" },
      { exercise: "Cable Flyes", sets: 3, reps: "12-15", rest: "60s", intensity: "RPE 7" },
      { exercise: "Overhead Press", sets: 3, reps: "8-10", rest: "90s", intensity: "RPE 7" },
      { exercise: "Tricep Pushdowns", sets: 3, reps: "12-15", rest: "60s", intensity: "RPE 7" },
    ],
    cooldown: STRENGTH_COOLDOWN,
    estimatedDuration: 50,
    estimatedTSS: 65,
  },
  {
    id: "upper-push-gym-2",
    sessionType: "STRENGTH_PUSH",
    label: "Push Strength B — Vertical Press Focus",
    equipment: "full-gym",
    warmup: UPPER_WARMUP,
    main: [
      { exercise: "Overhead Press", sets: 4, reps: "6-8", rest: "120s", intensity: "RPE 8" },
      { exercise: "Dumbbell Bench Press", sets: 3, reps: "10-12", rest: "75s", intensity: "RPE 7" },
      { exercise: "Landmine Press", sets: 3, reps: "10-12", rest: "60s", intensity: "RPE 7" },
      { exercise: "Lateral Raises", sets: 3, reps: "12-15", rest: "45s", intensity: "RPE 7" },
      { exercise: "Overhead Tricep Extension", sets: 3, reps: "12-15", rest: "60s", intensity: "RPE 7" },
    ],
    cooldown: STRENGTH_COOLDOWN,
    estimatedDuration: 50,
    estimatedTSS: 65,
  },
  {
    id: "upper-push-bw-1",
    sessionType: "STRENGTH_PUSH",
    label: "Push Strength — Bodyweight",
    equipment: "bodyweight-only",
    warmup: UPPER_WARMUP,
    main: [
      { exercise: "Push-ups", sets: 4, reps: "12-15", rest: "60s", intensity: "RPE 7", notes: "Full range of motion" },
      { exercise: "Pike Push-ups", sets: 3, reps: "8-10", rest: "75s", intensity: "RPE 7", notes: "Feet elevated for more difficulty" },
      { exercise: "Diamond Push-ups", sets: 3, reps: "10-12", rest: "60s", intensity: "RPE 7" },
      { exercise: "Bench Dips", sets: 3, reps: "12-15", rest: "60s", intensity: "RPE 7" },
      { exercise: "Plank Shoulder Taps", sets: 3, reps: "20 total", rest: "45s", intensity: "RPE 6" },
    ],
    cooldown: STRENGTH_COOLDOWN,
    estimatedDuration: 45,
    estimatedTSS: 55,
  },
];

// ============================================================
// UPPER BODY STRENGTH — PULL FOCUSED (3)
// ============================================================

const UPPER_PULL_GYM: SessionTemplate[] = [
  {
    id: "upper-pull-gym-1",
    sessionType: "STRENGTH_PULL",
    label: "Pull Strength A — Horizontal Pull Focus",
    equipment: "full-gym",
    warmup: UPPER_WARMUP,
    main: [
      { exercise: "Barbell Rows", sets: 4, reps: "8-10", rest: "90s", intensity: "RPE 7" },
      { exercise: "Seated Cable Rows", sets: 3, reps: "10-12", rest: "75s", intensity: "RPE 7" },
      { exercise: "Face Pulls", sets: 3, reps: "15-20", rest: "45s", intensity: "RPE 6" },
      { exercise: "Dumbbell Curls", sets: 3, reps: "10-12", rest: "60s", intensity: "RPE 7" },
      { exercise: "Hammer Curls", sets: 3, reps: "10-12", rest: "60s", intensity: "RPE 7" },
    ],
    cooldown: STRENGTH_COOLDOWN,
    estimatedDuration: 50,
    estimatedTSS: 60,
  },
  {
    id: "upper-pull-gym-2",
    sessionType: "STRENGTH_PULL",
    label: "Pull Strength B — Vertical Pull Focus",
    equipment: "full-gym",
    warmup: UPPER_WARMUP,
    main: [
      { exercise: "Weighted Pull-ups", sets: 4, reps: "6-8", rest: "120s", intensity: "RPE 8" },
      { exercise: "Lat Pulldowns", sets: 3, reps: "10-12", rest: "75s", intensity: "RPE 7" },
      { exercise: "Single-Arm Dumbbell Row", sets: 3, reps: "10-12 each", rest: "60s", intensity: "RPE 7" },
      { exercise: "Face Pulls", sets: 3, reps: "15-20", rest: "45s", intensity: "RPE 6" },
      { exercise: "Barbell Curls", sets: 3, reps: "8-10", rest: "60s", intensity: "RPE 7" },
    ],
    cooldown: STRENGTH_COOLDOWN,
    estimatedDuration: 50,
    estimatedTSS: 65,
  },
  {
    id: "upper-pull-bw-1",
    sessionType: "STRENGTH_PULL",
    label: "Pull Strength — Bodyweight",
    equipment: "bodyweight-only",
    warmup: UPPER_WARMUP,
    main: [
      { exercise: "Inverted Rows", sets: 4, reps: "10-12", rest: "60s", intensity: "RPE 7", notes: "Adjust angle for difficulty" },
      { exercise: "Chin-up Negatives", sets: 3, reps: "5-6", rest: "90s", intensity: "RPE 8", notes: "5 sec lowering phase" },
      { exercise: "Superman Hold", sets: 3, reps: "30 sec", rest: "45s", intensity: "RPE 6" },
      { exercise: "Band Face Pulls", sets: 3, reps: "15-20", rest: "45s", intensity: "RPE 6" },
      { exercise: "Dead Hang", sets: 3, reps: "30 sec", rest: "60s", intensity: "RPE 6" },
    ],
    cooldown: STRENGTH_COOLDOWN,
    estimatedDuration: 45,
    estimatedTSS: 50,
  },
];

// ============================================================
// UPPER BODY — COMBINED (for STRENGTH_UPPER type)
// ============================================================

const UPPER_COMBINED_GYM: SessionTemplate[] = [
  {
    id: "upper-combined-gym-1",
    sessionType: "STRENGTH_UPPER",
    label: "Upper Body A — Balanced Push/Pull",
    equipment: "full-gym",
    warmup: UPPER_WARMUP,
    main: [
      { exercise: "Barbell Bench Press", sets: 4, reps: "8-10", rest: "90s", intensity: "RPE 7" },
      { exercise: "Barbell Rows", sets: 4, reps: "8-10", rest: "90s", intensity: "RPE 7" },
      { exercise: "Overhead Press", sets: 3, reps: "8-10", rest: "75s", intensity: "RPE 7" },
      { exercise: "Lat Pulldowns", sets: 3, reps: "10-12", rest: "60s", intensity: "RPE 7" },
      { exercise: "Face Pulls", sets: 3, reps: "15-20", rest: "45s", intensity: "RPE 6" },
      { exercise: "Dumbbell Curls", sets: 2, reps: "12-15", rest: "45s", intensity: "RPE 6" },
    ],
    cooldown: STRENGTH_COOLDOWN,
    estimatedDuration: 55,
    estimatedTSS: 70,
  },
  {
    id: "upper-combined-gym-2",
    sessionType: "STRENGTH_UPPER",
    label: "Upper Body B — Volume Focus",
    equipment: "full-gym",
    warmup: UPPER_WARMUP,
    main: [
      { exercise: "Incline Dumbbell Press", sets: 4, reps: "10-12", rest: "75s", intensity: "RPE 7" },
      { exercise: "Seated Cable Rows", sets: 4, reps: "10-12", rest: "75s", intensity: "RPE 7" },
      { exercise: "Dumbbell Shoulder Press", sets: 3, reps: "10-12", rest: "60s", intensity: "RPE 7" },
      { exercise: "Cable Flyes", sets: 3, reps: "12-15", rest: "60s", intensity: "RPE 6" },
      { exercise: "Lateral Raises", sets: 3, reps: "12-15", rest: "45s", intensity: "RPE 7" },
      { exercise: "Tricep Pushdowns", sets: 3, reps: "12-15", rest: "45s", intensity: "RPE 6" },
    ],
    cooldown: STRENGTH_COOLDOWN,
    estimatedDuration: 55,
    estimatedTSS: 68,
  },
  {
    id: "upper-combined-bw-1",
    sessionType: "STRENGTH_UPPER",
    label: "Upper Body — Bodyweight",
    equipment: "bodyweight-only",
    warmup: UPPER_WARMUP,
    main: [
      { exercise: "Push-ups", sets: 4, reps: "12-15", rest: "60s", intensity: "RPE 7" },
      { exercise: "Inverted Rows", sets: 4, reps: "10-12", rest: "60s", intensity: "RPE 7" },
      { exercise: "Pike Push-ups", sets: 3, reps: "8-10", rest: "75s", intensity: "RPE 7" },
      { exercise: "Chin-up Negatives", sets: 3, reps: "5-6", rest: "90s", intensity: "RPE 8" },
      { exercise: "Diamond Push-ups", sets: 3, reps: "10-12", rest: "60s", intensity: "RPE 7" },
      { exercise: "Plank Hold", sets: 3, reps: "45 sec", rest: "45s", intensity: "RPE 6" },
    ],
    cooldown: STRENGTH_COOLDOWN,
    estimatedDuration: 45,
    estimatedTSS: 55,
  },
];

// ============================================================
// LOWER BODY STRENGTH (4)
// ============================================================

const LOWER_GYM: SessionTemplate[] = [
  {
    id: "lower-gym-1",
    sessionType: "STRENGTH_LOWER",
    label: "Lower Body A — Squat Emphasis",
    equipment: "full-gym",
    warmup: LOWER_WARMUP,
    main: [
      { exercise: "Barbell Back Squat", sets: 4, reps: "6-8", rest: "120s", intensity: "RPE 8" },
      { exercise: "Romanian Deadlift", sets: 3, reps: "8-10", rest: "90s", intensity: "RPE 7" },
      { exercise: "Walking Lunges", sets: 3, reps: "10 each", rest: "75s", intensity: "RPE 7" },
      { exercise: "Leg Press", sets: 3, reps: "10-12", rest: "75s", intensity: "RPE 7" },
      { exercise: "Calf Raises", sets: 3, reps: "15-20", rest: "45s", intensity: "RPE 7" },
    ],
    cooldown: STRENGTH_COOLDOWN,
    estimatedDuration: 55,
    estimatedTSS: 75,
  },
  {
    id: "lower-gym-2",
    sessionType: "STRENGTH_LOWER",
    label: "Lower Body B — Hinge Emphasis",
    equipment: "full-gym",
    warmup: LOWER_WARMUP,
    main: [
      { exercise: "Barbell Deadlift", sets: 4, reps: "5-6", rest: "150s", intensity: "RPE 8" },
      { exercise: "Front Squat", sets: 3, reps: "8-10", rest: "90s", intensity: "RPE 7" },
      { exercise: "Bulgarian Split Squats", sets: 3, reps: "10 each", rest: "75s", intensity: "RPE 7" },
      { exercise: "Hamstring Curls", sets: 3, reps: "10-12", rest: "60s", intensity: "RPE 7" },
      { exercise: "Calf Raises", sets: 3, reps: "15-20", rest: "45s", intensity: "RPE 7" },
    ],
    cooldown: STRENGTH_COOLDOWN,
    estimatedDuration: 55,
    estimatedTSS: 78,
  },
  {
    id: "lower-bw-1",
    sessionType: "STRENGTH_LOWER",
    label: "Lower Body — Bodyweight A",
    equipment: "bodyweight-only",
    warmup: LOWER_WARMUP,
    main: [
      { exercise: "Bulgarian Split Squats", sets: 4, reps: "12 each", rest: "75s", intensity: "RPE 7" },
      { exercise: "Pistol Squat Progressions", sets: 3, reps: "6-8 each", rest: "90s", intensity: "RPE 8" },
      { exercise: "Glute Bridges", sets: 3, reps: "15-20", rest: "60s", intensity: "RPE 7" },
      { exercise: "Step-ups", sets: 3, reps: "12 each", rest: "60s", intensity: "RPE 7" },
      { exercise: "Single-Leg Calf Raises", sets: 3, reps: "15 each", rest: "45s", intensity: "RPE 7" },
    ],
    cooldown: STRENGTH_COOLDOWN,
    estimatedDuration: 45,
    estimatedTSS: 55,
  },
  {
    id: "lower-bw-2",
    sessionType: "STRENGTH_LOWER",
    label: "Lower Body — Bodyweight B",
    equipment: "bodyweight-only",
    warmup: LOWER_WARMUP,
    main: [
      { exercise: "Jump Squats", sets: 4, reps: "10-12", rest: "75s", intensity: "RPE 7", notes: "Land softly" },
      { exercise: "Single-Leg Deadlift", sets: 3, reps: "10 each", rest: "60s", intensity: "RPE 7" },
      { exercise: "Lateral Lunges", sets: 3, reps: "10 each", rest: "60s", intensity: "RPE 7" },
      { exercise: "Wall Sit", sets: 3, reps: "45 sec", rest: "60s", intensity: "RPE 7" },
      { exercise: "Nordic Curl Negatives", sets: 3, reps: "5-6", rest: "90s", intensity: "RPE 8" },
    ],
    cooldown: STRENGTH_COOLDOWN,
    estimatedDuration: 45,
    estimatedTSS: 58,
  },
];

// ============================================================
// FULL BODY STRENGTH (4)
// ============================================================

const FULL_BODY_GYM: SessionTemplate[] = [
  {
    id: "full-body-gym-1",
    sessionType: "STRENGTH_FULL",
    label: "Full Body A — Compound Focus",
    equipment: "full-gym",
    warmup: STRENGTH_WARMUP,
    main: [
      { exercise: "Barbell Deadlift", sets: 4, reps: "5-6", rest: "150s", intensity: "RPE 8" },
      { exercise: "Dumbbell Bench Press", sets: 3, reps: "8-10", rest: "90s", intensity: "RPE 7" },
      { exercise: "Barbell Squats", sets: 3, reps: "8-10", rest: "120s", intensity: "RPE 7" },
      { exercise: "Pull-ups", sets: 3, reps: "6-8", rest: "90s", intensity: "RPE 7" },
      { exercise: "Dumbbell Shoulder Press", sets: 3, reps: "10-12", rest: "60s", intensity: "RPE 7" },
    ],
    cooldown: STRENGTH_COOLDOWN,
    estimatedDuration: 55,
    estimatedTSS: 80,
  },
  {
    id: "full-body-gym-2",
    sessionType: "STRENGTH_FULL",
    label: "Full Body B — Functional Strength",
    equipment: "full-gym",
    warmup: STRENGTH_WARMUP,
    main: [
      { exercise: "Front Squat", sets: 4, reps: "8-10", rest: "120s", intensity: "RPE 7" },
      { exercise: "Barbell Rows", sets: 3, reps: "8-10", rest: "90s", intensity: "RPE 7" },
      { exercise: "Incline Dumbbell Press", sets: 3, reps: "10-12", rest: "75s", intensity: "RPE 7" },
      { exercise: "Romanian Deadlift", sets: 3, reps: "8-10", rest: "90s", intensity: "RPE 7" },
      { exercise: "Face Pulls", sets: 3, reps: "15-20", rest: "45s", intensity: "RPE 6" },
    ],
    cooldown: STRENGTH_COOLDOWN,
    estimatedDuration: 55,
    estimatedTSS: 75,
  },
  {
    id: "full-body-bw-1",
    sessionType: "STRENGTH_FULL",
    label: "Full Body — Bodyweight A",
    equipment: "bodyweight-only",
    warmup: STRENGTH_WARMUP,
    main: [
      { exercise: "Push-ups", sets: 4, reps: "15-20", rest: "60s", intensity: "RPE 7" },
      { exercise: "Bodyweight Squats", sets: 4, reps: "15-20", rest: "60s", intensity: "RPE 7" },
      { exercise: "Inverted Rows", sets: 3, reps: "10-12", rest: "60s", intensity: "RPE 7" },
      { exercise: "Lunges", sets: 3, reps: "12 each", rest: "60s", intensity: "RPE 7" },
      { exercise: "Plank", sets: 3, reps: "45 sec", rest: "45s", intensity: "RPE 6" },
    ],
    cooldown: STRENGTH_COOLDOWN,
    estimatedDuration: 45,
    estimatedTSS: 55,
  },
  {
    id: "full-body-bw-2",
    sessionType: "STRENGTH_FULL",
    label: "Full Body — Bodyweight B",
    equipment: "bodyweight-only",
    warmup: STRENGTH_WARMUP,
    main: [
      { exercise: "Burpees", sets: 3, reps: "10", rest: "75s", intensity: "RPE 7" },
      { exercise: "Bulgarian Split Squats", sets: 3, reps: "10 each", rest: "60s", intensity: "RPE 7" },
      { exercise: "Diamond Push-ups", sets: 3, reps: "10-12", rest: "60s", intensity: "RPE 7" },
      { exercise: "Glute Bridges", sets: 3, reps: "15-20", rest: "45s", intensity: "RPE 7" },
      { exercise: "Superman Hold", sets: 3, reps: "30 sec", rest: "45s", intensity: "RPE 6" },
      { exercise: "Mountain Climbers", sets: 3, reps: "30 sec", rest: "45s", intensity: "RPE 7" },
    ],
    cooldown: STRENGTH_COOLDOWN,
    estimatedDuration: 45,
    estimatedTSS: 58,
  },
];

// ============================================================
// ZONE 2 ENDURANCE (4)
// ============================================================

const ZONE2: SessionTemplate[] = [
  {
    id: "zone2-run-1",
    sessionType: "ENDURANCE_ZONE2",
    label: "Zone 2 Run — Steady State",
    equipment: "bodyweight-only",
    warmup: ENDURANCE_WARMUP,
    main: [
      { exercise: "Zone 2 Run", sets: 1, reps: "30 min", rest: "—", intensity: "Zone 2 (conversational pace)", notes: "Maintain heart rate in Zone 2. You should be able to hold a conversation." },
    ],
    cooldown: ENDURANCE_COOLDOWN,
    estimatedDuration: 45,
    estimatedTSS: 45,
  },
  {
    id: "zone2-cycle-1",
    sessionType: "ENDURANCE_ZONE2",
    label: "Zone 2 Cycle — Base Building",
    equipment: "full-gym",
    warmup: ENDURANCE_WARMUP,
    main: [
      { exercise: "Stationary Bike — Zone 2", sets: 1, reps: "35 min", rest: "—", intensity: "Zone 2 (60-70% max HR)", notes: "Steady cadence 80-90 RPM. Easy effort." },
    ],
    cooldown: ENDURANCE_COOLDOWN,
    estimatedDuration: 50,
    estimatedTSS: 50,
  },
  {
    id: "zone2-walk-incline-1",
    sessionType: "ENDURANCE_ZONE2",
    label: "Zone 2 Incline Walk",
    equipment: "full-gym",
    warmup: [
      { exercise: "Flat Walk", duration: "3 min", notes: "Easy pace warm-up" },
    ],
    main: [
      { exercise: "Incline Treadmill Walk", sets: 1, reps: "35 min", rest: "—", intensity: "Zone 2 (10-15% incline, 3.0-3.5 mph)", notes: "Keep heart rate in Zone 2. Great low-impact aerobic builder." },
    ],
    cooldown: ENDURANCE_COOLDOWN,
    estimatedDuration: 45,
    estimatedTSS: 42,
  },
  {
    id: "zone2-run-2",
    sessionType: "ENDURANCE_ZONE2",
    label: "Zone 2 Easy Aerobic Run",
    equipment: "bodyweight-only",
    warmup: ENDURANCE_WARMUP,
    main: [
      { exercise: "Easy Aerobic Run", sets: 1, reps: "35 min", rest: "—", intensity: "Zone 2 (nasal breathing pace)", notes: "If you can't breathe through your nose, slow down." },
    ],
    cooldown: ENDURANCE_COOLDOWN,
    estimatedDuration: 50,
    estimatedTSS: 48,
  },
];

// ============================================================
// INTERVAL / TEMPO ENDURANCE (3)
// ============================================================

const INTERVALS: SessionTemplate[] = [
  {
    id: "interval-run-1",
    sessionType: "ENDURANCE_INTERVALS",
    label: "Run Intervals — 4x4 Protocol",
    equipment: "bodyweight-only",
    warmup: ENDURANCE_WARMUP,
    main: [
      { exercise: "4 min Hard Run", sets: 4, reps: "4 min", rest: "3 min jog", intensity: "Zone 4 (85-90% max HR)", notes: "Recovery jog between intervals — don't stop completely." },
    ],
    cooldown: ENDURANCE_COOLDOWN,
    estimatedDuration: 45,
    estimatedTSS: 65,
  },
  {
    id: "tempo-run-1",
    sessionType: "ENDURANCE_TEMPO",
    label: "Tempo Run — Sustained Effort",
    equipment: "bodyweight-only",
    warmup: ENDURANCE_WARMUP,
    main: [
      { exercise: "Tempo Run", sets: 1, reps: "25 min", rest: "—", intensity: "Zone 3 (comfortably hard)", notes: "Hold a steady pace you could maintain for about 45-60 min max. Breathing controlled but deliberate." },
    ],
    cooldown: ENDURANCE_COOLDOWN,
    estimatedDuration: 40,
    estimatedTSS: 55,
  },
  {
    id: "interval-cycle-1",
    sessionType: "ENDURANCE_INTERVALS",
    label: "Bike Intervals — Tabata Style",
    equipment: "full-gym",
    warmup: [
      { exercise: "Easy Spin", duration: "5 min", notes: "Light resistance, build cadence" },
    ],
    main: [
      { exercise: "Bike Sprint Intervals", sets: 8, reps: "30 sec all-out", rest: "30 sec easy spin", intensity: "Zone 5 (90-95% max HR)", notes: "Maximum effort sprints. Full recovery not expected between sets." },
      { exercise: "Moderate Steady Ride", sets: 1, reps: "10 min", rest: "—", intensity: "Zone 3", notes: "Bring heart rate down gradually." },
    ],
    cooldown: ENDURANCE_COOLDOWN,
    estimatedDuration: 35,
    estimatedTSS: 60,
  },
];

// ============================================================
// HIIT (3)
// ============================================================

const HIIT_TEMPLATES: SessionTemplate[] = [
  {
    id: "hiit-gym-1",
    sessionType: "HIIT",
    label: "HIIT Circuit A — Full Gym",
    equipment: "full-gym",
    warmup: HIIT_WARMUP,
    main: [
      { exercise: "Kettlebell Swings", sets: 4, reps: "40 sec", rest: "20s", intensity: "RPE 8" },
      { exercise: "Box Jumps", sets: 4, reps: "40 sec", rest: "20s", intensity: "RPE 8" },
      { exercise: "Battle Ropes", sets: 4, reps: "40 sec", rest: "20s", intensity: "RPE 8" },
      { exercise: "Dumbbell Thrusters", sets: 4, reps: "40 sec", rest: "20s", intensity: "RPE 8" },
      { exercise: "Rowing Sprints", sets: 4, reps: "40 sec", rest: "20s", intensity: "RPE 8" },
    ],
    cooldown: HIIT_COOLDOWN,
    estimatedDuration: 35,
    estimatedTSS: 70,
  },
  {
    id: "hiit-bw-1",
    sessionType: "HIIT",
    label: "HIIT Circuit — Bodyweight",
    equipment: "bodyweight-only",
    warmup: HIIT_WARMUP,
    main: [
      { exercise: "Burpees", sets: 4, reps: "40 sec", rest: "20s", intensity: "RPE 8" },
      { exercise: "Mountain Climbers", sets: 4, reps: "40 sec", rest: "20s", intensity: "RPE 8" },
      { exercise: "Jump Squats", sets: 4, reps: "40 sec", rest: "20s", intensity: "RPE 8" },
      { exercise: "Push-ups", sets: 4, reps: "40 sec", rest: "20s", intensity: "RPE 7" },
      { exercise: "High Knees", sets: 4, reps: "40 sec", rest: "20s", intensity: "RPE 8" },
    ],
    cooldown: HIIT_COOLDOWN,
    estimatedDuration: 30,
    estimatedTSS: 65,
  },
  {
    id: "hiit-gym-2",
    sessionType: "HIIT",
    label: "HIIT Circuit B — Metabolic",
    equipment: "full-gym",
    warmup: HIIT_WARMUP,
    main: [
      { exercise: "Sled Push", sets: 4, reps: "30 sec", rest: "30s", intensity: "RPE 8" },
      { exercise: "Medicine Ball Slams", sets: 4, reps: "30 sec", rest: "30s", intensity: "RPE 8" },
      { exercise: "Assault Bike Sprint", sets: 4, reps: "30 sec", rest: "30s", intensity: "RPE 9" },
      { exercise: "Farmer's Carry", sets: 4, reps: "40 sec", rest: "20s", intensity: "RPE 7" },
      { exercise: "Plank to Push-up", sets: 4, reps: "30 sec", rest: "30s", intensity: "RPE 7" },
    ],
    cooldown: HIIT_COOLDOWN,
    estimatedDuration: 35,
    estimatedTSS: 72,
  },
];

// ============================================================
// MOBILITY / RECOVERY (3)
// ============================================================

const MOBILITY: SessionTemplate[] = [
  {
    id: "mobility-1",
    sessionType: "MOBILITY_RECOVERY",
    label: "Mobility Flow A — Full Body",
    equipment: "bodyweight-only",
    warmup: [
      { exercise: "Easy Walk", duration: "3 min", notes: "Get blood flowing" },
    ],
    main: [
      { exercise: "Foam Roll — Full Body", sets: 1, reps: "8 min", rest: "—", intensity: "Low", notes: "Spend extra time on tight areas" },
      { exercise: "Hip 90/90 Stretch", sets: 2, reps: "45 sec each side", rest: "—", intensity: "Low" },
      { exercise: "Cat-Cow", sets: 2, reps: "10 reps", rest: "—", intensity: "Low" },
      { exercise: "World's Greatest Stretch", sets: 2, reps: "5 each side", rest: "—", intensity: "Low" },
      { exercise: "Deep Squat Hold", sets: 3, reps: "30 sec", rest: "—", intensity: "Low" },
      { exercise: "Dead Hang", sets: 3, reps: "20-30 sec", rest: "—", intensity: "Low" },
    ],
    cooldown: [
      { exercise: "Supine Spinal Twist", duration: "2 min" },
      { exercise: "Diaphragmatic Breathing", duration: "3 min" },
    ],
    estimatedDuration: 30,
    estimatedTSS: 15,
  },
  {
    id: "mobility-2",
    sessionType: "ACTIVE_RECOVERY",
    label: "Active Recovery — Light Movement",
    equipment: "bodyweight-only",
    warmup: [
      { exercise: "Easy Walk", duration: "5 min", notes: "Relaxed pace" },
    ],
    main: [
      { exercise: "Walking", sets: 1, reps: "15 min", rest: "—", intensity: "Very Low", notes: "Conversational pace, outdoors if possible" },
      { exercise: "Foam Roll — Lower Body", sets: 1, reps: "5 min", rest: "—", intensity: "Low" },
      { exercise: "Pigeon Stretch", sets: 2, reps: "45 sec each side", rest: "—", intensity: "Low" },
      { exercise: "Child's Pose", sets: 2, reps: "30 sec", rest: "—", intensity: "Low" },
    ],
    cooldown: [
      { exercise: "Box Breathing", duration: "3 min" },
    ],
    estimatedDuration: 30,
    estimatedTSS: 10,
  },
  {
    id: "mobility-3",
    sessionType: "MOBILITY_RECOVERY",
    label: "Mobility Flow B — Lower Body Focus",
    equipment: "bodyweight-only",
    warmup: [
      { exercise: "Easy Walk", duration: "3 min", notes: "Get blood flowing" },
    ],
    main: [
      { exercise: "Foam Roll — Quads, Hamstrings, Glutes", sets: 1, reps: "8 min", rest: "—", intensity: "Low" },
      { exercise: "Couch Stretch", sets: 2, reps: "45 sec each side", rest: "—", intensity: "Low" },
      { exercise: "Banded Hip Distraction", sets: 2, reps: "30 sec each side", rest: "—", intensity: "Low" },
      { exercise: "Cossack Squats", sets: 2, reps: "8 each side", rest: "—", intensity: "Low" },
      { exercise: "Ankle Mobility Circles", sets: 2, reps: "10 each direction", rest: "—", intensity: "Low" },
      { exercise: "Standing Hamstring Stretch", sets: 2, reps: "30 sec each side", rest: "—", intensity: "Low" },
    ],
    cooldown: [
      { exercise: "Supine Figure-4 Stretch", duration: "2 min" },
      { exercise: "Diaphragmatic Breathing", duration: "3 min" },
    ],
    estimatedDuration: 30,
    estimatedTSS: 12,
  },
];

// ============================================================
// ALL TEMPLATES — flat array for easy querying
// ============================================================

export const ALL_TEMPLATES: SessionTemplate[] = [
  ...UPPER_PUSH_GYM,
  ...UPPER_PULL_GYM,
  ...UPPER_COMBINED_GYM,
  ...LOWER_GYM,
  ...FULL_BODY_GYM,
  ...ZONE2,
  ...INTERVALS,
  ...HIIT_TEMPLATES,
  ...MOBILITY,
];

// ============================================================
// Lookup helpers
// ============================================================

/**
 * Get templates matching a session type and equipment level.
 * Equipment fallback: bodyweight-only templates work for all levels.
 */
export function getTemplatesForType(
  sessionType: string,
  equipment: string
): SessionTemplate[] {
  return ALL_TEMPLATES.filter((t) => {
    if (t.sessionType !== sessionType) return false;
    const eq = t.equipment as string;
    // bodyweight-only templates are universal
    if (eq === "bodyweight-only") return true;
    // full-gym templates work for full-gym and home-gym
    if (equipment === "full-gym") return true;
    if (equipment === "home-gym") return true;
    // minimal/bodyweight users get bodyweight templates only
    if (equipment === "minimal" || equipment === "bodyweight-only") {
      return eq === "bodyweight-only" || eq === "minimal";
    }
    return true;
  });
}

/**
 * Pick a template for the given session type and equipment, avoiding recent IDs.
 */
export function pickTemplate(
  sessionType: string,
  equipment: string,
  avoidIds: string[] = []
): SessionTemplate | null {
  const candidates = getTemplatesForType(sessionType, equipment);
  // Prefer templates not recently used
  const fresh = candidates.filter((t) => !avoidIds.includes(t.id));
  if (fresh.length > 0) {
    return fresh[Math.floor(Math.random() * fresh.length)];
  }
  // Fallback: any matching template
  if (candidates.length > 0) {
    return candidates[Math.floor(Math.random() * candidates.length)];
  }
  return null;
}

/**
 * Apply experience-level modifiers to a template's main exercises.
 * Returns a new array of exercises with adjusted sets/reps/rest/intensity.
 */
export function applyExperienceModifiers(
  main: MainExercise[],
  experienceLevel: string
): MainExercise[] {
  const mods = EXPERIENCE_MODIFIERS[experienceLevel] ?? EXPERIENCE_MODIFIERS["intermediate"];

  return main.map((ex) => ({
    ...ex,
    sets: Math.max(2, Math.round(ex.sets * mods.setsMultiplier)),
    reps: mods.repRange !== "8-10" ? mods.repRange : ex.reps,
    rest: adjustRest(ex.rest, mods.restMultiplier),
    intensity: mods.intensityLabel,
  }));
}

/**
 * Scale volume (sets) by a multiplier, applied to main exercises.
 */
export function scaleVolume(
  main: MainExercise[],
  multiplier: number
): MainExercise[] {
  return main.map((ex) => ({
    ...ex,
    sets: Math.max(1, Math.round(ex.sets * multiplier)),
  }));
}

function adjustRest(rest: string, multiplier: number): string {
  const match = rest.match(/^(\d+)/);
  if (!match) return rest;
  const seconds = Math.round(parseInt(match[1], 10) * multiplier);
  return `${seconds}s`;
}
