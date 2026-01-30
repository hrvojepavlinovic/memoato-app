-- CreateEnum
CREATE TYPE "CategoryType" AS ENUM ('NUMBER', 'DO', 'DONT', 'GOAL');

-- AlterTable
ALTER TABLE "Category" ADD COLUMN     "accentHex" TEXT NOT NULL DEFAULT '#0A0A0A',
ADD COLUMN     "categoryType" "CategoryType" NOT NULL DEFAULT 'NUMBER',
ADD COLUMN     "emoji" TEXT;
