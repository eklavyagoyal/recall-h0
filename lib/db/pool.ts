import { attachDatabasePool } from "@vercel/functions";
import { Pool, type PoolConfig } from "pg";
import { config } from "@/lib/config";

function createPoolConfig(): PoolConfig {
  if (config.deployTarget === "aurora") {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
      throw new Error("DEPLOY_TARGET=aurora requires DATABASE_URL until Phase 09 OIDC wiring lands.");
    }

    return {
      connectionString,
      max: 5,
      idleTimeoutMillis: 10_000,
      ssl: { rejectUnauthorized: true },
    };
  }

  return {
    connectionString: config.databaseUrl,
    max: 5,
    idleTimeoutMillis: 10_000,
    connectionTimeoutMillis: 10_000,
    statement_timeout: 15_000,
  };
}

export const pool = new Pool(createPoolConfig());

if (process.env.VERCEL) {
  attachDatabasePool(pool);
}

export function getPool(): Pool {
  return pool;
}
