-- AlterEnum: Replace old PlanTier values with new product tiers
-- Step 1: Add new values to the existing enum
ALTER TYPE "PlanTier" ADD VALUE IF NOT EXISTS 'PRIVATE_COACHING';
ALTER TYPE "PlanTier" ADD VALUE IF NOT EXISTS 'TRAINING_30DAY';
ALTER TYPE "PlanTier" ADD VALUE IF NOT EXISTS 'TRAINING_60DAY';
ALTER TYPE "PlanTier" ADD VALUE IF NOT EXISTS 'TRAINING_90DAY';
ALTER TYPE "PlanTier" ADD VALUE IF NOT EXISTS 'NUTRITION_4WEEK';
ALTER TYPE "PlanTier" ADD VALUE IF NOT EXISTS 'NUTRITION_8WEEK';

-- Step 2: Migrate any existing rows from old tiers to new tiers
UPDATE "Subscription" SET "planTier" = 'PRIVATE_COACHING' WHERE "planTier" IN ('FOUNDATION', 'PERFORMANCE', 'ELITE');

-- Step 3: Rename enum by creating new type, migrating column, and dropping old
-- (Cannot remove values from a Postgres enum, so we recreate it)
ALTER TYPE "PlanTier" RENAME TO "PlanTier_old";

CREATE TYPE "PlanTier" AS ENUM ('PRIVATE_COACHING', 'TRAINING_30DAY', 'TRAINING_60DAY', 'TRAINING_90DAY', 'NUTRITION_4WEEK', 'NUTRITION_8WEEK');

ALTER TABLE "Subscription" ALTER COLUMN "planTier" TYPE "PlanTier" USING "planTier"::text::"PlanTier";

DROP TYPE "PlanTier_old";
