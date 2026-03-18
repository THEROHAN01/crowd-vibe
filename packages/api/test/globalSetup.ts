import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dbPackageDir = path.resolve(__dirname, "../../db");

export function setup() {
  const url = process.env.DATABASE_URL ?? "";
  if (!url.includes("crowdvibe_test")) {
    throw new Error(
      `globalSetup: DATABASE_URL does not point to the test database.\n` +
        `Got: ${url}\n` +
        `Run tests via npm scripts (which load .env.test), not vitest directly.`,
    );
  }

  const prismaPath = path.resolve(
    __dirname,
    "../../../node_modules/.bin/prisma",
  );
  execFileSync(
    process.execPath,
    [prismaPath, "db", "push", "--force-reset"],
    {
      stdio: "inherit",
      cwd: dbPackageDir,
      env: {
        ...process.env,
        // This is a test database (crowdvibe_test on port 5433) — safe to reset.
        PRISMA_USER_CONSENT_FOR_DANGEROUS_AI_ACTION:
          "yes, reset the test database",
      },
    },
  );
}
