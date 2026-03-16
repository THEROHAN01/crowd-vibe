import { env } from "@crowd-vibe/env/server";
import { PrismaNeon } from "@prisma/adapter-neon";

import { PrismaClient } from "../prisma/generated/client";

const adapter = new PrismaNeon({
  connectionString: env.DATABASE_URL,
});

const prisma = new PrismaClient({ adapter });

export default prisma;
