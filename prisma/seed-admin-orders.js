// @ts-check
/* eslint-disable */
/**
 * Seed idempotente para admin@gmail.com
 * Crea usuario, tienda, productos, clientes y 12 pedidos de prueba.
 * Ejecutar: node prisma/seed-admin-orders.js
 */

"use strict";

const { PrismaClient, PaymentType, UserRole } = require("@prisma/client");
const { PrismaPg } = require("@prisma/adapter-pg");
const { Pool } = require("pg");
const bcrypt = require("bcrypt");
require("dotenv/config");

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

// ── helpers ──────────────────────────────────────────────────────────────────

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function daysAgo(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d;
}

// ── main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log("🌱  Iniciando seed para admin@gmail.com …");

  // 1. Usuario admin
  let adminUser = await prisma.user.findUnique({ where: { email: "admin@gmail.com" } });

  if (!adminUser) {
    const hashedPassword = await bcrypt.hash("Password123", 10);
    adminUser = await prisma.user.create({
      data: {
        email: "admin@gmail.com",
        firstName: "Admin",
        lastName: "Tienda",
        password: hashedPassword,
        role: UserRole.VENDOR,
        isProfileComplete: true,
        notificationsEnabled: true,
      },
    });
    console.log("  ✅  Usuario admin@gmail.com creado. Password: Password123");
  } else {
    console.log("  ℹ️   Usuario admin@gmail.com ya existe, omitiendo creación.");
  }

  // 2. Tienda
  let store = await prisma.store.findUnique({ where: { ownerId: adminUser.id } });

  if (!store) {
    store = await prisma.store.create({
      data: {
        ownerId: adminUser.id,
        name: "Tienda Admin",
        description: "Uniformes médicos de calidad",
        whatsapp: "71234567",
        address: "Av. América #123, Santa Cruz",
        city: "Santa Cruz",
        isOpen: true,
      },
    });
    console.log("  ✅  Tienda 'Tienda Admin' creada.");
  } else {
    console.log("  ℹ️   Tienda ya existe:", store.name);
  }

  // 3. Método de pago de la tienda
  const existingPM = await prisma.storePaymentMethod.findFirst({
    where: { storeId: store.id, type: PaymentType.TRANSFERENCIA },
  });

  if (!existingPM) {
    await prisma.storePaymentMethod.create({
      data: {
        storeId: store.id,
        type: PaymentType.TRANSFERENCIA,
        bankName: "Banco Unión",
        accountHolder: "Admin Tienda",
        accountNumber: "1234567890",
      },
    });
    console.log("  ✅  Método de pago creado: Banco Unión.");
  } else {
    console.log("  ℹ️   Método de pago ya existe.");
  }

  // 4. Productos
  const productsDefs = [
    { name: "Conjunto Antifluido Azul", stock: 6, price: 120 },
    { name: "Polera médica", stock: 15, price: 80 },
    { name: "Pantalón médico", stock: 4, price: 90 },
    { name: "Chaqueta médica", stock: 0, price: 150 },
    { name: "Gorro quirúrgico", stock: 12, price: 35 },
  ];

  const products = [];

  for (const def of productsDefs) {
    let product = await prisma.product.findFirst({
      where: { storeId: store.id, name: def.name },
    });

    if (!product) {
      product = await prisma.product.create({
        data: {
          storeId: store.id,
          name: def.name,
          stock: def.stock,
          price: def.price,
          isAvailable: def.stock > 0,
          isVisible: true,
        },
      });
      console.log(`  ✅  Producto creado: ${def.name}`);
    } else {
      console.log(`  ℹ️   Producto ya existe: ${def.name}`);
    }

    products.push(product);
  }

  // 5. Clientes (usuarios compradores)
  const clientsDefs = [
    { firstName: "María", lastName: "López", phoneNumber: "71234568" },
    { firstName: "Pedro", lastName: "Ramírez", phoneNumber: "70011222" },
    { firstName: "Ana", lastName: "Silva", phoneNumber: "71555556" },
    { firstName: "Luis", lastName: "Fernández", phoneNumber: "69000999" },
    { firstName: "Carla", lastName: "Soliz", phoneNumber: "72123456" },
  ];

  const clients = [];

  for (const def of clientsDefs) {
    let client = await prisma.user.findUnique({ where: { phoneNumber: def.phoneNumber } });

    if (!client) {
      const pw = await bcrypt.hash("Cliente123", 10);
      client = await prisma.user.create({
        data: {
          firstName: def.firstName,
          lastName: def.lastName,
          phoneNumber: def.phoneNumber,
          password: pw,
          role: UserRole.CLIENT,
          isProfileComplete: true,
        },
      });
      console.log(`  ✅  Cliente creado: ${def.firstName} ${def.lastName}`);
    } else {
      console.log(`  ℹ️   Cliente ya existe: ${def.firstName} ${def.lastName}`);
    }

    clients.push(client);
  }

  // 6. Pedidos — 3 por cada estado (12 en total)
  const orderDefs = [
    // PENDING
    {
      client: clients[0],
      status: "PENDING",
      deliveryAddress: "Calle Bolívar 210, Santa Cruz",
      notes: "Entregar en horario de mañana",
      daysAgo: 1,
      items: [
        { product: products[0], qty: 2 },
        { product: products[4], qty: 1 },
      ],
    },
    {
      client: clients[1],
      status: "PENDING",
      deliveryAddress: "Av. Monseñor Rivero km 2, Santa Cruz",
      notes: null,
      daysAgo: 2,
      items: [
        { product: products[1], qty: 3 },
      ],
    },
    {
      client: clients[2],
      status: "PENDING",
      deliveryAddress: "Calle Potosí 45, Santa Cruz",
      notes: "Traer factura",
      daysAgo: 0,
      items: [
        { product: products[2], qty: 1 },
        { product: products[1], qty: 2 },
      ],
    },
    // PAID
    {
      client: clients[3],
      status: "PAID",
      deliveryAddress: "Av. Grigotá 890, Santa Cruz",
      notes: null,
      daysAgo: 4,
      items: [
        { product: products[0], qty: 1 },
        { product: products[2], qty: 2 },
      ],
    },
    {
      client: clients[4],
      status: "PAID",
      deliveryAddress: "Radial 27 calle 5, Santa Cruz",
      notes: "Pago por QR confirmado",
      daysAgo: 5,
      items: [
        { product: products[1], qty: 1 },
        { product: products[4], qty: 3 },
      ],
    },
    {
      client: clients[0],
      status: "PAID",
      deliveryAddress: "Calle Bolívar 210, Santa Cruz",
      notes: null,
      daysAgo: 6,
      items: [
        { product: products[3], qty: 1 },
      ],
    },
    // SHIPPED
    {
      client: clients[1],
      status: "SHIPPED",
      deliveryAddress: "Av. Monseñor Rivero km 2, Santa Cruz",
      notes: "Pedido en camino",
      daysAgo: 8,
      items: [
        { product: products[0], qty: 2 },
        { product: products[1], qty: 1 },
      ],
    },
    {
      client: clients[2],
      status: "SHIPPED",
      deliveryAddress: "Calle Potosí 45, Santa Cruz",
      notes: null,
      daysAgo: 9,
      items: [
        { product: products[4], qty: 4 },
      ],
    },
    {
      client: clients[3],
      status: "SHIPPED",
      deliveryAddress: "Av. Grigotá 890, Santa Cruz",
      notes: "Envío express",
      daysAgo: 10,
      items: [
        { product: products[2], qty: 1 },
        { product: products[3], qty: 1 },
      ],
    },
    // DELIVERED
    {
      client: clients[4],
      status: "DELIVERED",
      deliveryAddress: "Radial 27 calle 5, Santa Cruz",
      notes: "Entregado sin novedad",
      daysAgo: 14,
      items: [
        { product: products[0], qty: 1 },
        { product: products[1], qty: 2 },
        { product: products[4], qty: 2 },
      ],
    },
    {
      client: clients[0],
      status: "DELIVERED",
      deliveryAddress: "Calle Bolívar 210, Santa Cruz",
      notes: null,
      daysAgo: 18,
      items: [
        { product: products[2], qty: 2 },
      ],
    },
    {
      client: clients[1],
      status: "DELIVERED",
      deliveryAddress: "Av. Monseñor Rivero km 2, Santa Cruz",
      notes: "Cliente satisfecho",
      daysAgo: 20,
      items: [
        { product: products[3], qty: 1 },
        { product: products[4], qty: 3 },
      ],
    },
  ];

  let createdOrders = 0;

  for (const def of orderDefs) {
    const subtotal = def.items.reduce(
      (sum, item) => sum + item.product.price * item.qty,
      0,
    );
    const total = subtotal;
    const createdAt = daysAgo(def.daysAgo);

    // Verificar si ya existe un pedido del mismo cliente + tienda + misma fecha (idempotencia básica)
    const existing = await prisma.order.findFirst({
      where: {
        storeId: store.id,
        clientId: def.client.id,
        status: def.status,
        total: total,
      },
    });

    if (existing) {
      console.log(`  ℹ️   Pedido ya existe para ${def.client.firstName} (${def.status}), omitiendo.`);
      continue;
    }

    await prisma.order.create({
      data: {
        clientId: def.client.id,
        storeId: store.id,
        status: def.status,
        paymentMethod: PaymentType.TRANSFERENCIA,
        deliveryAddress: def.deliveryAddress,
        notes: def.notes,
        subtotal: subtotal,
        shippingCost: 0,
        total: total,
        createdAt: createdAt,
        items: {
          create: def.items.map((item) => ({
            productId: item.product.id,
            quantity: item.qty,
            unitPrice: item.product.price,
          })),
        },
      },
    });

    createdOrders++;
    console.log(
      `  ✅  Pedido ${def.status} creado — ${def.client.firstName} ${def.client.lastName} — Bs ${total}`,
    );
  }

  console.log(`\n🎉  Seed completado. ${createdOrders} pedidos nuevos creados.`);
  console.log("    Email:    admin@gmail.com");
  console.log("    Password: Password123  (solo si el usuario fue creado en este run)");
}

main()
  .catch((err) => {
    console.error("❌  Error en seed:", err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
