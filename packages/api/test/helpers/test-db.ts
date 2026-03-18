import prisma from "@crowd-vibe/db";

export { prisma as testPrisma };

export async function resetDatabase() {
  await prisma.$executeRawUnsafe(
    `TRUNCATE TABLE vote, song, guest_user, venue_session, venue, account, session, verification, "user" CASCADE`,
  );
}
