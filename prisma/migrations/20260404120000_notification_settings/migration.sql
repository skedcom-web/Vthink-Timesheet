-- CreateTable
CREATE TABLE "app_notification_settings" (
    "id" TEXT NOT NULL DEFAULT 'global',
    "timezone" TEXT NOT NULL DEFAULT 'Asia/Kolkata',
    "weeklyReminderEnabled" BOOLEAN NOT NULL DEFAULT true,
    "statusReminderRules" JSONB NOT NULL DEFAULT '[]',
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedById" TEXT,

    CONSTRAINT "app_notification_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notification_delivery_logs" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "channel" TEXT NOT NULL DEFAULT 'email',
    "kind" TEXT NOT NULL,
    "weekKey" TEXT NOT NULL,
    "ruleId" TEXT NOT NULL,
    "dayYmd" TEXT NOT NULL,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notification_delivery_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "notification_delivery_logs_userId_kind_weekKey_ruleId_dayYmd_key" ON "notification_delivery_logs"("userId", "kind", "weekKey", "ruleId", "dayYmd");

-- CreateIndex
CREATE INDEX "notification_delivery_logs_sentAt_idx" ON "notification_delivery_logs"("sentAt");

-- CreateIndex
CREATE INDEX "notification_delivery_logs_userId_idx" ON "notification_delivery_logs"("userId");
