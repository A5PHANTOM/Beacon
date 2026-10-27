-- CreateTable
CREATE TABLE "GitHubConnection" (
    "projectId" TEXT NOT NULL,
    "owner" TEXT NOT NULL,
    "repo" TEXT NOT NULL,
    "encryptedToken" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "GitHubConnection_pkey" PRIMARY KEY ("projectId")
);

-- CreateTable
CREATE TABLE "GitHubIssueSync" (
    "issueId" TEXT NOT NULL,
    "number" INTEGER,
    "assigneeSnapshot" TEXT,
    "lastError" TEXT,
    "syncedAt" TIMESTAMP(3),
    "lockedUntil" TIMESTAMP(3),

    CONSTRAINT "GitHubIssueSync_pkey" PRIMARY KEY ("issueId")
);

-- AddForeignKey
ALTER TABLE "GitHubConnection" ADD CONSTRAINT "GitHubConnection_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GitHubIssueSync" ADD CONSTRAINT "GitHubIssueSync_issueId_fkey" FOREIGN KEY ("issueId") REFERENCES "Issue"("id") ON DELETE CASCADE ON UPDATE CASCADE;
