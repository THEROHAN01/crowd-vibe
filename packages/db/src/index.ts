import { PrismaClient } from "../prisma/generated/client";

let prisma: PrismaClient;

if (process.env.VITEST) {
  // Dynamic import to avoid loading pg driver in production/edge environments
  const { PrismaPg } = await import("@prisma/adapter-pg");
  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
  prisma = new PrismaClient({ adapter });
} else {
  const { PrismaNeon } = await import("@prisma/adapter-neon");
  const { env } = await import("@crowd-vibe/env/server");
  const adapter = new PrismaNeon({ connectionString: env.DATABASE_URL });
  prisma = new PrismaClient({ adapter });
}

export default prisma;
