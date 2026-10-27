-- CreateTable
CREATE TABLE "GitHubConnection" (
    "projectId" TEXT NOT NULL PRIMARY KEY,
    "owner" TEXT NOT NULL,
    "repo" TEXT NOT NULL,
    "encryptedToken" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    CONSTRAINT "GitHubConnection_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "GitHubIssueSync" (
    "issueId" TEXT NOT NULL PRIMARY KEY,
    "number" INTEGER,
    "assigneeSnapshot" TEXT,
    "lastError" TEXT,
    "syncedAt" DATETIME,
    "lockedUntil" DATETIME,
    CONSTRAINT "GitHubIssueSync_issueId_fkey" FOREIGN KEY ("issueId") REFERENCES "Issue" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
