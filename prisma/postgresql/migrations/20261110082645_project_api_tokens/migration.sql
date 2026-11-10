-- CreateTable
CREATE TABLE "ProjectApiToken" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "access" TEXT NOT NULL DEFAULT 'READ',
    "sessionVersion" INTEGER NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProjectApiToken_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ProjectApiToken_tokenHash_key" ON "ProjectApiToken"("tokenHash");

-- CreateIndex
CREATE INDEX "ProjectApiToken_projectId_userId_idx" ON "ProjectApiToken"("projectId", "userId");

-- AddForeignKey
ALTER TABLE "ProjectApiToken" ADD CONSTRAINT "ProjectApiToken_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectApiToken" ADD CONSTRAINT "ProjectApiToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
