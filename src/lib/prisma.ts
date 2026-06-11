import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log:
      process.env.NODE_ENV === "development"
        ? ["query", "error", "warn"]
        : ["error"],
  });

// Retain the singleton in ALL environments. On Vercel each warm serverless
// instance then reuses one PrismaClient (and one pooled connection) instead of
// opening a fresh connection on every module re-evaluation.
globalForPrisma.prisma = prisma;

export default prisma;
