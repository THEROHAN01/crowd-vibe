import { PrismaClient } from "../prisma/generated/client";

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

if (!globalForPrisma.prisma) {
	if (process.env.VITEST) {
		const { PrismaPg } = await import("@prisma/adapter-pg");
		const adapter = new PrismaPg({
			connectionString: process.env.DATABASE_URL!,
		});
		globalForPrisma.prisma = new PrismaClient({ adapter });
	} else {
		const { PrismaNeon } = await import("@prisma/adapter-neon");
		const { env } = await import("@crowd-vibe/env/server");
		const adapter = new PrismaNeon({ connectionString: env.DATABASE_URL });
		globalForPrisma.prisma = new PrismaClient({ adapter });
	}
}

export default globalForPrisma.prisma;
