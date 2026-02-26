-- AlterEnum: Replace old PlanTier values with new product tiers
-- NOTE: ADD VALUE is non-transactional in PostgreSQL, so new values
-- already exist from the prior failed attempt. We skip straight to
-- data migration and enum recreation.

-- Step 1: Migrate existing rows from old tiers to PRIVATE_COACHING
UPDATE "Subscription" SET "planTier" = 'PRIVATE_COACHING' WHERE "planTier" IN ('FOUNDATION', 'PERFORMANCE', 'ELITE');

-- Step 2: Recreate enum with only the 6 new values
ALTER TYPE "PlanTier" RENAME TO "PlanTier_old";

CREATE TYPE "PlanTier" AS ENUM ('PRIVATE_COACHING', 'TRAINING_30DAY', 'TRAINING_60DAY', 'TRAINING_90DAY', 'NUTRITION_4WEEK', 'NUTRITION_8WEEK');

ALTER TABLE "Subscription" ALTER COLUMN "planTier" TYPE "PlanTier" USING "planTier"::text::"PlanTier";

DROP TYPE "PlanTier_old";
