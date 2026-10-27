-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_GitHubIssueSync" (
    "issueId" TEXT NOT NULL PRIMARY KEY,
    "number" INTEGER,
    "githubAssigneeId" TEXT,
    "assignmentSynced" BOOLEAN NOT NULL DEFAULT false,
    "assigneeSnapshot" TEXT,
    "lastError" TEXT,
    "syncedAt" DATETIME,
    "lockedUntil" DATETIME,
    CONSTRAINT "GitHubIssueSync_issueId_fkey" FOREIGN KEY ("issueId") REFERENCES "Issue" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_GitHubIssueSync" ("assigneeSnapshot", "issueId", "lastError", "lockedUntil", "number", "syncedAt") SELECT "assigneeSnapshot", "issueId", "lastError", "lockedUntil", "number", "syncedAt" FROM "GitHubIssueSync";
DROP TABLE "GitHubIssueSync";
ALTER TABLE "new_GitHubIssueSync" RENAME TO "GitHubIssueSync";
CREATE TABLE "new_User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "sessionVersion" INTEGER NOT NULL DEFAULT 0,
    "githubId" TEXT,
    "githubLogin" TEXT,
    "passwordHash" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'MEMBER',
    "geminiApiKey" TEXT,
    "aiUsageCount" INTEGER NOT NULL DEFAULT 0,
    "aiUsageLimit" INTEGER NOT NULL DEFAULT 50,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO "new_User" ("aiUsageCount", "aiUsageLimit", "createdAt", "email", "geminiApiKey", "githubId", "githubLogin", "id", "name", "passwordHash", "role") SELECT "aiUsageCount", "aiUsageLimit", "createdAt", "email", "geminiApiKey", "githubId", "githubLogin", "id", "name", "passwordHash", "role" FROM "User";
DROP TABLE "User";
ALTER TABLE "new_User" RENAME TO "User";
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
CREATE UNIQUE INDEX "User_githubId_key" ON "User"("githubId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
