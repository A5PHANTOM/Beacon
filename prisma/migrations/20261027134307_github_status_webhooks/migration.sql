-- AlterTable
ALTER TABLE "GitHubIssueSync" ADD COLUMN "lastConfirmedStatus" TEXT;

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
    "remoteUpdatedAt" DATETIME NOT NULL,
    "payloadHash" TEXT NOT NULL,
    "receivedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processedAt" DATETIME,
    "result" TEXT,
    "lastError" TEXT,

    PRIMARY KEY ("projectId", "deliveryId"),
    CONSTRAINT "GitHubWebhookDelivery_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "GitHubConnection" ("projectId") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "GitHubWebhookDelivery_issueId_fkey" FOREIGN KEY ("issueId") REFERENCES "Issue" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_GitHubConnection" (
    "projectId" TEXT NOT NULL PRIMARY KEY,
    "owner" TEXT NOT NULL,
    "repo" TEXT NOT NULL,
    "encryptedToken" TEXT NOT NULL,
    "githubRepositoryId" TEXT,
    "encryptedWebhookSecret" TEXT,
    "webhookId" INTEGER,
    "inboundEnabled" BOOLEAN NOT NULL DEFAULT false,
    "lastWebhookAt" DATETIME,
    "lastWebhookError" TEXT,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    CONSTRAINT "GitHubConnection_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_GitHubConnection" ("enabled", "encryptedToken", "owner", "projectId", "repo") SELECT "enabled", "encryptedToken", "owner", "projectId", "repo" FROM "GitHubConnection";
DROP TABLE "GitHubConnection";
ALTER TABLE "new_GitHubConnection" RENAME TO "GitHubConnection";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "GitHubWebhookDelivery_issueId_processedAt_receivedAt_idx" ON "GitHubWebhookDelivery"("issueId", "processedAt", "receivedAt");
