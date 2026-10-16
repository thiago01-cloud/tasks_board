-- AlterTable
ALTER TABLE "agents" ADD COLUMN     "color" TEXT;

-- AlterTable
ALTER TABLE "groups" ADD COLUMN     "leaderId" TEXT,
ADD COLUMN     "parentId" TEXT;

-- AddForeignKey
ALTER TABLE "groups" ADD CONSTRAINT "groups_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "groups"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "groups" ADD CONSTRAINT "groups_leaderId_fkey" FOREIGN KEY ("leaderId") REFERENCES "agents"("id") ON DELETE SET NULL ON UPDATE CASCADE;
