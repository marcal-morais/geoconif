/*
  Warnings:

  - The `reset_token_expira` column on the `professores` table would be dropped and recreated. This will lead to data loss if there is data in the column.

*/
-- AlterTable
ALTER TABLE "professores" DROP COLUMN "reset_token_expira",
ADD COLUMN     "reset_token_expira" TIMESTAMP(3);
