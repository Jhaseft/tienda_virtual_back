-- CreateEnum
CREATE TYPE "PickupMethod" AS ENUM ('WhATSAPP', 'STORE_PICKUP');

-- AlterTable
ALTER TABLE "orders" ADD COLUMN     "pickupMethod" "PickupMethod";
