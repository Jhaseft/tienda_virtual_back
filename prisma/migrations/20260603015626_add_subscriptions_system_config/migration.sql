/*
  Warnings:

  - You are about to drop the column `canShowRating` on the `plans` table. All the data in the column will be lost.
  - You are about to drop the column `canUseQR` on the `plans` table. All the data in the column will be lost.
  - You are about to drop the column `maxPhotos` on the `plans` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "plans" DROP COLUMN "canShowRating",
DROP COLUMN "canUseQR",
DROP COLUMN "maxPhotos",
ADD COLUMN     "isActive" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "sortOrder" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "subscriptions" ADD COLUMN     "stripePaymentIntentId" TEXT,
ADD COLUMN     "stripePaymentMethodId" TEXT,
ADD COLUMN     "trialEndsAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "system_config" (
    "id" TEXT NOT NULL DEFAULT '1',
    "trialDays" INTEGER NOT NULL DEFAULT 15,
    "trialMaxProducts" INTEGER NOT NULL DEFAULT 8,
    "exchangeRateBob" DOUBLE PRECISION NOT NULL DEFAULT 6.90,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "system_config_pkey" PRIMARY KEY ("id")
);
