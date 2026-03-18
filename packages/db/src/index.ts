import { PrismaNeon } from "@prisma/adapter-neon";
import { PrismaClient } from "../prisma/generated/client";
import { env } from "@crowd-vibe/env/server";

let prisma: PrismaClient;

if (process.env.VITEST) {
  prisma = new PrismaClient({ datasourceUrl: env.DATABASE_URL });
} else {
  const adapter = new PrismaNeon({ connectionString: env.DATABASE_URL });
  prisma = new PrismaClient({ adapter });
}

export default prisma;
