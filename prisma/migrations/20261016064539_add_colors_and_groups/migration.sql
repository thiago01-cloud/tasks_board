/*
  Warnings:

  - A unique constraint covering the columns `[companyId,color]` on the table `agents` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "agents_companyId_color_key" ON "agents"("companyId", "color");
