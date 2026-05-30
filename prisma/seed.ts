import { PrismaClient, UserRole, SubscriptionStatus } from '@prisma/client';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import * as bcrypt from 'bcrypt';
import * as dotenv from 'dotenv';

dotenv.config();

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter } as any);

async function main() {
  console.log('🌱 Iniciando seed...');

  const categories = await Promise.all([
    prisma.category.upsert({ where: { name: 'Ropa' },        update: {}, create: { name: 'Ropa',        iconUrl: null } }),
    prisma.category.upsert({ where: { name: 'Calzado' },     update: {}, create: { name: 'Calzado',     iconUrl: null } }),
    prisma.category.upsert({ where: { name: 'Accesorios' },  update: {}, create: { name: 'Accesorios',  iconUrl: null } }),
    prisma.category.upsert({ where: { name: 'Belleza' },     update: {}, create: { name: 'Belleza',     iconUrl: null } }),
    prisma.category.upsert({ where: { name: 'Hogar' },       update: {}, create: { name: 'Hogar',       iconUrl: null } }),
    prisma.category.upsert({ where: { name: 'Tecnología' },  update: {}, create: { name: 'Tecnología',  iconUrl: null } }),
    prisma.category.upsert({ where: { name: 'Deportes' },    update: {}, create: { name: 'Deportes',    iconUrl: null } }),
    prisma.category.upsert({ where: { name: 'Alimentos' },   update: {}, create: { name: 'Alimentos',   iconUrl: null } }),
    prisma.category.upsert({ where: { name: 'Juguetes' },    update: {}, create: { name: 'Juguetes',    iconUrl: null } }),
    prisma.category.upsert({ where: { name: 'Mascotas' },    update: {}, create: { name: 'Mascotas',    iconUrl: null } }),
  ]);
  console.log(`✅ ${categories.length} categorías creadas`);

  const plan = await prisma.plan.upsert({
    where: { name: 'Básico' },
    update: {},
    create: {
      name: 'Básico',
      price: 0,
      maxProducts: 20,
      maxPhotos: 3,
      canUseQR: true,
      canShowRating: true,
    },
  });
  console.log(`✅ Plan "${plan.name}" listo`);

  const storeSeeds = [
    { firstName: 'Maria',   lastName: 'Lopez',    email: 'moda.linda@seed.com',    storeName: 'Moda Linda',    storeType: 'Ropa urbana',      city: 'La Paz',         rating: 4.8, totalReviews: 120, totalSales: 340 },
    { firstName: 'Alex',    lastName: 'Quispe',   email: 'alex.store@seed.com',    storeName: 'Alex Store',    storeType: 'Poleras y más',    city: 'Cochabamba',     rating: 4.7, totalReviews:  98, totalSales: 210 },
    { firstName: 'Sofia',   lastName: 'Guzman',   email: 'beauty.glow@seed.com',   storeName: 'Beauty Glow',   storeType: 'Belleza y cuidado',city: 'Santa Cruz',     rating: 4.9, totalReviews: 205, totalSales: 510 },
    { firstName: 'Carlos',  lastName: 'Mamani',   email: 'tech.bolivia@seed.com',  storeName: 'Tech Bolivia',  storeType: 'Tecnología',       city: 'La Paz',         rating: 4.5, totalReviews:  60, totalSales: 180 },
    { firstName: 'Lucia',   lastName: 'Flores',   email: 'casa.linda@seed.com',    storeName: 'Casa Linda',    storeType: 'Hogar y decoración',city: 'Oruro',         rating: 4.6, totalReviews:  77, totalSales: 230 },
    { firstName: 'Pedro',   lastName: 'Condori',  email: 'sport.bol@seed.com',     storeName: 'Sport Bolivia', storeType: 'Artículos deportivos',city: 'Cochabamba',  rating: 4.4, totalReviews:  45, totalSales: 130 },
    { firstName: 'Ana',     lastName: 'Vargas',   email: 'dulce.hogar@seed.com',   storeName: 'Dulce Hogar',   storeType: 'Repostería',       city: 'Santa Cruz',     rating: 4.8, totalReviews: 180, totalSales: 420 },
    { firstName: 'Roberto', lastName: 'Salinas',  email: 'moda.hombre@seed.com',   storeName: 'Moda Hombre',   storeType: 'Ropa masculina',   city: 'La Paz',         rating: 4.3, totalReviews:  35, totalSales:  90 },
  ];

  const password = await bcrypt.hash('Seed1234!', 10);
  const endDate = new Date();
  endDate.setFullYear(endDate.getFullYear() + 1);

  let storesCreated = 0;
  for (const seed of storeSeeds) {
    const user = await prisma.user.upsert({
      where: { email: seed.email },
      update: {},
      create: {
        email: seed.email,
        password,
        firstName: seed.firstName,
        lastName: seed.lastName,
        role: UserRole.VENDOR,
        isProfileComplete: true,
      },
    });

    const store = await prisma.store.upsert({
      where: { ownerId: user.id },
      update: { rating: seed.rating, totalReviews: seed.totalReviews, totalSales: seed.totalSales },
      create: {
        ownerId: user.id,
        name: seed.storeName,
        storeType: seed.storeType,
        city: seed.city,
        isOpen: true,
        rating: seed.rating,
        totalReviews: seed.totalReviews,
        totalSales: seed.totalSales,
      },
    });

    await prisma.subscription.upsert({
      where: { storeId: store.id },
      update: { status: SubscriptionStatus.ACTIVE },
      create: {
        storeId: store.id,
        planId: plan.id,
        status: SubscriptionStatus.ACTIVE,
        startDate: new Date(),
        endDate,
      },
    });

    storesCreated++;
  }
  console.log(`✅ ${storesCreated} tiendas con suscripción ACTIVE creadas`);
  console.log('🎉 Seed completado');
}

main()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
