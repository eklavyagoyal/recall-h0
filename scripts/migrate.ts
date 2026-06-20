import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { Pool, type PoolConfig } from "pg";
import { DEPLOY_TARGET, EMBED_DIM } from "../lib/config";

const currentDir = dirname(fileURLToPath(import.meta.url));
const migrationsDir = join(currentDir, "..", "db", "migrations");
const embedDimToken = "__EMBED_DIM__";

if (!Number.isInteger(EMBED_DIM) || EMBED_DIM < 1 || EMBED_DIM > 16000) {
  throw new Error(
    `EMBED_DIM must be an integer in 1..16000 (pgvector limit); got ${String(
      EMBED_DIM,
    )}. Set EMBED_DIM in your env (local=384).`,
  );
}

function poolConfig(): PoolConfig {
  if (DEPLOY_TARGET === "aurora") {
    const caPath =
      process.env.RDS_CA_BUNDLE ?? join(currentDir, "..", "certs", "rds-global-bundle.pem");
    if (!existsSync(caPath)) {
      throw new Error(
        `Aurora TLS CA bundle not found at ${caPath}. Download the RDS global bundle or set RDS_CA_BUNDLE.`,
      );
    }
    const ssl = { ca: readFileSync(caPath, "utf8"), rejectUnauthorized: true } as const;

    const url = process.env.DATABASE_URL;
    if (url) {
      return { connectionString: url, ssl };
    }
    // No DATABASE_URL: discrete fields + PGPASSWORD (read by pg). No URL to encode.
    const host = process.env.AURORA_HOST;
    if (!host) {
      throw new Error("DEPLOY_TARGET=aurora requires DATABASE_URL, or AURORA_HOST + PGPASSWORD.");
    }
    return {
      host,
      port: Number(process.env.AURORA_PORT ?? 5432),
      database: process.env.AURORA_DB ?? "recall",
      user: process.env.AURORA_USER ?? "recall",
      ssl,
    };
  }

  const url = process.env.DATABASE_URL ?? "postgres://recall:recall@localhost:5433/recall";
  return { connectionString: url };
}

async function ensureMigrationsTable(pool: Pool): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      filename text PRIMARY KEY,
      applied_at timestamptz NOT NULL DEFAULT now()
    );
  `);
}

async function appliedSet(pool: Pool): Promise<Set<string>> {
  const { rows } = await pool.query<{ filename: string }>("SELECT filename FROM schema_migrations");
  return new Set(rows.map((row) => row.filename));
}

function migrationFiles(): string[] {
  return readdirSync(migrationsDir)
    .filter((file) => file.endsWith(".sql"))
    .sort();
}

function loadSql(filename: string): string {
  const raw = readFileSync(join(migrationsDir, filename), "utf8");
  return raw.split(embedDimToken).join(String(EMBED_DIM));
}

async function applyMigration(pool: Pool, filename: string): Promise<void> {
  const sql = loadSql(filename);
  const client = await pool.connect();

  try {
    await client.query("BEGIN");
    await client.query(sql);
    await client.query("INSERT INTO schema_migrations (filename) VALUES ($1)", [filename]);
    await client.query("COMMIT");
    console.log(`  ✓ ${filename}`);
  } catch (error) {
    await client.query("ROLLBACK");
    console.error(`  ✗ ${filename} — rolled back. ${(error as Error).message}`);
    throw error;
  } finally {
    client.release();
  }
}

async function main(): Promise<void> {
  const pool = new Pool(poolConfig());

  try {
    await ensureMigrationsTable(pool);
    const done = await appliedSet(pool);
    const files = migrationFiles();
    const pending = files.filter((file) => !done.has(file));

    if (pending.length === 0) {
      console.log(`✓ schema up to date — ${files.length} migration(s) already applied. No-op.`);
      return;
    }

    console.log(
      `Applying ${pending.length} migration(s) [DEPLOY_TARGET=${DEPLOY_TARGET}, EMBED_DIM=${EMBED_DIM}]...`,
    );

    for (const filename of pending) {
      await applyMigration(pool, filename);
    }

    console.log("✓ migrations complete.");
  } finally {
    await pool.end();
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
