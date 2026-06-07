ALTER TABLE "stores" ADD COLUMN "subdomain" TEXT;
CREATE UNIQUE INDEX "stores_subdomain_key" ON "stores"("subdomain");
