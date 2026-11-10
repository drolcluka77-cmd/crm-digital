import { PrismaClient } from "@prisma/client";

// Standard Next.js dev-mode singleton so hot-reloading doesn't spawn a
// new PrismaClient (and a new SQLite connection) on every file change.
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
