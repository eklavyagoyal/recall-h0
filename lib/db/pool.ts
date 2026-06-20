import { readFileSync } from "node:fs";
import { join } from "node:path";
import { attachDatabasePool } from "@vercel/functions";
import { Pool, type PoolConfig } from "pg";
import { config } from "@/lib/config";

// Verify Aurora's server certificate against the Amazon RDS global CA bundle when
// it is present (shipped with the functions via next.config outputFileTracingIncludes,
// and present locally for seeding). Falls back to encrypted-but-unverified TLS only
// if the bundle is missing, so the connection is never plaintext.
function auroraSsl(): PoolConfig["ssl"] {
  // The RDS global CA bundle is committed at certs/ and shipped with the functions
  // via next.config outputFileTracingIncludes, so it is always present. We always
  // verify the server cert against it (rejectUnauthorized: true) and never downgrade
  // to unverified TLS — a missing bundle throws loudly rather than risking MITM.
  const ca = readFileSync(join(process.cwd(), "certs", "rds-global-bundle.pem"), "utf8");
  return { ca, rejectUnauthorized: true };
}

function createPoolConfig(): PoolConfig {
  if (config.deployTarget === "aurora") {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
      throw new Error("DEPLOY_TARGET=aurora requires DATABASE_URL (the Aurora connection string).");
    }

    return {
      connectionString,
      max: 5,
      idleTimeoutMillis: 10_000,
      ssl: auroraSsl(),
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
