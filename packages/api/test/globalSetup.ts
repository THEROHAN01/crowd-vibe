import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dbPackageDir = path.resolve(__dirname, "../../../db");

export function setup() {
  const url = process.env.DATABASE_URL ?? "";
  if (!url.includes("crowdvibe_test")) {
    throw new Error(
      `globalSetup: DATABASE_URL does not point to the test database.\n` +
        `Got: ${url}\n` +
        `Run tests via npm scripts (which load .env.test), not vitest directly.`,
    );
  }

  execFileSync(
    "npx",
    ["prisma", "db", "push", "--force-reset"],
    { stdio: "inherit", cwd: dbPackageDir },
  );
}
