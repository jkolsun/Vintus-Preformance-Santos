import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Seeding database...");

  // ============================================================
  // 1. Admin user
  // ============================================================
  const adminPasswordHash = await bcrypt.hash("changeme123", 12);
  const admin = await prisma.user.upsert({
    where: { email: "admin@vintusperformance.org" },
    update: {},
    create: {
      email: "admin@vintusperformance.org",
      passwordHash: adminPasswordHash,
      role: "ADMIN",
    },
  });
  console.log(`  ✅ Admin user: ${admin.email} (${admin.id})`);

  // ============================================================
  // 2. Test client user with complete AthleteProfile
  //    Persona: "executive-athlete"
  // ============================================================
  const clientPasswordHash = await bcrypt.hash("testclient123", 12);
  const client = await prisma.user.upsert({
    where: { email: "marcus.chen@testclient.com" },
    update: {},
    create: {
      email: "marcus.chen@testclient.com",
      passwordHash: clientPasswordHash,
      role: "CLIENT",
      athleteProfile: {
        create: {
          firstName: "Marcus",
          lastName: "Chen",
          phone: "+15551234567",
          timezone: "America/New_York",
          dateOfBirth: new Date("1986-03-15"),

          // Goals & context
          primaryGoal: "recomposition",
          secondaryGoals: ["build-muscle", "endurance"],
          trainingDaysPerWeek: 5,
          preferredTrainingTime: "morning",
          experienceLevel: "advanced",
          currentActivity:
            "3x/week gym (mostly machines), occasional weekend run, inconsistent schedule due to travel",
          equipmentAccess: "full-gym",
          injuryHistory: "Minor lower back strain 2 years ago, fully recovered",
          sleepSchedule: "11pm-6:30am",
          stressLevel: 7,
          occupation: "VP of Operations, SaaS company",
          travelFrequency: "monthly",

          // AI classification
          personaType: "executive-athlete",
          aiSummary:
            "You're a high-performing executive who treats training like a business objective. With advanced experience and a recomposition goal, you need a structured plan that maximizes efficiency within your demanding schedule. Your monthly travel and elevated stress levels mean adaptive recovery programming is critical to your progress.",
          riskFlags: ["high-stress-high-volume"],

          // Routine questionnaire (post-purchase)
          wakeTime: "05:30",
          bedTime: "23:00",
          mealsPerDay: 3,
          hydrationLevel: "moderate",
          supplementsUsed: "Creatine, protein powder, vitamin D, magnesium",
          recoveryPractices: ["foam-roll", "sauna", "stretch"],
        },
      },
    },
    include: { athleteProfile: true },
  });
  console.log(`  ✅ Client user: ${client.email} (${client.id})`);

  const profileId = client.athleteProfile!.id;

  // ============================================================
  // 3. Subscription (PRIVATE_COACHING tier, active)
  // ============================================================
  const now = new Date();
  const periodStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1);

  const subscription = await prisma.subscription.upsert({
    where: { userId: client.id },
    update: {},
    create: {
      userId: client.id,
      planTier: "PRIVATE_COACHING",
      status: "ACTIVE",
      stripeCustomerId: "cus_test_marcus",
      stripeSubscriptionId: "sub_test_marcus",
      stripePriceId: "price_test_private_coaching",
      currentPeriodStart: periodStart,
      currentPeriodEnd: periodEnd,
      cancelAtPeriodEnd: false,
    },
  });
  console.log(`  ✅ Subscription: ${subscription.planTier} (${subscription.id})`);

  // ============================================================
  // 4. WorkoutPlan with 5 WorkoutSessions (Mon–Fri)
  // ============================================================
  // Get the Monday of the current week
  const today = new Date();
  const dayOfWeek = today.getDay(); // 0=Sun, 1=Mon...
  const monday = new Date(today);
  monday.setDate(today.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1));
  monday.setHours(0, 0, 0, 0);

  const friday = new Date(monday);
  friday.setDate(monday.getDate() + 4);

  const workoutPlan = await prisma.workoutPlan.create({
    data: {
      athleteProfileId: profileId,
      name: "Week 1 — Base Phase",
      weekNumber: 1,
      blockType: "base",
      startDate: monday,
      endDate: friday,
      isActive: true,
      plannedTSS: 320,
      actualTSS: 0,
    },
  });
  console.log(`  ✅ Workout plan: ${workoutPlan.name} (${workoutPlan.id})`);

  // Helper to create a date for a specific day this week
  const dayDate = (offset: number) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + offset);
    return d;
  };

  const sessions = await Promise.all([
    // Monday — Upper Body Strength (Push)
    prisma.workoutSession.create({
      data: {
        workoutPlanId: workoutPlan.id,
        scheduledDate: dayDate(0),
        scheduledOrder: 1,
        sessionType: "STRENGTH_PUSH",
        title: "Upper Body Push — Chest & Shoulders",
        description:
          "Compound push focus with progressive overload. Control tempo on eccentric.",
        prescribedDuration: 55,
        prescribedTSS: 70,
        content: {
          warmup: [
            { exercise: "Band pull-aparts", duration: "2x15", notes: "Activate rear delts" },
            { exercise: "Push-up to downward dog", duration: "2x8", notes: "Dynamic chest/shoulder opener" },
          ],
          main: [
            { exercise: "Barbell bench press", sets: 4, reps: "6-8", rest: "120s", intensity: "RPE 7-8", notes: "3-1-1 tempo" },
            { exercise: "Incline dumbbell press", sets: 3, reps: "8-10", rest: "90s", intensity: "RPE 7", notes: "30-degree incline" },
            { exercise: "Standing overhead press", sets: 3, reps: "8-10", rest: "90s", intensity: "RPE 7", notes: "Strict form, no leg drive" },
            { exercise: "Cable lateral raise", sets: 3, reps: "12-15", rest: "60s", intensity: "RPE 8", notes: "Slow negative" },
            { exercise: "Dips (weighted if possible)", sets: 3, reps: "8-12", rest: "90s", intensity: "RPE 7", notes: "Lean forward slightly for chest emphasis" },
            { exercise: "Tricep rope pushdown", sets: 3, reps: "12-15", rest: "60s", intensity: "RPE 8", notes: "Squeeze at bottom" },
          ],
          cooldown: [
            { exercise: "Doorway chest stretch", duration: "30s each side" },
            { exercise: "Cross-body shoulder stretch", duration: "30s each side" },
          ],
          estimatedDuration: 55,
          estimatedTSS: 70,
        },
        status: "SCHEDULED",
      },
    }),

    // Tuesday — Zone 2 Endurance
    prisma.workoutSession.create({
      data: {
        workoutPlanId: workoutPlan.id,
        scheduledDate: dayDate(1),
        scheduledOrder: 2,
        sessionType: "ENDURANCE_ZONE2",
        title: "Zone 2 Steady-State Cardio",
        description:
          "Aerobic base building. Stay conversational throughout. Heart rate 120-140bpm.",
        prescribedDuration: 40,
        prescribedTSS: 50,
        content: {
          warmup: [
            { exercise: "Easy walk/jog", duration: "5 minutes", notes: "Gradually increase pace" },
          ],
          main: [
            { exercise: "Treadmill run or bike", sets: 1, reps: "30 min", rest: "N/A", intensity: "Zone 2 (120-140 bpm)", notes: "Nasal breathing if possible. Should be able to hold a conversation." },
          ],
          cooldown: [
            { exercise: "Easy walk", duration: "5 minutes" },
            { exercise: "Standing quad stretch", duration: "30s each" },
            { exercise: "Calf stretch on step", duration: "30s each" },
          ],
          estimatedDuration: 40,
          estimatedTSS: 50,
        },
        status: "SCHEDULED",
      },
    }),

    // Wednesday — Upper Body Strength (Pull)
    prisma.workoutSession.create({
      data: {
        workoutPlanId: workoutPlan.id,
        scheduledDate: dayDate(2),
        scheduledOrder: 3,
        sessionType: "STRENGTH_PULL",
        title: "Upper Body Pull — Back & Biceps",
        description:
          "Horizontal and vertical pulling. Prioritize scapular retraction.",
        prescribedDuration: 55,
        prescribedTSS: 70,
        content: {
          warmup: [
            { exercise: "Cat-cow stretch", duration: "2x10", notes: "Mobilize thoracic spine" },
            { exercise: "Band face pulls", duration: "2x15", notes: "Retract and depress scapulae" },
          ],
          main: [
            { exercise: "Pull-ups (weighted if possible)", sets: 4, reps: "6-8", rest: "120s", intensity: "RPE 7-8", notes: "Full range of motion, dead hang at bottom" },
            { exercise: "Barbell bent-over row", sets: 4, reps: "8-10", rest: "90s", intensity: "RPE 7", notes: "Hinge at hips, flat back" },
            { exercise: "Seated cable row", sets: 3, reps: "10-12", rest: "90s", intensity: "RPE 7", notes: "Squeeze shoulder blades together" },
            { exercise: "Dumbbell hammer curl", sets: 3, reps: "10-12", rest: "60s", intensity: "RPE 8", notes: "No swinging" },
            { exercise: "Barbell curl", sets: 3, reps: "10-12", rest: "60s", intensity: "RPE 8", notes: "Controlled eccentric" },
            { exercise: "Reverse fly (cable or dumbbell)", sets: 3, reps: "12-15", rest: "60s", intensity: "RPE 7", notes: "Rear delt isolation" },
          ],
          cooldown: [
            { exercise: "Lat stretch (hang from bar)", duration: "30s" },
            { exercise: "Bicep wall stretch", duration: "30s each side" },
          ],
          estimatedDuration: 55,
          estimatedTSS: 70,
        },
        status: "SCHEDULED",
      },
    }),

    // Thursday — Lower Body Strength
    prisma.workoutSession.create({
      data: {
        workoutPlanId: workoutPlan.id,
        scheduledDate: dayDate(3),
        scheduledOrder: 4,
        sessionType: "STRENGTH_LOWER",
        title: "Lower Body Strength — Quad & Glute Focus",
        description:
          "Compound lower body with squat pattern emphasis. Mind lower back stability.",
        prescribedDuration: 60,
        prescribedTSS: 80,
        content: {
          warmup: [
            { exercise: "Goblet squat hold", duration: "2x20s", notes: "Open hips, pry knees out" },
            { exercise: "Walking lunges (bodyweight)", duration: "2x10 steps", notes: "Dynamic activation" },
            { exercise: "Glute bridge", duration: "2x15", notes: "Squeeze at top" },
          ],
          main: [
            { exercise: "Barbell back squat", sets: 4, reps: "6-8", rest: "150s", intensity: "RPE 7-8", notes: "Below parallel if mobility allows. Brace core." },
            { exercise: "Romanian deadlift", sets: 3, reps: "8-10", rest: "120s", intensity: "RPE 7", notes: "Hinge at hips, slight knee bend, feel hamstrings" },
            { exercise: "Bulgarian split squat", sets: 3, reps: "10 each", rest: "90s", intensity: "RPE 7", notes: "Rear foot elevated on bench" },
            { exercise: "Leg press", sets: 3, reps: "10-12", rest: "90s", intensity: "RPE 8", notes: "Full range, don't lock out knees" },
            { exercise: "Standing calf raise", sets: 4, reps: "12-15", rest: "60s", intensity: "RPE 8", notes: "Full stretch at bottom, pause at top" },
          ],
          cooldown: [
            { exercise: "Pigeon stretch", duration: "45s each side" },
            { exercise: "Standing hamstring stretch", duration: "30s each side" },
            { exercise: "Couch stretch (hip flexor)", duration: "45s each side" },
          ],
          estimatedDuration: 60,
          estimatedTSS: 80,
        },
        status: "SCHEDULED",
      },
    }),

    // Friday — Tempo Endurance
    prisma.workoutSession.create({
      data: {
        workoutPlanId: workoutPlan.id,
        scheduledDate: dayDate(4),
        scheduledOrder: 5,
        sessionType: "ENDURANCE_TEMPO",
        title: "Tempo Run — Controlled Effort",
        description:
          "Tempo effort after a strength week. Build lactate threshold. Keep form tight.",
        prescribedDuration: 35,
        prescribedTSS: 60,
        content: {
          warmup: [
            { exercise: "Easy jog", duration: "5 minutes", notes: "Zone 1, settle into rhythm" },
            { exercise: "Dynamic leg swings", duration: "10 each direction", notes: "Front-back and lateral" },
          ],
          main: [
            { exercise: "Tempo run", sets: 1, reps: "20 min", rest: "N/A", intensity: "Zone 3 (tempo pace)", notes: "Comfortably hard. You can speak in short phrases but not hold a conversation." },
            { exercise: "Cool-down jog", sets: 1, reps: "5 min", rest: "N/A", intensity: "Zone 1", notes: "Easy effort, bring heart rate down" },
          ],
          cooldown: [
            { exercise: "Standing quad stretch", duration: "30s each" },
            { exercise: "Figure-four glute stretch", duration: "30s each" },
            { exercise: "Calf stretch", duration: "30s each" },
          ],
          estimatedDuration: 35,
          estimatedTSS: 60,
        },
        status: "SCHEDULED",
      },
    }),
  ]);
  console.log(`  ✅ Workout sessions: ${sessions.length} created (Mon–Fri)`);

  // ============================================================
  // 5. ReadinessMetrics — past 3 days (manual source)
  // ============================================================
  const threeDaysAgo = new Date(today);
  threeDaysAgo.setDate(today.getDate() - 3);
  const twoDaysAgo = new Date(today);
  twoDaysAgo.setDate(today.getDate() - 2);
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);

  const readinessData = [
    {
      athleteProfileId: profileId,
      date: threeDaysAgo,
      source: "MANUAL" as const,
      perceivedEnergy: 7,
      perceivedSoreness: 4,
      perceivedMood: 7,
      sleepQualityManual: 7,
      sleepDurationMin: 420,
      bodyWeight: 84.5,
      notes: "Good day overall. Slept well, hit the gym early.",
    },
    {
      athleteProfileId: profileId,
      date: twoDaysAgo,
      source: "MANUAL" as const,
      perceivedEnergy: 5,
      perceivedSoreness: 6,
      perceivedMood: 6,
      sleepQualityManual: 5,
      sleepDurationMin: 360,
      bodyWeight: 84.3,
      notes: "Late night calls with Asia team. Feeling the legs from yesterday.",
    },
    {
      athleteProfileId: profileId,
      date: yesterday,
      source: "MANUAL" as const,
      perceivedEnergy: 8,
      perceivedSoreness: 3,
      perceivedMood: 8,
      sleepQualityManual: 8,
      sleepDurationMin: 450,
      bodyWeight: 84.1,
      notes: "Best night of sleep this week. Ready to push today.",
    },
  ];

  for (const metric of readinessData) {
    await prisma.readinessMetric.upsert({
      where: {
        athleteProfileId_date_source: {
          athleteProfileId: metric.athleteProfileId,
          date: metric.date,
          source: metric.source,
        },
      },
      update: metric,
      create: metric,
    });
  }
  console.log(`  ✅ Readiness metrics: 3 days created`);

  console.log("\n🎉 Seed complete!");
}

main()
  .catch((e) => {
    console.error("Seed failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
