-- AlterTable
ALTER TABLE "GitHubConnection" ADD COLUMN     "encryptedWebhookSecret" TEXT,
ADD COLUMN     "githubRepositoryId" TEXT,
ADD COLUMN     "inboundEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "lastWebhookAt" TIMESTAMP(3),
ADD COLUMN     "lastWebhookError" TEXT,
ADD COLUMN     "webhookId" INTEGER;

-- AlterTable
ALTER TABLE "GitHubIssueSync" ADD COLUMN     "lastConfirmedStatus" TEXT;

-- CreateTable
CREATE TABLE "GitHubWebhookDelivery" (
    "projectId" TEXT NOT NULL,
    "deliveryId" TEXT NOT NULL,
    "issueId" TEXT NOT NULL,
    "issueNumber" INTEGER NOT NULL,
    "remoteIssueId" TEXT NOT NULL,
    "senderGitHubId" TEXT NOT NULL,
    "senderLogin" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "remoteState" TEXT NOT NULL,
    "remoteUpdatedAt" TIMESTAMP(3) NOT NULL,
    "payloadHash" TEXT NOT NULL,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processedAt" TIMESTAMP(3),
    "result" TEXT,
    "lastError" TEXT,

    CONSTRAINT "GitHubWebhookDelivery_pkey" PRIMARY KEY ("projectId","deliveryId")
);

-- CreateIndex
CREATE INDEX "GitHubWebhookDelivery_issueId_processedAt_receivedAt_idx" ON "GitHubWebhookDelivery"("issueId", "processedAt", "receivedAt");

-- AddForeignKey
ALTER TABLE "GitHubWebhookDelivery" ADD CONSTRAINT "GitHubWebhookDelivery_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "GitHubConnection"("projectId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GitHubWebhookDelivery" ADD CONSTRAINT "GitHubWebhookDelivery_issueId_fkey" FOREIGN KEY ("issueId") REFERENCES "Issue"("id") ON DELETE CASCADE ON UPDATE CASCADE;
