import { PrismaClient } from "@prisma/client";

// Evita recriar o client a cada hot-reload em dev (esgotaria conexões do MySQL).
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
