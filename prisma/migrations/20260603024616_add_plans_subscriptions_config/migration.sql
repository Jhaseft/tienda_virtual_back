/*
  Warnings:

  - You are about to drop the column `stripePaymentIntentId` on the `subscriptions` table. All the data in the column will be lost.
  - You are about to drop the column `stripePaymentMethodId` on the `subscriptions` table. All the data in the column will be lost.

*/
-- CreateEnum
CREATE TYPE "PaymentChannel" AS ENUM ('QR_BANCO', 'STRIPE');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('PENDING', 'COMPLETED', 'FAILED');

-- AlterTable
ALTER TABLE "plans" ADD COLUMN     "canAddPaymentMethods" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "description" TEXT,
ADD COLUMN     "hasAdvancedPayments" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "hasAiAgent" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "subscriptions" DROP COLUMN "stripePaymentIntentId",
DROP COLUMN "stripePaymentMethodId";

-- CreateTable
CREATE TABLE "subscription_payments" (
    "id" TEXT NOT NULL,
    "subscriptionId" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "paymentChannel" "PaymentChannel" NOT NULL,
    "stripePaymentIntentId" TEXT,
    "stripePaymentMethodId" TEXT,
    "banecoQrId" TEXT,
    "qrExpiresAt" TIMESTAMP(3),
    "status" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "subscription_payments_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "subscription_payments" ADD CONSTRAINT "subscription_payments_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "subscriptions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
