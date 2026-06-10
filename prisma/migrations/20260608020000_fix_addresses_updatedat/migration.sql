-- Fix: remove DB-level default from addresses.updatedAt (@updatedAt is managed by Prisma client)
ALTER TABLE "addresses" ALTER COLUMN "updatedAt" DROP DEFAULT;
