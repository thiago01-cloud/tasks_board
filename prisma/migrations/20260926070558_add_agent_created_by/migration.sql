-- AlterTable
ALTER TABLE "agents" ADD COLUMN     "createdByAgentId" TEXT;

-- AddForeignKey
ALTER TABLE "agents" ADD CONSTRAINT "agents_createdByAgentId_fkey" FOREIGN KEY ("createdByAgentId") REFERENCES "agents"("id") ON DELETE SET NULL ON UPDATE CASCADE;
