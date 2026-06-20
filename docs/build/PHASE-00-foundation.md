# Phase 00 — Foundation & Tooling

**Outcome:** An empty repo becomes a Next.js 15 App Router app at the **repository root** with TypeScript strict, Tailwind v4 + shadcn/ui (dark default), ESLint + Prettier, vitest + tsx, the **full canonical directory skeleton** stubbed, a local Docker Postgres (PostGIS 16 + pgvector) that comes up with **both** extensions, every canonical `package.json` script, `.env.example`, `lib/config.ts`, and a GREEN `pnpm typecheck && pnpm lint && pnpm test`.

**Depends on / Unblocks:** Depends on nothing (first phase; only [`CONVENTIONS.md`](./CONVENTIONS.md) must be read first). **Unblocks** [`PHASE-01-database-schema.md`](./PHASE-01-database-schema.md) (migrations need the Docker DB + `scripts/migrate.ts` + `lib/db/pool.ts`) and every later phase (they all build inside this skeleton).

**Effort:** ~0.5 day (most time is shadcn/Tailwind v4 wiring + the Docker image build + the first GREEN gate).

---

## 1. Objectives

1. Scaffold **Next.js 15+ App Router**, **React 19**, **TypeScript strict** at the **repo root** (the app is NOT nested under `docs/`).
2. Add **Tailwind CSS v4** + **shadcn/ui**, **dark mode default** (control-room aesthetic).
3. Add **ESLint + Prettier**, **vitest** + **tsx**, and wire every **canonical `package.json` script** ([CONVENTIONS §8](./CONVENTIONS.md#8-packagejson-scripts)).
4. Create the **entire canonical directory tree** ([CONVENTIONS §5](./CONVENTIONS.md#5-canonical-directory-tree)) — every file as a typed stub/placeholder with a header comment so later phases drop real code in with zero path guessing.
5. Write the local DB harness: `docker/Dockerfile.postgres` (`FROM postgis/postgis:16-3.4` + `postgresql-16-pgvector`), `docker/init.sql` (both extensions), `docker-compose.yml` (named volume, `pg_isready` healthcheck, port 5432, `recall/recall/recall`).
6. Write `.env.example` with **every canonical env var** ([CONVENTIONS §6](./CONVENTIONS.md#6-environment-variables)) and `lib/config.ts` reading env (the **one** `EMBED_DIM` constant lives here).
7. Land a **placeholder home** at `app/page.tsx` and a GREEN `pnpm typecheck`/`pnpm lint`/`pnpm test`.
8. Write `SETUP.md` and append a `BUILD_LOG.md` entry.

> **Spine reminder:** Phase 00 builds the *scaffold*, not the product. The product is the hero query ([CONVENTIONS §7](./CONVENTIONS.md#7-canonical-hero-query-forward-trace)). Do **not** start any UI here beyond a one-screen placeholder home; the database is the protagonist and it gets built first (Phases 01–03).

---

## 2. Prerequisites (checklist)

- [ ] **Node.js 24 LTS** installed — verify `node -v` prints `v24.x`.
- [ ] **pnpm** installed — `corepack enable && corepack prepare pnpm@latest --activate` (or `npm i -g pnpm`); verify `pnpm -v` ≥ 9.
- [ ] **Docker Desktop** (or Docker Engine + compose v2) running — verify `docker version` and `docker compose version` (must be compose **v2**, the `docker compose` subcommand, not `docker-compose`).
- [ ] **git** available; you are on a working branch (`git switch -c feat/phase-00-foundation`) — do not push unless asked.
- [ ] You have read [`CONVENTIONS.md`](./CONVENTIONS.md) (the contract) and [`../deep-dives/01-recall.md`](../deep-dives/01-recall.md) (the spec). The contract wins on any conflict.
- [ ] The working directory is the **repo root** (`/Users/eklavyagoyal/Projects/hackathons/etc/3.7-aws-vercel-h0`); `docs/` already exists with the strategy docs. **The Next.js app goes at this root, beside `docs/`, not inside it.**

---

## 3. Step-by-step

> Run everything from the repo root. The repo already contains `docs/`, `IDEATION.md`, `CODEX_HANDOFF.md` — we scaffold the app **around** them. If `create-next-app` refuses to run in a non-empty dir, scaffold in a temp dir and move files in (Step 3.1 handles both).

### 3.0 Branch + pin the toolchain

```bash
git init -q 2>/dev/null || true            # repo may not be a git repo yet
git switch -c feat/phase-00-foundation 2>/dev/null || git checkout -b feat/phase-00-foundation
corepack enable
corepack prepare pnpm@latest --activate
node -v && pnpm -v && docker compose version
```

Pin Node + the package manager so every agent and Vercel use the same runtime. Create `.nvmrc` and add `packageManager` (Step 3.6 sets `packageManager` inside `package.json`):

```bash
printf '24\n' > .nvmrc
```

### 3.1 Scaffold Next.js 15 at the repo root

The repo root is **non-empty** (it has `docs/`), so scaffold into a clean temp directory and move the generated files up. This avoids `create-next-app` clobbering or refusing the dir.

```bash
# Scaffold into a temp dir with all the flags pinned (no interactive prompts).
pnpm dlx create-next-app@latest .recall-scaffold \
  --ts --app --eslint --tailwind --src-dir=false --import-alias "@/*" \
  --use-pnpm --turbopack --no-git

# Move the generated app up into the repo root (dotfiles included), then clean up.
# Do NOT overwrite docs/, IDEATION.md, CODEX_HANDOFF.md — none of those exist in the scaffold.
shopt -s dotglob 2>/dev/null || setopt dotglob 2>/dev/null || true
cp -R .recall-scaffold/* .
rm -rf .recall-scaffold
```

> **Flag rationale:** `--src-dir=false` puts `app/` at the root (matches the canonical tree). `--import-alias "@/*"` matches every `@/lib/...` import in later phases. `--tailwind` gives Tailwind v4 (current default in `create-next-app@latest`). `--turbopack` speeds dev. We replace the generated `app/page.tsx`, `app/layout.tsx`, `app/globals.css` in Step 3.7.

Verify the scaffold landed:

```bash
test -f next.config.ts && test -d app && test -f tsconfig.json && echo "scaffold OK"
```

### 3.2 Install the pinned runtime dependencies

Install the dependencies later phases need now, so the skeleton imports resolve and `typecheck` passes against real type definitions (not phantom modules). These match [CONVENTIONS §3](./CONVENTIONS.md#3-pinned-tech-stack).

```bash
# Runtime deps (DB driver, Vercel fluid helpers, embeddings, map, graph, validation, AWS Bedrock)
pnpm add pg @vercel/functions @vercel/oidc-aws-credentials-provider \
  @xenova/transformers @aws-sdk/client-bedrock-runtime \
  maplibre-gl react-map-gl react-force-graph-2d zod

# Dev deps (types, test runner, ts execution, lint/format)
pnpm add -D typescript @types/node @types/react @types/react-dom @types/pg \
  tsx vitest @vitejs/plugin-react \
  prettier eslint-config-prettier
```

> If `react-force-graph-2d` or `react-map-gl` peer-warns against React 19, that is expected at this stage; they render client-side only and are not exercised until Phase 05. Do not downgrade React. Record any peer-warning in `BUILD_LOG.md`.

### 3.3 TypeScript strict config (`tsconfig.json`)

`create-next-app` emits a `tsconfig.json`; **replace it** with this strict, path-aliased version. Key additions over the default: `"strict": true` is already on, but we add `noUncheckedIndexedAccess`, `noImplicitOverride`, `exactOptionalPropertyTypes`, and explicit `paths`.

```jsonc
// tsconfig.json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["dom", "dom.iterable", "ES2022"],
    "module": "esnext",
    "moduleResolution": "bundler",
    "jsx": "preserve",
    "allowJs": true,
    "skipLibCheck": true,
    "esModuleInterop": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "incremental": true,
    "noEmit": true,

    // ── strict family ───────────────────────────────
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "noImplicitOverride": true,
    "exactOptionalPropertyTypes": true,
    "forceConsistentCasingInFileNames": true,
    "verbatimModuleSyntax": false,

    "plugins": [{ "name": "next" }],
    "baseUrl": ".",
    "paths": { "@/*": ["./*"] }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
```

> `exactOptionalPropertyTypes` is strict but pays off in the API contract types ([CONVENTIONS §10](./CONVENTIONS.md#10-api-response-contract)); if a later phase finds it too aggressive, that is a deliberate, logged decision — do not silently relax it here.

### 3.4 Tailwind v4 + shadcn/ui (dark default)

Tailwind v4 ships with `create-next-app@latest` (the `@tailwindcss/postcss` plugin + a single `@import "tailwindcss";` in CSS — **no `tailwind.config.js` required**). Initialize shadcn/ui, which writes `components.json`, the `cn()` helper at `lib/utils.ts`, and registers the `components/ui` path.

```bash
# shadcn CLI init — choose: TypeScript = yes, style = default, base color = neutral,
# CSS variables = yes. It detects Tailwind v4 and App Router automatically.
pnpm dlx shadcn@latest init -d

# Add the handful of primitives Phase 00 needs to render the placeholder home
# (more get added in Phases 05–07). -d uses defaults / no prompts.
pnpm dlx shadcn@latest add button card badge -d
```

> If `shadcn init` cannot auto-detect the alias, point it at `@/components` and `@/lib/utils` when asked. `components.json` must reference `app/globals.css` for the CSS variables. Verify `lib/utils.ts` now exports `cn` — later phases import `{ cn } from "@/lib/utils"`.

**Force dark mode by default.** shadcn theming uses a `.dark` class on `<html>`. We hardcode it on the root element in `app/layout.tsx` (Step 3.7) — no theme toggle in the spine; the control-room aesthetic is always dark.

### 3.5 Prettier + ESLint

`create-next-app` already wrote an ESLint flat config (`eslint.config.mjs`) extending `next/core-web-vitals`. Add Prettier and make ESLint defer formatting to it.

```bash
cat > .prettierrc.json <<'JSON'
{
  "semi": true,
  "singleQuote": false,
  "trailingComma": "all",
  "printWidth": 100,
  "tabWidth": 2
}
JSON

cat > .prettierignore <<'TXT'
.next
node_modules
pnpm-lock.yaml
*.sql
TXT
```

Edit `eslint.config.mjs` to append `eslint-config-prettier` (turns off rules that fight Prettier) and ignore generated paths:

```js
// eslint.config.mjs
import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";
import prettier from "eslint-config-prettier";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const compat = new FlatCompat({ baseDirectory: __dirname });

const config = [
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  prettier,
  {
    ignores: [".next/**", "node_modules/**", "db/migrations/**", "**/*.sql"],
  },
];

export default config;
```

### 3.6 `package.json` — canonical scripts + metadata

Open `package.json` and set the scripts block to the canonical set ([CONVENTIONS §8](./CONVENTIONS.md#8-packagejson-scripts)) and pin the package manager + Node engine. Keep the `dependencies`/`devDependencies` that pnpm already wrote.

```jsonc
// package.json  (merge — keep the dependency blocks pnpm generated)
{
  "name": "recall",
  "version": "0.0.0",
  "private": true,
  "packageManager": "pnpm@9.0.0",
  "engines": { "node": ">=24" },
  "scripts": {
    "dev": "next dev --turbopack",
    "build": "next build",
    "start": "next start",
    "lint": "next lint",
    "typecheck": "tsc --noEmit",
    "test": "vitest run",
    "db:up": "docker compose up -d",
    "db:down": "docker compose down",
    "db:migrate": "tsx scripts/migrate.ts",
    "db:seed": "tsx db/seed/load.ts",
    "bench": "tsx scripts/trace-bench.ts"
  }
}
```

> `test` is `vitest run` (one-shot, CI-friendly, exits non-zero on failure) so the GREEN gate is deterministic; use `pnpm exec vitest` for watch mode while developing. `packageManager` must match your installed pnpm major.

### 3.7 Root app files (placeholder home, dark by default)

Replace the three generated files. The home is a **placeholder** that proves the dark control-room shell renders — not the Console.

```css
/* app/globals.css */
@import "tailwindcss";
@import "tw-animate-css";

@custom-variant dark (&:is(.dark *));

:root {
  --background: oklch(1 0 0);
  --foreground: oklch(0.145 0 0);
}

/* Control-room dark palette (red is the ONLY accent — contamination). */
.dark {
  --background: oklch(0.16 0.01 250);
  --foreground: oklch(0.93 0.01 250);
  --accent: oklch(0.62 0.23 25); /* contamination red */
}

@theme inline {
  --color-background: var(--background);
  --color-foreground: var(--foreground);
}

body {
  background: var(--background);
  color: var(--foreground);
  font-feature-settings: "rlig" 1, "calt" 1;
}
```

> The exact tokens above are a starting palette; shadcn's `init` may have written a fuller `:root`/`.dark` variable block — **keep shadcn's variables** and just ensure the `.dark` block sets a dark background and a red accent. The load-bearing facts for Phase 00: dark is default, red is the accent.

```tsx
// app/layout.tsx
import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Recall — The Outbreak Console",
  description:
    "Trace a contaminated food lot to every affected store in under a second. Aurora PostgreSQL + pgvector + PostGIS.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  // `dark` is hardcoded on <html>: the control-room aesthetic is always dark in the spine.
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}
```

```tsx
// app/page.tsx
// Placeholder home for Phase 00. The real Outbreak Console replaces this in Phase 05.
import { config } from "@/lib/config";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function Home() {
  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col justify-center gap-6 p-8">
      <div className="flex items-center gap-3">
        <span className="inline-block h-3 w-3 rounded-full bg-[var(--accent)]" />
        <h1 className="text-2xl font-semibold tracking-tight">
          Recall — The Outbreak Console
        </h1>
      </div>
      <p className="text-sm text-foreground/70">
        Phase 00 scaffold is live. The database is the protagonist; the hero
        query gets built next (Phases 01–03). This page is a placeholder.
      </p>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Runtime config (from env)</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2 text-xs">
          <Badge variant="secondary">DEPLOY_TARGET: {config.deployTarget}</Badge>
          <Badge variant="secondary">EMBED_PROVIDER: {config.embedProvider}</Badge>
          <Badge variant="secondary">EMBED_DIM: {config.embedDim}</Badge>
          <Badge variant="secondary">DEMO_TLC: {config.demoTlc}</Badge>
          <Badge variant="secondary">AWS_REGION: {config.awsRegion}</Badge>
        </CardContent>
      </Card>
    </main>
  );
}
```

### 3.8 `lib/config.ts` — the one place env is read

`EMBED_DIM` is **one constant**, read here; `incidents.embedding` becomes `vector(EMBED_DIM)` at migrate time (Phase 01). Everything that branches on environment reads from this module.

```ts
// lib/config.ts
// The single source of runtime configuration. Read env ONCE here; import `config` everywhere else.
// EMBED_DIM is the one constant that the schema's vector(EMBED_DIM) column is built from (Phase 01).

export type DeployTarget = "local" | "aurora";
export type EmbedProvider = "local" | "bedrock";

function required(name: string, value: string | undefined): string {
  if (!value || value.length === 0) {
    throw new Error(`Missing required env var: ${name}`);
  }
  return value;
}

function asInt(name: string, value: string | undefined, fallback: number): number {
  if (value === undefined) return fallback;
  const n = Number.parseInt(value, 10);
  if (Number.isNaN(n)) throw new Error(`Env var ${name} must be an integer, got: ${value}`);
  return n;
}

const deployTarget = (process.env.DEPLOY_TARGET ?? "local") as DeployTarget;
const embedProvider = (process.env.EMBED_PROVIDER ?? "local") as EmbedProvider;

export const config = {
  // ── core switches ──────────────────────────────────────────────
  deployTarget,
  embedProvider,
  /** vector(EMBED_DIM) column dimension. local = 384; bedrock = verified Titan v2 dim. */
  embedDim: asInt("EMBED_DIM", process.env.EMBED_DIM, 384),
  /** the pinned demo lot that traces to ~1,400 stores in <1s. */
  demoTlc: process.env.DEMO_TLC ?? "PRD-OUTBREAK-0001",

  // ── local Postgres (DEPLOY_TARGET=local) ───────────────────────
  databaseUrl: process.env.DATABASE_URL ?? "postgres://recall:recall@localhost:5432/recall",

  // ── AWS / Aurora (DEPLOY_TARGET=aurora) ────────────────────────
  awsRegion: process.env.AWS_REGION ?? "us-east-1",
  awsRoleArn: process.env.AWS_ROLE_ARN ?? "",
  aurora: {
    host: process.env.AURORA_HOST ?? "",
    port: asInt("AURORA_PORT", process.env.AURORA_PORT, 5432),
    db: process.env.AURORA_DB ?? "recall",
    user: process.env.AURORA_USER ?? "recall_app",
    secretArn: process.env.AURORA_SECRET_ARN ?? "",
  },

  // ── embeddings ─────────────────────────────────────────────────
  bedrockModelId: process.env.BEDROCK_MODEL_ID ?? "amazon.titan-embed-text-v2:0",
} as const;

/** Throw early (e.g. in scripts/migrate.ts) when DEPLOY_TARGET=aurora but Aurora env is missing. */
export function assertAuroraEnv(): void {
  if (config.deployTarget !== "aurora") return;
  required("AURORA_HOST", config.aurora.host);
  required("AWS_ROLE_ARN", config.awsRoleArn);
}
```

### 3.9 Docker: PostGIS 16 + pgvector image

The base image `postgis/postgis:16-3.4` already bundles PostGIS but **not** pgvector. We extend it and install the Debian package `postgresql-16-pgvector` from the PostgreSQL APT repo (PGDG), which `postgis/postgis` images are already configured against.

```dockerfile
# docker/Dockerfile.postgres
# Local dev database: PostGIS 16 (from the base image) + pgvector (added here).
# Cloud is Aurora Serverless v2 with the same two extensions (Phase 09); only DEPLOY_TARGET differs.
FROM postgis/postgis:16-3.4

# Install pgvector for PostgreSQL 16. The postgis/postgis image is Debian-based and already
# has the PGDG apt source configured, so postgresql-16-pgvector resolves directly.
RUN apt-get update \
  && apt-get install -y --no-install-recommends postgresql-16-pgvector \
  && rm -rf /var/lib/apt/lists/*

# init.sql is copied into the entrypoint dir; it runs ONLY on first init of an empty data dir.
COPY docker/init.sql /docker-entrypoint-initdb.d/10-extensions.sql
```

```sql
-- docker/init.sql
-- Runs once, on first cluster init (empty data dir), via /docker-entrypoint-initdb.d.
-- Creates BOTH extensions in the `recall` database so the local DB matches Aurora.
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS vector;
```

```yaml
# docker-compose.yml
services:
  postgres:
    build:
      context: .
      dockerfile: docker/Dockerfile.postgres
    image: recall-postgres:16-3.4-pgvector
    container_name: recall-postgres
    environment:
      POSTGRES_USER: recall
      POSTGRES_PASSWORD: recall
      POSTGRES_DB: recall
    ports:
      - "5432:5432"
    volumes:
      - recall_pgdata:/var/lib/postgresql/data
    healthcheck:
      # pg_isready returns 0 only when the server accepts connections.
      test: ["CMD-SHELL", "pg_isready -U recall -d recall"]
      interval: 5s
      timeout: 5s
      retries: 10
      start_period: 20s
    restart: unless-stopped

volumes:
  recall_pgdata:
```

> **Why a named volume?** Re-running `pnpm db:up` after a code change must NOT wipe seeded data. `init.sql` runs **only** when the volume is empty, so re-seeding is idempotent against the volume. To force a clean rebuild of extensions, `docker compose down -v` (drops the volume) then `pnpm db:up`.

Bring it up and prove both extensions exist (this is the DoD check):

```bash
pnpm db:up
# Wait for healthy, then verify BOTH extensions in one query:
until [ "$(docker inspect -f '{{.State.Health.Status}}' recall-postgres 2>/dev/null)" = "healthy" ]; do \
  echo "waiting for postgres…"; sleep 2; done
docker exec recall-postgres psql -U recall -d recall \
  -c "SELECT extname FROM pg_extension WHERE extname IN ('postgis','vector') ORDER BY extname;"
```

Expected output (order: `postgis` then `vector`):

```
 extname
---------
 postgis
 vector
(2 rows)
```

### 3.10 `.env.example` — every canonical env var

```bash
# .env.example  — copy to .env.local for Next.js, .env for tsx scripts. NEVER commit real secrets.

# ── Core switch (the ONLY dev↔cloud difference) ───────────────────
DEPLOY_TARGET=local                 # local | aurora

# ── Local Docker Postgres (DEPLOY_TARGET=local) ───────────────────
DATABASE_URL=postgres://recall:recall@localhost:5432/recall

# ── Embeddings ────────────────────────────────────────────────────
EMBED_PROVIDER=local                # local (@xenova/transformers, 384-dim) | bedrock (Titan v2)
EMBED_DIM=384                       # ONE constant. local=384; bedrock=verified Titan v2 dim
BEDROCK_MODEL_ID=amazon.titan-embed-text-v2:0   # verify output dim and set EMBED_DIM to match

# ── Demo ──────────────────────────────────────────────────────────
DEMO_TLC=PRD-OUTBREAK-0001          # pinned lot that traces to ~1,400 stores in <1s

# ── AWS / Aurora (DEPLOY_TARGET=aurora) ───────────────────────────
AWS_REGION=us-east-1
AWS_ROLE_ARN=arn:aws:iam::<ACCOUNT_ID>:role/recall-vercel-oidc   # assumed via OIDC keyless STS
AURORA_HOST=<cluster>.cluster-xxxx.us-east-1.rds.amazonaws.com
AURORA_PORT=5432
AURORA_DB=recall
AURORA_USER=recall_app
AURORA_SECRET_ARN=arn:aws:secretsmanager:us-east-1:<ACCOUNT_ID>:secret:recall/db-XXXXXX
```

Add `.env*` to `.gitignore` (keep `.env.example` tracked):

```bash
cat >> .gitignore <<'TXT'

# local env (never commit secrets)
.env
.env.local
.env*.local
TXT
```

### 3.11 Vitest config (+ a smoke test so the gate is real)

```ts
// vitest.config.ts
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import { resolve } from "node:path";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { "@": resolve(__dirname, ".") }, // mirror tsconfig "@/*" so test imports resolve
  },
  test: {
    environment: "node", // hero-query tests hit pg in node; component tests can opt into jsdom later
    include: ["test/**/*.test.ts", "test/**/*.test.tsx"],
    globals: true,
  },
});
```

Write a real (tiny) test so `pnpm test` is GREEN against an assertion, not an empty suite. It locks in `lib/config.ts`'s default contract:

```ts
// test/trace.test.ts
// Phase 00: a smoke test that proves the toolchain runs and config defaults hold.
// Phase 03 expands this file into the real hero-query correctness + adversarial suite.
import { describe, expect, it } from "vitest";
import { config } from "@/lib/config";

describe("config defaults (Phase 00 smoke)", () => {
  it("defaults to local deploy target", () => {
    expect(config.deployTarget).toBe("local");
  });

  it("defaults EMBED_DIM to 384 (local @xenova/transformers)", () => {
    expect(config.embedDim).toBe(384);
  });

  it("pins a non-empty DEMO_TLC", () => {
    expect(config.demoTlc.length).toBeGreaterThan(0);
  });
});
```

### 3.12 Create the FULL canonical directory skeleton (typed stubs)

Every file from [CONVENTIONS §5](./CONVENTIONS.md#5-canonical-directory-tree) must exist as a stub with a header comment so later phases never guess a path. The script below creates directories, then writes a **typed, compiling** placeholder into each file. Run it from the repo root.

> **Compile-safe stubs:** every `.ts`/`.tsx` stub either exports a typed placeholder or is intentionally empty-but-valid, so `pnpm typecheck` stays GREEN with the skeleton in place. SQL/JSON stubs are comments only.

```bash
# ── directories ──────────────────────────────────────────────────
mkdir -p \
  app/api/trace app/api/explain app/api/lineage app/api/incidents app/api/metrics \
  app/actions \
  components/console components/ui \
  lib/db/queries lib/embeddings \
  db/migrations db/seed \
  scripts test docker

# ── lib/types.ts (the API contract types; mirrors CONVENTIONS §10) ─
cat > lib/types.ts <<'TS'
// lib/types.ts — shared types mirroring the API response contract (CONVENTIONS §10).
// Filled out in Phase 03/04; stubbed here so imports resolve and typecheck stays green.

export type Edge = { parent: number; child: number; transform: string };

export type AffectedStore = {
  storeId: number;
  name: string;
  chain: string;
  address: string;
  lat: number;
  lng: number;
  units: number;
};

export type SimilarIncident = {
  incidentId: number;
  text: string;
  pathogen: string | null;
  score: number;
};

export type TraceResult = {
  meta: {
    latencyMs: number; // REAL measurement — never hardcoded
    lotCount: number;
    edgeCount: number;
    storeCount: number;
    totalUnits: number;
    asOf: string | null;
  };
  edges: Edge[];
  stores: AffectedStore[];
  incidents: SimilarIncident[];
  sql: string; // surfaced to the Query Inspector
};
TS

# ── lib/db/pool.ts (branches on DEPLOY_TARGET; real impl in Phase 03) ─
cat > lib/db/pool.ts <<'TS'
// lib/db/pool.ts — module-scope pg.Pool, branches on DEPLOY_TARGET (CONVENTIONS §4).
// Phase 03/10 add the real Pool + attachDatabasePool + OIDC. Stub keeps the type.
import type { Pool } from "pg";

export function getPool(): Pool {
  throw new Error("getPool() not implemented until Phase 03");
}
TS

# ── lib/db/explain.ts ─
cat > lib/db/explain.ts <<'TS'
// lib/db/explain.ts — runs EXPLAIN (ANALYZE, BUFFERS) on the hero query (Phase 06).
export {};
TS

# ── lib/db/queries/*.ts ─
cat > lib/db/queries/trace.ts <<'TS'
// lib/db/queries/trace.ts — the canonical hero query string + runTrace() (Phase 03).
// HERO SQL lives here as a raw parameterized string surfaced to the Query Inspector.
export {};
TS
cat > lib/db/queries/lineage.ts <<'TS'
// lib/db/queries/lineage.ts — one-JOIN lineage trail query (Phase 07).
export {};
TS
cat > lib/db/queries/incidents.ts <<'TS'
// lib/db/queries/incidents.ts — incident list + pgvector cluster query (Phase 07).
export {};
TS

# ── lib/embeddings/*.ts ─
cat > lib/embeddings/index.ts <<'TS'
// lib/embeddings/index.ts — embed dispatcher: chooses local | bedrock per EMBED_PROVIDER.
export {};
TS
cat > lib/embeddings/local.ts <<'TS'
// lib/embeddings/local.ts — @xenova/transformers, Xenova/all-MiniLM-L6-v2 (384-dim), zero credits.
export {};
TS
cat > lib/embeddings/bedrock.ts <<'TS'
// lib/embeddings/bedrock.ts — AWS Bedrock Titan Text Embeddings v2 (verify dim → EMBED_DIM).
export {};
TS

# ── app/actions/trace.ts ─
cat > app/actions/trace.ts <<'TS'
// app/actions/trace.ts — optional "use server" action wrapping runTrace (Phase 05).
export {};
TS

# ── app/api/*/route.ts (typed 501 stubs so routes exist and typecheck) ─
for r in trace explain lineage incidents metrics; do
cat > app/api/$r/route.ts <<TS
// app/api/$r/route.ts — implemented in Phase 04 (zod-validated; CONVENTIONS §10).
export async function GET(): Promise<Response> {
  return new Response("not implemented", { status: 501 });
}
TS
done

# ── components/console/*.tsx (typed placeholder components) ─
for c in TopBar GraphPane MapPane IncidentRail QueryInspector LineageDrawer IncidentInbox ScopeExport; do
cat > components/console/$c.tsx <<TS
// components/console/$c.tsx — Outbreak Console pane, wired in Phase 05–07.
export function $c(): React.ReactElement {
  return <div data-component="$c" />;
}
TS
done

# ── db/migrations/*.sql (comment-only stubs; real DDL in Phase 01) ─
cat > db/migrations/0001_extensions.sql <<'SQL'
-- 0001_extensions.sql — CREATE EXTENSION postgis; CREATE EXTENSION vector; (Phase 01)
SQL
cat > db/migrations/0002_schema.sql <<'SQL'
-- 0002_schema.sql — the 9 tables, FKs, CHECK constraints; embedding vector(EMBED_DIM) (Phase 01)
SQL
cat > db/migrations/0003_indexes.sql <<'SQL'
-- 0003_indexes.sql — btree + HNSW (idx_incidents_hnsw) + GiST (idx_stores_geom) (Phase 01)
SQL

# ── db/seed/*.ts ─
cat > db/seed/generate.ts <<'TS'
// db/seed/generate.ts — generate the ACYCLIC ~250k-edge DAG + stores + incidents (Phase 02).
export {};
TS
cat > db/seed/load.ts <<'TS'
// db/seed/load.ts — COPY/INSERT generated data into Postgres; PRINT actual counts (Phase 02).
export {};
TS

# ── scripts/*.ts ─
cat > scripts/migrate.ts <<'TS'
// scripts/migrate.ts — apply forward-only db/migrations/*.sql in order (Phase 01).
// Substitutes vector(EMBED_DIM) from lib/config at migrate time.
export {};
TS
cat > scripts/trace-bench.ts <<'TS'
// scripts/trace-bench.ts — measure trace p50/p99 over real volume; assert p50 < 1s (Phase 03).
export {};
TS

echo "skeleton created"
```

> **Note on the `app/api/*/route.ts` stubs:** they export `GET` returning `501` so the route compiles and Next recognizes it. Phase 04 replaces `GET` with the correct verb(s) per the contract (`/api/trace` and `/api/explain` are `POST`; `/api/incidents`, `/api/lineage`, `/api/metrics` are `GET`). The stub verb does not matter for Phase 00 — only that the file exists and typechecks.

### 3.13 `SETUP.md`

```bash
cat > SETUP.md <<'MD'
# Recall — Local Setup

> Full contract: `docs/build/CONVENTIONS.md`. Product spec: `docs/deep-dives/01-recall.md`.

## Prerequisites
- Node.js 24 LTS (`node -v` → v24.x). `corepack enable` for pnpm.
- Docker Desktop running (`docker compose version` → v2).

## First run (local spine)
```bash
cp .env.example .env.local        # and .env for tsx scripts
pnpm install                      # install toolchain
pnpm db:up                        # build + start Postgres (PostGIS 16 + pgvector)
pnpm db:migrate                   # apply migrations (Phase 01+)
pnpm db:seed                      # generate + load real volume (Phase 02+); prints actual counts
pnpm dev                          # http://localhost:3000
```

## Verify the DB came up with BOTH extensions
```bash
docker exec recall-postgres psql -U recall -d recall \
  -c "SELECT extname FROM pg_extension WHERE extname IN ('postgis','vector');"
# expect: postgis, vector
```

## GREEN gate (run before every commit)
```bash
pnpm typecheck && pnpm lint && pnpm test
```

## Reset the database (drops the volume + re-creates extensions)
```bash
pnpm db:down && docker compose down -v && pnpm db:up
```

## Cloud (Phases 09–10)
Set `DEPLOY_TARGET=aurora` and the `AURORA_*` / `AWS_*` env vars; see
`docs/build/PHASE-09-aws-aurora.md` and `docs/build/SETUP-AWS-V0.md`.
MD
```

### 3.14 Run the GREEN gate + the app

```bash
pnpm install            # ensure lockfile is current after editing package.json
pnpm typecheck          # tsc --noEmit → 0 errors
pnpm lint               # next lint → clean
pnpm test               # vitest run → 3 passing (config smoke)
pnpm dev                # open http://localhost:3000 → dark placeholder home with config badges
```

Then commit on the branch (do not push unless asked):

```bash
git add -A
git commit -m "feat: phase 00 foundation — scaffold app, docker postgres (postgis+pgvector), skeleton, green gate"
```

---

## 4. Key files

| Path | Purpose |
|---|---|
| `package.json` | Canonical scripts ([CONVENTIONS §8](./CONVENTIONS.md#8-packagejson-scripts)), `packageManager`, Node engine `>=24`. |
| `tsconfig.json` | TypeScript **strict** + `@/*` path alias + `noUncheckedIndexedAccess`/`exactOptionalPropertyTypes`. |
| `app/layout.tsx` | Root layout; **`dark` hardcoded on `<html>`** (control-room default). |
| `app/globals.css` | Tailwind v4 import + dark palette; **red is the only accent**. |
| `app/page.tsx` | Placeholder home rendering `lib/config` values (replaced by the Console in Phase 05). |
| `lib/config.ts` | **The one place env is read.** `EMBED_DIM`, `EMBED_PROVIDER`, `DEPLOY_TARGET`, `DEMO_TLC`, Aurora/Bedrock config. |
| `lib/types.ts` | Shared `TraceResult`/`Edge`/`AffectedStore`/`SimilarIncident` (API contract). |
| `lib/utils.ts` | shadcn `cn()` helper (written by `shadcn init`). |
| `docker/Dockerfile.postgres` | `FROM postgis/postgis:16-3.4` + `postgresql-16-pgvector`. |
| `docker/init.sql` | `CREATE EXTENSION postgis; CREATE EXTENSION vector;` (runs on first init). |
| `docker-compose.yml` | `postgres` service, named volume `recall_pgdata`, `pg_isready` healthcheck, port 5432. |
| `.env.example` | Every canonical env var ([CONVENTIONS §6](./CONVENTIONS.md#6-environment-variables)). |
| `vitest.config.ts` | vitest + `@` alias mirror; node environment. |
| `eslint.config.mjs` | `next/core-web-vitals` + `next/typescript` + `eslint-config-prettier`. |
| `.prettierrc.json` | Prettier config (the formatter of record). |
| `test/trace.test.ts` | Phase 00 config smoke test (grown into the hero-query suite in Phase 03). |
| (skeleton) `app/**`, `lib/**`, `db/**`, `scripts/**`, `components/**` | Every canonical-tree file as a typed/comment stub so later phases drop code in with no path guessing. |
| `SETUP.md` | Local run + reset + GREEN-gate instructions. |
| `BUILD_LOG.md` | Build-in-public log (append the §8 entry). |

---

## 5. Definition of Done

Each box must be checked with the exact command and the expected output.

- [ ] **App scaffolded at the repo root** (not under `docs/`):
  ```bash
  test -f app/layout.tsx && test -f app/page.tsx && test -f next.config.ts && echo OK
  ```
  → `OK`. And `ls docs/` still shows the strategy docs untouched.

- [ ] **Docker Postgres up with BOTH extensions** (the headline check):
  ```bash
  pnpm db:up
  docker exec recall-postgres psql -U recall -d recall \
    -c "SELECT extname FROM pg_extension WHERE extname IN ('postgis','vector') ORDER BY extname;"
  ```
  → two rows: `postgis`, `vector`.

- [ ] **Healthcheck reports healthy:**
  ```bash
  docker inspect -f '{{.State.Health.Status}}' recall-postgres
  ```
  → `healthy`.

- [ ] **`pnpm typecheck` clean:**
  ```bash
  pnpm typecheck
  ```
  → exits 0, no errors printed.

- [ ] **`pnpm lint` clean:**
  ```bash
  pnpm lint
  ```
  → `✔ No ESLint warnings or errors` (or equivalent clean exit 0).

- [ ] **`pnpm test` green:**
  ```bash
  pnpm test
  ```
  → `Test Files  1 passed (1)` / `Tests  3 passed (3)`.

- [ ] **`pnpm dev` serves the placeholder home:**
  ```bash
  pnpm dev   # then in another shell:
  curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3000
  ```
  → `200`; the browser shows the **dark** home with the config badges (DEPLOY_TARGET=local, EMBED_DIM=384, DEMO_TLC=…).

- [ ] **Build compiles** (catches strict/SSR issues the dev server hides):
  ```bash
  pnpm build
  ```
  → completes with `✓ Compiled successfully`.

- [ ] **Full canonical skeleton exists** — every file from [CONVENTIONS §5](./CONVENTIONS.md#5-canonical-directory-tree):
  ```bash
  for f in app/layout.tsx app/globals.css app/page.tsx \
    app/api/trace/route.ts app/api/explain/route.ts app/api/lineage/route.ts \
    app/api/incidents/route.ts app/api/metrics/route.ts app/actions/trace.ts \
    components/console/TopBar.tsx components/console/GraphPane.tsx components/console/MapPane.tsx \
    components/console/IncidentRail.tsx components/console/QueryInspector.tsx \
    components/console/LineageDrawer.tsx components/console/IncidentInbox.tsx components/console/ScopeExport.tsx \
    lib/config.ts lib/types.ts lib/db/pool.ts lib/db/explain.ts \
    lib/db/queries/trace.ts lib/db/queries/lineage.ts lib/db/queries/incidents.ts \
    lib/embeddings/index.ts lib/embeddings/local.ts lib/embeddings/bedrock.ts \
    db/migrations/0001_extensions.sql db/migrations/0002_schema.sql db/migrations/0003_indexes.sql \
    db/seed/generate.ts db/seed/load.ts scripts/migrate.ts scripts/trace-bench.ts test/trace.test.ts \
    docker/Dockerfile.postgres docker/init.sql docker-compose.yml vercel.json .env.example \
    package.json SETUP.md BUILD_LOG.md; do
    test -f "$f" || echo "MISSING: $f"; done; echo "skeleton check done"
  ```
  → prints `skeleton check done` with **no** `MISSING:` lines.

- [ ] **`SETUP.md` and `BUILD_LOG.md` written**; the §8 BUILD_LOG entry is appended.
- [ ] **No secrets committed:** `git status` shows `.env` / `.env.local` are ignored; only `.env.example` is tracked.

> `vercel.json` is part of the skeleton but its real contents (Fluid Compute, region `iad1`, runtime) land in [PHASE-10](./PHASE-10-vercel-deploy.md). For Phase 00, write a minimal valid stub: `{ "$schema": "https://openapi.vercel.sh/vercel.json" }`.

---

## 6. Common pitfalls & fixes

| Pitfall | Symptom | Fix |
|---|---|---|
| **pgvector missing from the image** | `ERROR: extension "vector" is not available` on init | The base `postgis/postgis:16-3.4` has **no** pgvector — you must `apt-get install postgresql-16-pgvector` in `Dockerfile.postgres` (Step 3.9). Rebuild with `docker compose build --no-cache postgres`. |
| **`apt-get install postgresql-16-pgvector` 404 / not found** | Build fails fetching the package | Ensure `apt-get update` runs **first** in the same `RUN`. The `postgis/postgis` image already has the PGDG apt source; if a network/mirror hiccup persists, pin to a known mirror or fall back to `pgvector/pgvector:pg16` as the base (it has pgvector but **not** PostGIS, then you'd install `postgresql-16-postgis-3` — only do this if PGDG is unreachable, and log the substitution). |
| **`init.sql` didn't run** | Extensions absent even after a clean build | `/docker-entrypoint-initdb.d` scripts run **only when the data dir is empty**. You re-used a populated volume. Run `docker compose down -v` then `pnpm db:up`. |
| **Architecture mismatch (Apple Silicon)** | Slow build or `exec format error` | The base image is multi-arch; if you hit it, add `platform: linux/amd64` under the `postgres` service (or build for arm64). Log it in BUILD_LOG. |
| **Port 5432 already in use** | `bind: address already in use` | A local Postgres is running. Stop it, or change the host port to `5433:5432` and update `DATABASE_URL` to `:5433`. |
| **Healthcheck never goes healthy** | `db:up` hangs / `State.Health.Status` stuck `starting` | First boot builds extensions; raise `start_period`. Check logs: `docker logs recall-postgres`. |
| **`create-next-app` refuses the non-empty dir** | "directory is not empty" | Use the temp-dir scaffold in Step 3.1 (`.recall-scaffold` then `cp -R`). |
| **shadcn can't find the alias** | init writes `components.json` with wrong paths | Re-run `shadcn init`, set components to `@/components`, utils to `@/lib/utils`, CSS to `app/globals.css`. Verify `lib/utils.ts` exports `cn`. |
| **Tailwind v4 looking for `tailwind.config.js`** | "config not found" or no styles | Tailwind v4 is config-less by default with `@import "tailwindcss";` in `globals.css` and `@tailwindcss/postcss` in `postcss.config.mjs`. Don't hand-create a v3-style config. |
| **`exactOptionalPropertyTypes` typecheck noise** | errors on optional props (`asOf?`) | This is intended strictness; type optionals as `T \| undefined` where you assign `undefined`. Don't relax the flag without a logged reason. |
| **`@/` imports fail in vitest** | "Cannot find module '@/lib/config'" | The alias must be in **both** `tsconfig.json` paths and `vitest.config.ts` resolve.alias (Step 3.11). |
| **`pnpm test` "no test files found" → exit 0 but vacuous** | gate is GREEN but meaningless | Keep `test/trace.test.ts` (Step 3.11) so the gate asserts something real. |
| **React 19 peer warnings (force-graph / react-map-gl)** | install warnings | Expected; do not downgrade React. Confirm they render in Phase 05. Log the warning. |

---

## 7. Cut-if-scope-bites

Phase 00 is almost entirely non-negotiable (it is the floor everything stands on), but if time is tight:

1. **Trim shadcn primitives** — `button card badge` are enough for the placeholder home; add the rest in Phase 05.
2. **Defer Prettier** — ESLint clean is the gate; Prettier is polish. (Keep it if cheap; it's a 2-minute add.)
3. **Defer the `platform:` / multi-arch tuning** — only touch it if your machine actually errors.

> **NEVER cut (the spine these enable):** the **Docker Postgres with BOTH `postgis` + `vector` extensions**, `lib/config.ts` with the **single `EMBED_DIM` constant**, the **full canonical skeleton** (later phases assume every path exists), TypeScript **strict**, and the **GREEN gate**. Cutting any of these breaks Phases 01–03 — and the hero query (the recursive CTE + PostGIS JOIN + pgvector rail + live `EXPLAIN`, real seed volume, live-URL deploy) is what wins. Phase 00 exists to make the protagonist (the database) reachable.

---

## 8. BUILD_LOG entry to append

Append to `BUILD_LOG.md` (create it if absent). This doubles as build-in-public content ([PHASE-12](./PHASE-12-build-in-public.md)).

```markdown
## Phase 00 — Foundation & tooling — <DATE>

**Shipped:** Next.js 15 App Router + React 19 + TS strict scaffolded at the repo root; Tailwind v4 +
shadcn/ui (dark default, red accent); ESLint + Prettier; vitest + tsx. Local Postgres in Docker
(`postgis/postgis:16-3.4` + `postgresql-16-pgvector`) comes up with BOTH extensions verified via
`pg_isready` healthcheck. Full canonical directory skeleton stubbed (every file typed/comment-stubbed).
`lib/config.ts` is the single env reader (EMBED_DIM=384 local). Every canonical `package.json` script wired.

**Proof / counts:**
- `SELECT extname FROM pg_extension WHERE extname IN ('postgis','vector')` → 2 rows (postgis, vector).
- `pnpm typecheck` → 0 errors · `pnpm lint` → clean · `pnpm test` → 3/3 green · `pnpm build` → compiled.
- `pnpm dev` serves the dark placeholder home (HTTP 200) with live config badges.

**Decisions / deviations:** <e.g. added platform: linux/amd64 for Apple Silicon | React 19 peer warnings
on react-force-graph-2d (kept, render-only) | base image stayed postgis/postgis:16-3.4>.

**Next:** Phase 01 — apply forward-only migrations (extensions → schema → indexes) building
`incidents.embedding` as `vector(EMBED_DIM)` from `lib/config`.
```

---

## 9. Related docs

- [`./CONVENTIONS.md`](./CONVENTIONS.md) — the contract (overrides everything): [§3 stack](./CONVENTIONS.md#3-pinned-tech-stack), [§4 DEPLOY_TARGET](./CONVENTIONS.md#4-deploy_target-flag), [§5 directory tree](./CONVENTIONS.md#5-canonical-directory-tree), [§6 env vars](./CONVENTIONS.md#6-environment-variables), [§8 scripts](./CONVENTIONS.md#8-packagejson-scripts).
- [`./README.md`](./README.md) — build index & Golden Path.
- [`./PHASE-01-database-schema.md`](./PHASE-01-database-schema.md) — next: tables, FKs, CHECKs, indexes (consumes this Docker DB + skeleton).
- [`./PHASE-03-hero-query.md`](./PHASE-03-hero-query.md) — the hero query that fills `lib/db/queries/trace.ts` (the protagonist).
- [`./PHASE-10-vercel-deploy.md`](./PHASE-10-vercel-deploy.md) — fills the `vercel.json` stub (Fluid Compute, region `iad1`).
- [`../deep-dives/01-recall.md`](../deep-dives/01-recall.md) — the full product + architecture spec.
- [`../reference/vercel-v0-playbook.md`](../reference/vercel-v0-playbook.md) — OIDC keyless, Fluid pooling, RSC/Server Actions.
- [`../reference/aws-databases.md`](../reference/aws-databases.md) — Aurora PG superpowers + screenshot-proof catalog.
- [`../reference/submission-checklist.md`](../reference/submission-checklist.md) — required artifacts.
