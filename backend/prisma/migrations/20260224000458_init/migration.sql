-- CreateEnum
CREATE TYPE "Role" AS ENUM ('CLIENT', 'ADMIN', 'COACH');

-- CreateEnum
CREATE TYPE "DataSource" AS ENUM ('MANUAL', 'STRAVA', 'GARMIN', 'APPLE_HEALTH', 'WHOOP', 'OURA', 'FITBIT', 'TRAININGPEAKS');

-- CreateEnum
CREATE TYPE "SessionType" AS ENUM ('STRENGTH_UPPER', 'STRENGTH_LOWER', 'STRENGTH_FULL', 'STRENGTH_PUSH', 'STRENGTH_PULL', 'ENDURANCE_ZONE2', 'ENDURANCE_TEMPO', 'ENDURANCE_INTERVALS', 'HIIT', 'MOBILITY_RECOVERY', 'ACTIVE_RECOVERY', 'REST', 'CUSTOM');

-- CreateEnum
CREATE TYPE "SessionStatus" AS ENUM ('SCHEDULED', 'COMPLETED', 'MISSED', 'SKIPPED', 'RESCHEDULED');

-- CreateEnum
CREATE TYPE "MessageChannel" AS ENUM ('SMS', 'EMAIL', 'PUSH', 'IN_APP');

-- CreateEnum
CREATE TYPE "MessageCategory" AS ENUM ('WELCOME', 'MOTIVATION', 'HUMOR', 'EDUCATION', 'ACCOUNTABILITY', 'RECOVERY_TIP', 'WORKOUT_COMPLETED', 'WORKOUT_MISSED', 'ESCALATION', 'CHECK_IN', 'SYSTEM');

-- CreateEnum
CREATE TYPE "PlanTier" AS ENUM ('PRIVATE_COACHING', 'TRAINING_30DAY', 'TRAINING_60DAY', 'TRAINING_90DAY', 'NUTRITION_4WEEK', 'NUTRITION_8WEEK');

