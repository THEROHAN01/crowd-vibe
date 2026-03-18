import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    projects: [
      {
        test: {
          name: "unit",
          include: ["packages/api/src/**/*.test.ts"],
          exclude: ["**/*.integration.test.ts"],
        },
      },
      {
        test: {
          name: "integration",
          include: ["packages/api/src/**/*.integration.test.ts"],
          globalSetup: ["packages/api/test/globalSetup.ts"],
          fileParallelism: false,
        },
      },
    ],
  },
});
