-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "MessageCategory" ADD VALUE 'CHECKIN_RESPONSE';
ALTER TYPE "MessageCategory" ADD VALUE 'DAILY_WORKOUT_ALERT';
ALTER TYPE "MessageCategory" ADD VALUE 'WORKOUT_NOT_LOGGED';
ALTER TYPE "MessageCategory" ADD VALUE 'PLAN_MILESTONE';
ALTER TYPE "MessageCategory" ADD VALUE 'PLAN_ENDING';
ALTER TYPE "MessageCategory" ADD VALUE 'PLAN_COMPLETED';
ALTER TYPE "MessageCategory" ADD VALUE 'RENEWAL_FOLLOWUP';

-- AlterEnum
ALTER TYPE "SubscriptionStatus" ADD VALUE 'PENDING_APPROVAL';

-- AlterTable
ALTER TABLE "AthleteProfile" ADD COLUMN     "alcoholFrequency" TEXT,
ADD COLUMN     "benchPressMax" TEXT,
ADD COLUMN     "bodyFatEstimate" TEXT,
ADD COLUMN     "caffeineDaily" TEXT,
ADD COLUMN     "cardioBase" TEXT,
ADD COLUMN     "chronicConditions" TEXT,
ADD COLUMN     "currentProgram" TEXT,
ADD COLUMN     "deadliftMax" TEXT,
ADD COLUMN     "dietaryApproach" TEXT,
ADD COLUMN     "eventDate" TIMESTAMP(3),
ADD COLUMN     "eventDescription" TEXT,
ADD COLUMN     "exercisesHated" TEXT,
ADD COLUMN     "exercisesLoved" TEXT,
ADD COLUMN     "goalTimeline" TEXT,
ADD COLUMN     "heightInches" INTEGER,
ADD COLUMN     "medications" TEXT,
ADD COLUMN     "previousPT" BOOLEAN,
ADD COLUMN     "sessionLength" INTEGER,
ADD COLUMN     "specificInjuries" JSONB,
ADD COLUMN     "squatMax" TEXT,
ADD COLUMN     "targetWeight" DOUBLE PRECISION,
ADD COLUMN     "weightLbs" DOUBLE PRECISION,
ADD COLUMN     "workType" TEXT,
ADD COLUMN     "yearsTraining" INTEGER;

-- AlterTable
ALTER TABLE "Subscription" ADD COLUMN     "renewalPromptedAt" TIMESTAMP(3),
ADD COLUMN     "renewalResponseAt" TIMESTAMP(3),
ADD COLUMN     "scheduledDeleteAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "Lead" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "interest" TEXT,
    "goals" TEXT,
    "referral" TEXT,
    "preferredDate" TEXT,
    "preferredTime" TEXT,
    "tier" TEXT,
    "primaryGoal" TEXT,
    "experience" TEXT,
    "notes" TEXT,
    "status" TEXT NOT NULL DEFAULT 'NEW',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Lead_pkey" PRIMARY KEY ("id")
);
