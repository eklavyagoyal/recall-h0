import { config as loadEnv } from "dotenv";
import { beforeAll } from "vitest";

loadEnv({ path: ".env" });
loadEnv({ path: ".env.local", override: true });

process.env.DEPLOY_TARGET ??= "local";
process.env.DATABASE_URL ??= "postgres://recall:recall@localhost:5433/recall";

beforeAll(() => {
  if ((process.env.DEPLOY_TARGET ?? "local") !== "local") {
    throw new Error(
      `Tests must run with DEPLOY_TARGET=local, got ${process.env.DEPLOY_TARGET}.`,
    );
  }
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is not set.");
  }
});
