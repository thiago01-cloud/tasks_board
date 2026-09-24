-- AlterTable
ALTER TABLE "groups" ADD COLUMN     "creatorId" TEXT;

-- AddForeignKey
ALTER TABLE "groups" ADD CONSTRAINT "groups_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "agents"("id") ON DELETE SET NULL ON UPDATE CASCADE;
