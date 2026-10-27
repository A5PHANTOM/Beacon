-- AlterTable
ALTER TABLE "User" ADD COLUMN     "sessionVersion" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "GitHubIssueSync" ADD COLUMN     "assignmentSynced" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "githubAssigneeId" TEXT;
