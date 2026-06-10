import { PrismaClient } from "@prisma/client";

/**
 * PrismaClient singleton. In Next.js dev, hot-reload re-evaluates modules,
 * which would otherwise create a new client (and connection pool) per reload.
 * Stashing the instance on globalThis keeps exactly one client alive.
 */
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
