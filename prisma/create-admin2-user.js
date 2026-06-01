// @ts-check
/* eslint-disable */
/**
 * Crea usuario de prueba admin2@gmail.com con contraseña 12345678.
 * Ejecutar: node prisma/create-admin2-user.js
 */

"use strict";

const { PrismaClient, UserRole } = require("@prisma/client");
const { PrismaPg } = require("@prisma/adapter-pg");
const { Pool } = require("pg");
const bcrypt = require("bcrypt");
require("dotenv/config");

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log("🌱  Creando usuario admin2@gmail.com …");

  const existing = await prisma.user.findUnique({
    where: { email: "admin2@gmail.com" },
  });

  if (existing) {
    console.log("  ℹ️   Usuario admin2@gmail.com ya existe (id:", existing.id, ")");
    console.log("       Role:", existing.role);
    return;
  }

  const hashedPassword = await bcrypt.hash("12345678", 10);

  const user = await prisma.user.create({
    data: {
      email: "admin2@gmail.com",
      firstName: "Admin",
      lastName: "Dos",
      password: hashedPassword,
      role: UserRole.VENDOR,
      isProfileComplete: true,
      notificationsEnabled: true,
    },
  });

  console.log("  ✅  Usuario creado:");
  console.log("       id:      ", user.id);
  console.log("       email:   ", user.email);
  console.log("       role:    ", user.role);
  console.log("       password: 12345678  (mínimo 8 caracteres ✓)");
}

main()
  .catch((err) => {
    console.error("❌  Error:", err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
