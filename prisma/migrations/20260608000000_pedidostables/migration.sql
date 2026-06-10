-- CreateEnum
CREATE TYPE "SocialNetwork" AS ENUM ('FACEBOOK', 'INSTAGRAM', 'TIKTOK', 'YOUTUBE', 'TWITTER', 'WHATSAPP', 'WEBSITE');

-- CreateEnum
CREATE TYPE "TransportType" AS ENUM ('BUS', 'AVION', 'MOTO', 'A_PIE', 'PROPIO', 'EXPRESS');

-- CreateTable (store_social_links — already exists, use IF NOT EXISTS)
CREATE TABLE IF NOT EXISTS "store_social_links" (
    "id" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "network" "SocialNetwork" NOT NULL,
    "url" TEXT NOT NULL,

    CONSTRAINT "store_social_links_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "shipping_zones" (
    "id" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "transportType" "TransportType" NOT NULL,
    "shippingCost" DOUBLE PRECISION NOT NULL,
    "minHours" INTEGER NOT NULL,
    "maxHours" INTEGER NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "shipping_zones_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "cart_items" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "variant" TEXT,
    "colorName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cart_items_pkey" PRIMARY KEY ("id")
);

-- AlterTable Address
ALTER TABLE "addresses" ADD COLUMN IF NOT EXISTS "fullName" TEXT;
ALTER TABLE "addresses" ADD COLUMN IF NOT EXISTS "phone" TEXT;

-- AlterTable Order
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "addressId" TEXT;
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "shippingZoneId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "shipping_zones_storeId_city_transportType_key" ON "shipping_zones"("storeId", "city", "transportType");

-- AddForeignKey (store_social_links)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'store_social_links_storeId_fkey'
  ) THEN
    ALTER TABLE "store_social_links" ADD CONSTRAINT "store_social_links_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "stores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

-- AddForeignKey
ALTER TABLE "shipping_zones" ADD CONSTRAINT "shipping_zones_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "stores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cart_items" ADD CONSTRAINT "cart_items_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cart_items" ADD CONSTRAINT "cart_items_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "stores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cart_items" ADD CONSTRAINT "cart_items_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey (orders.addressId)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'orders_addressId_fkey'
  ) THEN
    ALTER TABLE "orders" ADD CONSTRAINT "orders_addressId_fkey" FOREIGN KEY ("addressId") REFERENCES "addresses"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- AddForeignKey (orders.shippingZoneId)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'orders_shippingZoneId_fkey'
  ) THEN
    ALTER TABLE "orders" ADD CONSTRAINT "orders_shippingZoneId_fkey" FOREIGN KEY ("shippingZoneId") REFERENCES "shipping_zones"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
