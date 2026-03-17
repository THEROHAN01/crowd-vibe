import { env } from "@crowd-vibe/env/server";
import { Polar } from "@polar-sh/sdk";

export const polarClient = env.POLAR_ACCESS_TOKEN
  ? new Polar({
      accessToken: env.POLAR_ACCESS_TOKEN,
      server: "sandbox",
    })
  : null;