-- CreateEnum
CREATE TYPE "SubscriptionStatus" AS ENUM ('ACTIVE', 'PAST_DUE', 'CANCELED', 'PAUSED', 'TRIALING');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'CLIENT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AthleteProfile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "phone" TEXT,
    "timezone" TEXT NOT NULL DEFAULT 'America/New_York',
    "dateOfBirth" TIMESTAMP(3),
    "primaryGoal" TEXT NOT NULL,
    "secondaryGoals" TEXT[],
    "trainingDaysPerWeek" INTEGER NOT NULL,
    "preferredTrainingTime" TEXT,
    "experienceLevel" TEXT NOT NULL,
    "currentActivity" TEXT,
    "equipmentAccess" TEXT NOT NULL,
    "injuryHistory" TEXT,
    "sleepSchedule" TEXT,
    "stressLevel" INTEGER,
    "occupation" TEXT,
    "travelFrequency" TEXT,
    "personaType" TEXT,
    "aiSummary" TEXT,
    "riskFlags" TEXT[],
    "wakeTime" TEXT,
    "bedTime" TEXT,
    "mealsPerDay" INTEGER,
    "hydrationLevel" TEXT,
    "supplementsUsed" TEXT,
    "recoveryPractices" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AthleteProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReadinessMetric" (
    "id" TEXT NOT NULL,
    "athleteProfileId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "source" "DataSource" NOT NULL DEFAULT 'MANUAL',
    "hrvMs" DOUBLE PRECISION,
    "restingHr" INTEGER,
    "sleepScore" DOUBLE PRECISION,
    "sleepDurationMin" INTEGER,
    "fatigueScore" DOUBLE PRECISION,
    "stressScore" DOUBLE PRECISION,
    "caloriesBurned" INTEGER,
    "steps" INTEGER,
    "vo2Estimate" DOUBLE PRECISION,
    "trainingLoad" DOUBLE PRECISION,
    "bodyWeight" DOUBLE PRECISION,
    "perceivedEnergy" INTEGER,
    "perceivedSoreness" INTEGER,
    "perceivedMood" INTEGER,
    "sleepQualityManual" INTEGER,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReadinessMetric_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkoutPlan" (
    "id" TEXT NOT NULL,
    "athleteProfileId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "weekNumber" INTEGER NOT NULL,
    "blockType" TEXT NOT NULL,
    "startDate" DATE NOT NULL,
    "endDate" DATE NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "plannedTSS" DOUBLE PRECISION,
    "actualTSS" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkoutPlan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkoutSession" (
    "id" TEXT NOT NULL,
    "workoutPlanId" TEXT NOT NULL,
    "scheduledDate" DATE NOT NULL,
    "scheduledOrder" INTEGER NOT NULL,
    "sessionType" "SessionType" NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "prescribedDuration" INTEGER,
    "prescribedTSS" DOUBLE PRECISION,
    "content" JSONB NOT NULL,
    "status" "SessionStatus" NOT NULL DEFAULT 'SCHEDULED',
    "completedAt" TIMESTAMP(3),
    "actualDuration" INTEGER,
    "actualTSS" DOUBLE PRECISION,
    "rpe" INTEGER,
    "athleteNotes" TEXT,
    "originalDate" DATE,
    "rescheduledFrom" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkoutSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdjustmentLog" (
    "id" TEXT NOT NULL,
    "workoutPlanId" TEXT NOT NULL,
    "triggerEvent" TEXT NOT NULL,
    "triggerData" JSONB,
    "adjustmentType" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "affectedSessions" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AdjustmentLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdherenceRecord" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "weekStartDate" DATE NOT NULL,
    "scheduledCount" INTEGER NOT NULL,
    "completedCount" INTEGER NOT NULL,
    "missedCount" INTEGER NOT NULL,
    "skippedCount" INTEGER NOT NULL,
    "adherenceRate" DOUBLE PRECISION NOT NULL,
    "consecutiveMissed" INTEGER NOT NULL DEFAULT 0,
    "weeklyMissedStreak" INTEGER NOT NULL DEFAULT 0,
    "escalationTriggered" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AdherenceRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MessageLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "channel" "MessageChannel" NOT NULL,
    "category" "MessageCategory" NOT NULL,
    "templateId" TEXT,
    "content" TEXT NOT NULL,
    "metadata" JSONB,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deliveredAt" TIMESTAMP(3),
    "readAt" TIMESTAMP(3),
    "failedAt" TIMESTAMP(3),
    "failureReason" TEXT,
    "externalId" TEXT,

    CONSTRAINT "MessageLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EscalationEvent" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "triggerReason" TEXT NOT NULL,
    "escalationLevel" INTEGER NOT NULL,
    "messageSent" BOOLEAN NOT NULL DEFAULT false,
    "messageLogId" TEXT,
    "callBooked" BOOLEAN NOT NULL DEFAULT false,
    "resolvedAt" TIMESTAMP(3),
    "resolution" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EscalationEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Subscription" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "planTier" "PlanTier" NOT NULL,
    "stripeCustomerId" TEXT,
    "stripeSubscriptionId" TEXT,
    "stripePriceId" TEXT,
    "status" "SubscriptionStatus" NOT NULL DEFAULT 'ACTIVE',
    "currentPeriodStart" TIMESTAMP(3) NOT NULL,
    "currentPeriodEnd" TIMESTAMP(3) NOT NULL,
    "cancelAtPeriodEnd" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Subscription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DeviceConnection" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "provider" "DataSource" NOT NULL,
    "accessToken" TEXT,
    "refreshToken" TEXT,
    "externalUserId" TEXT,
    "scopes" TEXT[],
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastSyncAt" TIMESTAMP(3),
    "syncErrors" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DeviceConnection_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Session_token_key" ON "Session"("token");

-- CreateIndex
CREATE UNIQUE INDEX "AthleteProfile_userId_key" ON "AthleteProfile"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "ReadinessMetric_athleteProfileId_date_source_key" ON "ReadinessMetric"("athleteProfileId", "date", "source");

-- CreateIndex
CREATE UNIQUE INDEX "AdherenceRecord_userId_weekStartDate_key" ON "AdherenceRecord"("userId", "weekStartDate");

-- CreateIndex
CREATE UNIQUE INDEX "Subscription_userId_key" ON "Subscription"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "DeviceConnection_userId_provider_key" ON "DeviceConnection"("userId", "provider");

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AthleteProfile" ADD CONSTRAINT "AthleteProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReadinessMetric" ADD CONSTRAINT "ReadinessMetric_athleteProfileId_fkey" FOREIGN KEY ("athleteProfileId") REFERENCES "AthleteProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkoutPlan" ADD CONSTRAINT "WorkoutPlan_athleteProfileId_fkey" FOREIGN KEY ("athleteProfileId") REFERENCES "AthleteProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkoutSession" ADD CONSTRAINT "WorkoutSession_workoutPlanId_fkey" FOREIGN KEY ("workoutPlanId") REFERENCES "WorkoutPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdjustmentLog" ADD CONSTRAINT "AdjustmentLog_workoutPlanId_fkey" FOREIGN KEY ("workoutPlanId") REFERENCES "WorkoutPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MessageLog" ADD CONSTRAINT "MessageLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EscalationEvent" ADD CONSTRAINT "EscalationEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeviceConnection" ADD CONSTRAINT "DeviceConnection_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
