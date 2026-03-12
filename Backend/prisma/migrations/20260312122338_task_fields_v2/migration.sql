-- Step 1: Add new TaskType values
ALTER TYPE "TaskType" ADD VALUE IF NOT EXISTS 'SUPPORT';
ALTER TYPE "TaskType" ADD VALUE IF NOT EXISTS 'DOCUMENTATION';
ALTER TYPE "TaskType" ADD VALUE IF NOT EXISTS 'MEETING';

-- Step 2: Rename old TaskStatus so we can create the new one
ALTER TYPE "TaskStatus" RENAME TO "TaskStatus_old";

-- Step 3: Create new TaskStatus enum
CREATE TYPE "TaskStatus" AS ENUM ('ACTIVE', 'ON_HOLD', 'COMPLETED', 'CANCELLED');

-- Step 4: Add temp column, migrate data, swap columns
ALTER TABLE "tasks" ADD COLUMN "status_new" "TaskStatus";

UPDATE "tasks" SET "status_new" = CASE
  WHEN "status"::text = 'NOT_STARTED' THEN 'ACTIVE'::"TaskStatus"
  WHEN "status"::text = 'IN_PROGRESS' THEN 'ACTIVE'::"TaskStatus"
  WHEN "status"::text = 'COMPLETED'   THEN 'COMPLETED'::"TaskStatus"
  WHEN "status"::text = 'ON_HOLD'     THEN 'ON_HOLD'::"TaskStatus"
  ELSE 'ACTIVE'::"TaskStatus"
END;

ALTER TABLE "tasks" DROP COLUMN "status";
ALTER TABLE "tasks" RENAME COLUMN "status_new" TO "status";
ALTER TABLE "tasks" ALTER COLUMN "status" SET NOT NULL;
ALTER TABLE "tasks" ALTER COLUMN "status" SET DEFAULT 'ACTIVE'::"TaskStatus";

-- Step 5: Drop old enum
DROP TYPE "TaskStatus_old";

-- Step 6: Add new columns
ALTER TABLE "tasks" ADD COLUMN IF NOT EXISTS "endDate" TIMESTAMP(3);
ALTER TABLE "tasks" ADD COLUMN IF NOT EXISTS "billable" BOOLEAN NOT NULL DEFAULT true;

-- Step 7: Copy dueDate → endDate, then drop old columns
UPDATE "tasks" SET "endDate" = "dueDate" WHERE "dueDate" IS NOT NULL;

ALTER TABLE "tasks" DROP COLUMN IF EXISTS "dueDate";
ALTER TABLE "tasks" DROP COLUMN IF EXISTS "estimatedHours";
ALTER TABLE "tasks" DROP COLUMN IF EXISTS "actualHours";
