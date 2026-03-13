-- CreateTable: project_configs
CREATE TABLE IF NOT EXISTS "project_configs" (
    "id"          TEXT NOT NULL,
    "code"        TEXT NOT NULL,
    "name"        TEXT NOT NULL,
    "client"      TEXT,
    "description" TEXT,
    "active"      BOOLEAN NOT NULL DEFAULT true,
    "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "project_configs_pkey" PRIMARY KEY ("id")
);

-- CreateTable: task_name_configs
CREATE TABLE IF NOT EXISTS "task_name_configs" (
    "id"              TEXT NOT NULL,
    "projectConfigId" TEXT NOT NULL,
    "name"            TEXT NOT NULL,
    "active"          BOOLEAN NOT NULL DEFAULT true,
    "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "task_name_configs_pkey" PRIMARY KEY ("id")
);

-- Unique constraints
CREATE UNIQUE INDEX IF NOT EXISTS "project_configs_code_key" ON "project_configs"("code");
CREATE UNIQUE INDEX IF NOT EXISTS "task_name_configs_projectConfigId_name_key"
    ON "task_name_configs"("projectConfigId", "name");

-- Indexes
CREATE INDEX IF NOT EXISTS "project_configs_active_idx"      ON "project_configs"("active");
CREATE INDEX IF NOT EXISTS "task_name_configs_projectConfigId_idx" ON "task_name_configs"("projectConfigId");

-- Foreign key
ALTER TABLE "task_name_configs"
    ADD CONSTRAINT "task_name_configs_projectConfigId_fkey"
    FOREIGN KEY ("projectConfigId")
    REFERENCES "project_configs"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

-- updatedAt trigger helper (use NOW() on update)
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
   NEW."updatedAt" = NOW();
   RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_project_configs_updated_at ON "project_configs";
CREATE TRIGGER update_project_configs_updated_at
    BEFORE UPDATE ON "project_configs"
    FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
