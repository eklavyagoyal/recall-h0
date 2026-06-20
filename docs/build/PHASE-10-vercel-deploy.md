# Phase 10 — Vercel Deploy (live URL on Fluid Compute, OIDC keyless to Aurora)

**Outcome:** A **published Vercel URL** that renders the Outbreak Console with **live Aurora PostgreSQL data**, served from Fluid Compute in region `iad1` (= AWS `us-east-1`), authenticating to Aurora with **OIDC keyless STS credentials (zero long-lived AWS keys)**, with the **Vercel Team ID** and the **published project URL** recorded for submission.

**Depends on / Unblocks:** **Depends on** [PHASE-09-aws-aurora.md](./PHASE-09-aws-aurora.md) (Aurora Serverless v2 provisioned, migrated, seeded; IAM role + OIDC provider created) and [PHASE-04-api-layer.md](./PHASE-04-api-layer.md) / [PHASE-05-outbreak-console.md](./PHASE-05-outbreak-console.md) (the app builds and the console renders locally). **Unblocks** [PHASE-11-demo-and-submission.md](./PHASE-11-demo-and-submission.md) (the live URL, Team ID, and architecture/DB-proof screenshots all come from a working deployment).

**Effort:** ~2–3 hours (most of it is IAM trust wiring + the first cold deploy + incognito verification; redeploys are seconds).

---

## 1. Objectives

1. Create the Vercel project and **link the repo root** (the Next.js app lives at the repo root — see [CONVENTIONS §5](./CONVENTIONS.md#5-canonical-directory-tree)).
2. Write the **final `vercel.json`** (`fluid: true`, `regions: ["iad1"]`, Node runtime) and confirm `attachDatabasePool` from `@vercel/functions` is wired in `lib/db/pool.ts`.
3. **Enable OIDC** on the project (Team issuer mode → issuer `https://oidc.vercel.com/[TEAM_SLUG]`) and set the **IAM trust** to that issuer (the AWS side was provisioned in Phase 09; here we confirm and scope it to this project name).
4. Set env vars **per environment** (production + preview): `DEPLOY_TARGET=aurora`, `AWS_REGION`, `AWS_ROLE_ARN`, `AURORA_*`, `EMBED_PROVIDER=bedrock`, `EMBED_DIM`, `DEMO_TLC` — **and NO AWS secret keys** (OIDC mints them).
5. **Deploy to production** and verify the **live URL** loads the console with **real Aurora data** in a **fresh incognito window** — no localhost, no leaked keys, low TTFB via the RSC first paint.
6. **Capture the Vercel Team ID and the published project URL** (both are required submission fields) and append a `BUILD_LOG.md` entry.

> **Never-cut reminder ([CONVENTIONS §12](./CONVENTIONS.md#12-global-rules-every-phase)):** the live-URL deploy over **real Aurora data** is on the never-cut list. A demo recorded against `localhost` is an instant credibility loss (pitfall #5). The latency badge on screen is a **real measurement** — never hardcode it.

---

## 2. Prerequisites (checklist)

- [ ] **Phase 09 complete:** Aurora Serverless v2 (engine 16+, `MinCapacity=0`, `MaxCapacity=2`, `us-east-1`) is up; `vector` + `postgis` extensions installed; migrations applied; seed loaded; `DEMO_TLC` traces to ~1,400 stores **in <1s from an EC2/psql client in us-east-1**.
- [ ] **Aurora endpoint is publicly accessible BUT locked by a security group** (no NAT Gateway, no RDS Proxy). The SG must allow inbound `5432` from **Vercel's egress** — see [§5 pitfall: Aurora reachable from Vercel](#6-common-pitfalls--fixes) and [vercel-v0-playbook §11.5](../reference/vercel-v0-playbook.md#115-aurora-in-a-private-subnet).
- [ ] **IAM role** `recall-vercel-runtime` exists (created in Phase 09) with: a **trust policy** to `oidc.vercel.com/[TEAM_SLUG]` and a **least-privilege permissions policy** allowing `rds-db:connect` to the Aurora DB user **and** `bedrock:InvokeModel` on the Titan v2 model (and `secretsmanager:GetSecretValue` on `AURORA_SECRET_ARN` only if you use the Secrets-Manager fallback in §3.6).
- [ ] **The Aurora DB user `recall_app` is IAM-authenticated** (`GRANT rds_iam TO recall_app;` and IAM DB auth enabled on the cluster) — this is what makes the keyless RDS-signer path work. (Verified in Phase 09.)
- [ ] **Local app is GREEN:** `pnpm typecheck && pnpm lint && pnpm test` pass and `pnpm dev` renders the console against local Docker Postgres ([PHASE-05](./PHASE-05-outbreak-console.md)).
- [ ] **Vercel CLI installed and authenticated:** `pnpm add -g vercel@latest` then `vercel login` (or `vercel whoami` already returns your user).
- [ ] **`@vercel/functions` and `@vercel/oidc-aws-credentials-provider` installed** (added in Phase 00/09). Confirm with `pnpm ls @vercel/functions @vercel/oidc-aws-credentials-provider`.
- [ ] You know your **AWS Account ID**, the **Titan v2 `EMBED_DIM`** (verified in Phase 09 — Titan Text Embeddings v2 supports 256/512/1024; pick the dim your `incidents.embedding` column was migrated with in the cloud), and the **Aurora writer endpoint host**.

> **Connection model note (read this).** The canonical [vercel-v0-playbook §4.1](../reference/vercel-v0-playbook.md#41-the-canonical-pooled-connection) shows a `connectionString`/`DATABASE_URL` pool; for Aurora the **keyless** way (no static password, no `DATABASE_URL` secret) is the **RDS IAM auth token** signed per connection via `@aws-sdk/rds-signer` + `awsCredentialsProvider`, exactly as Vercel's official AWS OIDC docs show. That is the path this phase uses. `lib/db/pool.ts` branches on `DEPLOY_TARGET`: `local` → `DATABASE_URL`; `aurora` → RDS signer token. See [§3.3](#33-confirm-libdbpoolts-branches-on-deploy_target-and-wires-attachdatabasepool).

---

## 3. Step-by-step

### 3.1 Write the final `vercel.json`

Create/overwrite `vercel.json` at the **repo root** with the production config. `fluid: true` keeps instances warm (kills cold-start spinners and pre-signs the next RDS token); `regions: ["iad1"]` **co-locates the function with Aurora in `us-east-1`** — the single cheapest latency win (pitfall #2).

```bash
# from the repo root
cat > vercel.json <<'JSON'
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "framework": "nextjs",
  "regions": ["iad1"],
  "fluid": true,
  "functions": {
    "app/api/**/*": { "maxDuration": 30 }
  }
}
JSON
```

> **Why these exact values:**
> - `"regions": ["iad1"]` — `iad1` **is** AWS `us-east-1` (Washington, D.C.). This MUST equal the Aurora region or every trace pays a 100–300 ms cross-region tax ([vercel-v0-playbook §11.1](../reference/vercel-v0-playbook.md#111-verceljson-full-example)).
> - `"fluid": true` — Fluid Compute. Keeps the module-scope pool + cached STS creds alive across invocations (pitfall #1 and #8).
> - `"framework": "nextjs"` — explicit so the build never mis-detects.
> - **No `runtime` key.** With Fluid enabled, Next.js picks the project's Node version from `package.json` `engines` / project settings. We pin **Node 24** in the project settings (§3.7), matching [CONVENTIONS §3](./CONVENTIONS.md#3-pinned-tech-stack). (The `nodejs22.x` literal in the reference playbook predates Node 24 availability — do NOT copy it; pin 24 in project settings instead.)
> - **`maxDuration: 30`** on API routes is headroom for a first cold trace while Aurora scales from `MinACU=0`. The hero query itself is <1s warm; this guards the very first request after idle scale-down.
> - **No `crons`** — Recall's spine does not use Vercel Cron (seeding is offline via `pnpm db:seed` against Aurora in Phase 09). Omit it.

### 3.2 Confirm `EMBED_PROVIDER` works server-side on Vercel

Bedrock Titan v2 runs **server-side only** through the same OIDC credentials. Confirm `lib/embeddings/bedrock.ts` builds its `BedrockRuntimeClient` with `awsCredentialsProvider` (no static keys) and that `lib/embeddings/index.ts` dispatches on `EMBED_PROVIDER`. Skeleton to verify against:

```ts
// lib/embeddings/bedrock.ts  — server-only
import {
  BedrockRuntimeClient,
  InvokeModelCommand,
} from "@aws-sdk/client-bedrock-runtime";
import { awsCredentialsProvider } from "@vercel/oidc-aws-credentials-provider";
import { AWS_REGION, EMBED_DIM, BEDROCK_MODEL_ID } from "@/lib/config";

const client = new BedrockRuntimeClient({
  region: AWS_REGION,
  credentials: awsCredentialsProvider({ roleArn: process.env.AWS_ROLE_ARN! }), // OIDC keyless
});

export async function embedBedrock(text: string): Promise<number[]> {
  const out = await client.send(
    new InvokeModelCommand({
      modelId: BEDROCK_MODEL_ID,                  // amazon.titan-embed-text-v2:0
      contentType: "application/json",
      accept: "application/json",
      body: JSON.stringify({ inputText: text, dimensions: EMBED_DIM, normalize: true }),
    }),
  );
  const json = JSON.parse(new TextDecoder().decode(out.body));
  return json.embedding as number[];              // length === EMBED_DIM
}
```

> `EMBED_DIM` is **one config constant** ([CONVENTIONS §3/§6](./CONVENTIONS.md#6-environment-variables)). It MUST equal the dimension the cloud `incidents.embedding vector(EMBED_DIM)` column was migrated with in Phase 09, and Titan v2's `dimensions` request field MUST match it, or the `<=>` cosine operator in the hero query throws a dimension-mismatch error.

### 3.3 Confirm `lib/db/pool.ts` branches on `DEPLOY_TARGET` and wires `attachDatabasePool`

This is the load-bearing file. It must: (a) branch on `DEPLOY_TARGET`; (b) for `aurora`, build the pool with a **per-connection RDS IAM auth token** (no password env, no `DATABASE_URL`); (c) call `attachDatabasePool(pool)` so Fluid Compute drains idle clients before suspend (pitfall #1). Verify it matches this:

```ts
// lib/db/pool.ts  — server-only, module scope (survives across invocations)
import { Pool, type PoolConfig } from "pg";
import { attachDatabasePool } from "@vercel/functions";
import { awsCredentialsProvider } from "@vercel/oidc-aws-credentials-provider";
import { Signer } from "@aws-sdk/rds-signer";
import { DEPLOY_TARGET, AWS_REGION } from "@/lib/config";

function buildConfig(): PoolConfig {
  if (DEPLOY_TARGET === "aurora") {
    const host = process.env.AURORA_HOST!;
    const port = Number(process.env.AURORA_PORT ?? 5432);
    const user = process.env.AURORA_USER!;            // recall_app (IAM-auth, least-privilege)
    const database = process.env.AURORA_DB!;          // recall

    const signer = new Signer({
      hostname: host,
      port,
      username: user,
      region: AWS_REGION,
      credentials: awsCredentialsProvider({ roleArn: process.env.AWS_ROLE_ARN! }), // OIDC keyless
    });

    return {
      host,
      port,
      user,
      database,
      // async password => a FRESH 15-min IAM token is signed per new connection.
      // No static password, no DATABASE_URL secret — OIDC mints everything.
      password: () => signer.getAuthToken(),
      ssl: { rejectUnauthorized: true }, // Aurora presents the AWS RDS CA; verify it
      max: 5,                            // keep SMALL: many warm Fluid instances * max can exhaust Aurora
      idleTimeoutMillis: 10_000,
      connectionTimeoutMillis: 10_000,   // tolerate the first scale-from-zero
    };
  }

  // DEPLOY_TARGET === "local"  -> Docker Postgres
  return {
    connectionString: process.env.DATABASE_URL,
    max: 5,
    idleTimeoutMillis: 10_000,
  };
}

export const pool = new Pool(buildConfig());

// Fluid Compute: drain idle clients before the instance suspends (prevents leakage).
attachDatabasePool(pool);
```

> **If you instead chose the Secrets-Manager / password path** (the `AURORA_SECRET_ARN` fallback in §3.6), the `aurora` branch would fetch the secret once at module scope and use a static `password` — still keyless from Vercel's side (the secret is read via OIDC), but the **RDS signer path above is preferred** because nothing long-lived is even stored. Pick one; the signer path is the thesis-aligned "zero long-lived keys" story.

> SSL: Aurora's certificate chains to the Amazon RDS root CA. `rejectUnauthorized: true` with the default Node trust store generally validates the public RDS CA; if a cold deploy throws `self-signed certificate in certificate chain`, bundle the RDS global CA bundle and pass it as `ssl.ca` (see [§6 pitfalls](#6-common-pitfalls--fixes)).

### 3.4 Link the repo to a Vercel project (CLI)

Run from the repo root. The CLI creates the project and writes `.vercel/project.json` (which contains your **`orgId` = Team ID** and **`projectId`** — keep `.vercel/` git-ignored).

```bash
# from the repo root — DO NOT deploy yet, just link/create the project
vercel link
# Answer the prompts:
#   ? Set up "~/.../3.7-aws-vercel-h0"?  yes
#   ? Which scope?                       <select your TEAM>  (NOT your personal account)
#   ? Link to existing project?          no
#   ? What's your project's name?        recall-outbreak-console
#   ? In which directory is your code?   ./           <-- repo root (the app is at root)
```

Now record the IDs the CLI just wrote:

```bash
cat .vercel/project.json
# {
#   "orgId":     "team_xxxxxxxxxxxxxxxxxxxxxxxx",   <-- THIS is your Vercel Team ID (submission field)
#   "projectId": "prj_xxxxxxxxxxxxxxxxxxxxxxxx"
# }
```

Capture the **Team ID** (`orgId`) and the **Team Slug** (the scope you selected; also visible via `vercel teams ls` and in the dashboard URL `vercel.com/<TEAM_SLUG>`). You need the slug for the OIDC issuer in §3.5 and the Team ID for the submission.

```bash
vercel teams ls            # shows your teams + which is current (✔)
vercel whoami              # confirms the authenticated user
```

### 3.5 Enable OIDC (Team issuer) and confirm the IAM trust

**On Vercel (dashboard):** Project → **Settings → Security → OpenID Connect (OIDC)** → **Enable**, **Issuer Mode: Team**. This sets the issuer to `https://oidc.vercel.com/[TEAM_SLUG]` and the audience to `https://vercel.com/[TEAM_SLUG]`. (Issuer mode `Team` is required so the IAM trust matches `oidc.vercel.com/[TEAM_SLUG]` — global issuer mode would change the `sub`/`aud` and break the trust.)

**On AWS (confirm the Phase-09 trust now that the project name exists).** The IAM OIDC provider and role were created in Phase 09; now scope the trust `sub` to **this project**. Verify and (if needed) tighten the role's trust policy:

```jsonc
// Trust policy on role: recall-vercel-runtime
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {
        "Federated": "arn:aws:iam::<AWS_ACCOUNT_ID>:oidc-provider/oidc.vercel.com/<TEAM_SLUG>"
      },
      "Action": "sts:AssumeRoleWithWebIdentity",
      "Condition": {
        "StringEquals": {
          "oidc.vercel.com/<TEAM_SLUG>:aud": "https://vercel.com/<TEAM_SLUG>"
        },
        "StringLike": {
          "oidc.vercel.com/<TEAM_SLUG>:sub": "owner:<TEAM_SLUG>:project:recall-outbreak-console:environment:*"
        }
      }
    }
  ]
}
```

Apply it (if Phase 09 left it wildcarded to `project:*`, tighten it to this project name):

```bash
# write the trust JSON to /tmp/trust.json first (with your real account id + team slug), then:
aws iam update-assume-role-policy \
  --role-name recall-vercel-runtime \
  --policy-document file:///tmp/trust.json

# sanity-check the OIDC provider exists (created in Phase 09):
aws iam list-open-id-connect-providers \
  | grep -i "oidc.vercel.com/<TEAM_SLUG>"
```

> The `aud` is `https://vercel.com/<TEAM_SLUG>`. The `sub` scopes **which project/environment** may assume the role: `owner:<TEAM_SLUG>:project:recall-outbreak-console:environment:*` covers both `production` and `preview`. Keep it project-scoped, not `project:*` — least privilege.

### 3.6 Set environment variables PER environment (NO AWS secret keys)

Set each var for **production** and **preview** (you can skip `development` — local dev uses `.env` with `DEPLOY_TARGET=local`). Use `printf` piped into `vercel env add` so values aren't echoed into shell history as plain args.

```bash
# --- core flags ---
printf 'aurora'                     | vercel env add DEPLOY_TARGET production
printf 'aurora'                     | vercel env add DEPLOY_TARGET preview

printf 'us-east-1'                  | vercel env add AWS_REGION production
printf 'us-east-1'                  | vercel env add AWS_REGION preview

# --- OIDC keyless identity (role ARN only — NEVER a secret key) ---
printf 'arn:aws:iam::<AWS_ACCOUNT_ID>:role/recall-vercel-runtime' | vercel env add AWS_ROLE_ARN production
printf 'arn:aws:iam::<AWS_ACCOUNT_ID>:role/recall-vercel-runtime' | vercel env add AWS_ROLE_ARN preview

# --- Aurora connection (host/port/db/user — token is signed at runtime, no password) ---
printf '<cluster>.cluster-xxxx.us-east-1.rds.amazonaws.com' | vercel env add AURORA_HOST production
printf '<cluster>.cluster-xxxx.us-east-1.rds.amazonaws.com' | vercel env add AURORA_HOST preview
printf '5432'                       | vercel env add AURORA_PORT production
printf '5432'                       | vercel env add AURORA_PORT preview
printf 'recall'                     | vercel env add AURORA_DB production
printf 'recall'                     | vercel env add AURORA_DB preview
printf 'recall_app'                 | vercel env add AURORA_USER production
printf 'recall_app'                 | vercel env add AURORA_USER preview

# --- embeddings: Bedrock Titan v2 in the cloud (via OIDC, server-side only) ---
printf 'bedrock'                    | vercel env add EMBED_PROVIDER production
printf 'bedrock'                    | vercel env add EMBED_PROVIDER preview
printf '<EMBED_DIM_FROM_PHASE_09>'  | vercel env add EMBED_DIM production    # e.g. 1024 (Titan v2) — MUST match the cloud column
printf '<EMBED_DIM_FROM_PHASE_09>'  | vercel env add EMBED_DIM preview
printf 'amazon.titan-embed-text-v2:0' | vercel env add BEDROCK_MODEL_ID production
printf 'amazon.titan-embed-text-v2:0' | vercel env add BEDROCK_MODEL_ID preview

# --- demo lot ---
printf 'PRD-OUTBREAK-0001'          | vercel env add DEMO_TLC production
printf 'PRD-OUTBREAK-0001'          | vercel env add DEMO_TLC preview

# --- OPTIONAL fallback ONLY if you chose Secrets-Manager password path in §3.3 ---
# printf 'arn:aws:secretsmanager:us-east-1:<AWS_ACCOUNT_ID>:secret:recall/db-XXXX' | vercel env add AURORA_SECRET_ARN production
```

Verify the env is set and — critically — that **no AWS secret key exists**:

```bash
vercel env ls                       # list all env vars + their target environments
# CONFIRM the absence of these (their absence IS the proof OIDC is doing the work):
vercel env ls | grep -Ei 'AWS_SECRET_ACCESS_KEY|AWS_ACCESS_KEY_ID|AWS_SESSION_TOKEN' && echo "LEAK!" || echo "OK: no static AWS keys"
```

> **Per-environment scoping is mandatory** (pitfall: env var scoping). The OIDC `sub` trust covers `environment:*`, so preview deployments also assume the role and hit Aurora — set the vars for **both** production and preview so a preview URL is demo-able too. Never set `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` — if either exists, OIDC is not the credential source and the "zero long-lived keys" claim is false (instant-DQ territory, pitfall #3).

### 3.7 Pin the Node version and build settings

In **dashboard → Settings → General**: set **Node.js Version = 24.x** (matches [CONVENTIONS §3](./CONVENTIONS.md#3-pinned-tech-stack)). Also pin it in `package.json` so local and cloud agree:

```jsonc
// package.json  (add if missing)
{
  "engines": { "node": "24.x" },
  "packageManager": "pnpm@9"   // ensures Vercel uses pnpm for install/build
}
```

Build command is the default (`pnpm build` → `next build`); install is `pnpm install`. No `DATABASE_URL` is needed at **build** time because the console fetches at **request** time (RSC), and `next build` does not execute the trace. (If any page is statically generated and touches the pool, mark it `export const dynamic = "force-dynamic"` so the build doesn't try to connect to Aurora — the console home is dynamic by design.)

### 3.8 First production deploy

```bash
# production deploy from the repo root (uploads, builds on Vercel, returns the URL)
vercel --prod
# ...build logs stream...
# ✅  Production: https://recall-outbreak-console.vercel.app [copied to clipboard]
```

Record the printed **Production URL** — that is the **published project link** for the submission. Then watch the runtime logs as you hit it:

```bash
vercel logs https://recall-outbreak-console.vercel.app --follow
# In another terminal / browser, load the URL. You should see the trace query run,
# NOT "too many clients already", NOT credential errors. Look for the STS assume-role
# happening once and the RDS token being signed.
```

### 3.9 Verify the LIVE URL in a fresh incognito window

This is the real Definition-of-Done gate. **Open the production URL in a brand-new incognito/private window** (no cached session, no logged-in Vercel cookie — proves an anonymous judge sees the same thing):

1. **It loads the Outbreak Console** (graph + map + incident rail) with **real rows**, not an error or empty state.
2. **Run the `DEMO_TLC` trace** (`PRD-OUTBREAK-0001`). It returns ~1,400 affected stores plotted on the PostGIS map, the recursive graph igniting, and the pgvector incident rail populated.
3. **The latency badge shows a real, single-/low-double-digit-ms warm number** (after the first cold request). Refresh once to warm Aurora, then read the steady-state number — it must be a genuine measurement from `meta.latencyMs`, not a constant.
4. **The URL bar shows the `*.vercel.app` (or custom) domain — NOT `localhost`.** Capture this frame for the demo (pitfall #5).
5. **Open the Query Inspector** — the live `EXPLAIN (ANALYZE, BUFFERS)` text comes back from Aurora (Index Scan on `lot_links` per recursion, HNSW scan, GiST path).

Quick latency probe against the deployed endpoint (run a few times; first is cold, rest are warm):

```bash
for i in 1 2 3 4 5; do
  curl -s -o /dev/null -w "ttfb=%{time_starttransfer}s total=%{time_total}s\n" \
    -X POST https://recall-outbreak-console.vercel.app/api/trace \
    -H 'content-type: application/json' \
    -d '{"tlc":"PRD-OUTBREAK-0001"}'
done
```

Concurrency smoke (proves the pool + `attachDatabasePool` hold — no `too many clients`):

```bash
# ~30 concurrent trace requests; expect all 200s, no connection errors
seq 30 | xargs -P 30 -I{} curl -s -o /dev/null -w "%{http_code}\n" \
  -X POST https://recall-outbreak-console.vercel.app/api/trace \
  -H 'content-type: application/json' -d '{"tlc":"PRD-OUTBREAK-0001"}' | sort | uniq -c
# expect: "  30 200"
```

### 3.10 Record the two required submission fields

```bash
# Vercel Team ID (submission field):
node -e "console.log(require('./.vercel/project.json').orgId)"   # team_xxxxxxxxxxxx
# Published project URL (submission field):
vercel inspect https://recall-outbreak-console.vercel.app | head -20   # confirms it's a production alias
```

Write both into `BUILD_LOG.md` (and you'll copy them into [PHASE-11](./PHASE-11-demo-and-submission.md)). The Team ID also appears in **dashboard → Team Settings → General → Team ID**.

### 3.11 Optional — assign a clean production alias / domain

```bash
# give it a tidy alias (optional; the default *.vercel.app already works)
vercel alias set <deployment-url> recall-console.vercel.app   # if the alias is free
```

A short, readable URL reads better on camera. Optional only — do not let it block submission.

---

## 4. Key files

| Path | Purpose |
|---|---|
| [`vercel.json`](../../vercel.json) | **Final deploy config** — `fluid: true`, `regions: ["iad1"]` (= us-east-1), API `maxDuration`. The region line is the latency win. |
| [`lib/db/pool.ts`](../../lib/db/pool.ts) | Module-scope `pg.Pool`; branches on `DEPLOY_TARGET`; `aurora` path uses `@aws-sdk/rds-signer` + `awsCredentialsProvider` for a **keyless** per-connection IAM token; calls `attachDatabasePool(pool)`. |
| [`lib/config.ts`](../../lib/config.ts) | Reads `DEPLOY_TARGET`, `AWS_REGION`, `EMBED_PROVIDER`, `EMBED_DIM`, `DEMO_TLC`, `BEDROCK_MODEL_ID` from env (canonical names). |
| [`lib/embeddings/bedrock.ts`](../../lib/embeddings/bedrock.ts) | Titan v2 client via OIDC keyless creds; `dimensions: EMBED_DIM` MUST match the cloud column. |
| `.vercel/project.json` | Auto-written by `vercel link`; contains `orgId` (**Team ID**) + `projectId`. Git-ignored. |
| [`.env.example`](../../.env.example) | Documents the canonical env names (no secrets); mirrors the vars set in §3.6. |
| [`BUILD_LOG.md`](../../BUILD_LOG.md) | Append the Phase-10 entry (§8) with the live URL + Team ID. |

---

## 5. Definition of Done

Each box has its exact verification command + expected output.

- [ ] **`vercel.json` is final** (`fluid: true`, `regions: ["iad1"]`).
  `node -e "const c=require('./vercel.json'); console.log(c.fluid===true && c.regions[0]==='iad1' ? 'OK' : 'BAD')"` → **`OK`**
- [ ] **Project linked to the TEAM scope; Team ID captured.**
  `node -e "console.log(require('./.vercel/project.json').orgId)"` → prints **`team_...`** (record it).
- [ ] **Env vars set for production + preview; `DEPLOY_TARGET=aurora`, `EMBED_PROVIDER=bedrock`.**
  `vercel env ls` → shows `DEPLOY_TARGET`, `AWS_REGION`, `AWS_ROLE_ARN`, `AURORA_HOST/PORT/DB/USER`, `EMBED_PROVIDER`, `EMBED_DIM`, `BEDROCK_MODEL_ID`, `DEMO_TLC` for **Production** and **Preview**.
- [ ] **NO long-lived AWS keys anywhere.**
  `vercel env ls | grep -Ei 'AWS_SECRET_ACCESS_KEY|AWS_ACCESS_KEY_ID|AWS_SESSION_TOKEN' && echo LEAK || echo OK` → **`OK`**
  AND `grep -rIn -E 'AKIA[0-9A-Z]{16}|aws_secret_access_key' . --exclude-dir=node_modules --exclude-dir=.git --exclude-dir=.next` → **(no output)**
- [ ] **OIDC enabled (Team issuer) and IAM trust scoped to this project.**
  `aws iam get-role --role-name recall-vercel-runtime --query 'Role.AssumeRolePolicyDocument'` → shows `Federated ...oidc.vercel.com/<TEAM_SLUG>` and `sub` = `owner:<TEAM_SLUG>:project:recall-outbreak-console:environment:*`.
- [ ] **Production deploy succeeded; URL captured.**
  `vercel --prod` → prints `Production: https://...` (record it).
- [ ] **Live URL renders the Outbreak Console with real Aurora data (fresh incognito).**
  Manual: open incognito → console loads, `DEMO_TLC` trace returns **~1,400 stores** on the map, graph ignites, incident rail populated. URL bar shows the deployed domain, **not** `localhost`.
- [ ] **Real, sub-second warm latency from the deployed endpoint.**
  `curl -s -o /dev/null -w "%{time_total}s\n" -X POST <prod>/api/trace -H 'content-type: application/json' -d '{"tlc":"PRD-OUTBREAK-0001"}'` (run 3×; ignore the first cold one) → warm total **< ~1s** end-to-end.
- [ ] **OIDC actually working (no key errors in logs).**
  `vercel logs <prod> --follow` while hitting the URL → trace runs, **no** `CredentialsProviderError`, **no** `too many clients already`.
- [ ] **Concurrency holds (Fluid pooling).**
  the `seq 30 | xargs -P 30 ...` probe in §3.9 → **`30 200`**, no connection errors.
- [ ] **Cold start acceptable.** First request after idle (Aurora scaled to 0) completes within `maxDuration` (≤30s) and warms; subsequent requests are sub-second. Verified by the latency loop in §3.9 (first sample high, rest low).
- [ ] **`BUILD_LOG.md` entry appended** (§8) with live URL + Team ID.
- [ ] **Local app still GREEN** (regression guard): `pnpm typecheck && pnpm lint && pnpm test` → all pass.

---

## 6. Common pitfalls & fixes

| Pitfall | Symptom | Fix |
|---|---|---|
| **Connection exhaustion** | `too many clients already` the moment two judges click | Module-scope `pool` with **`max: 5`** + `attachDatabasePool(pool)` + `fluid: true`. With `MaxACU=2` Aurora's connection ceiling is modest — keep `max` small. Only add **RDS Proxy** if you genuinely hit the ceiling under concurrency (CONVENTIONS says no RDS Proxy *unless connection limits force it*). |
| **Region latency tax** | Snappy in dev, ~250 ms in prod; latency badge embarrasses you | `vercel.json` `regions: ["iad1"]` == Aurora `us-east-1`. Verify with the curl latency loop; if high and steady, the region is wrong. |
| **Aurora unreachable from Vercel** | Every deployed query times out / `ETIMEDOUT`, though `vercel dev` (or VPN) worked | Aurora must be **publicly accessible** with a **security group** allowing inbound `5432`. Vercel Functions don't have static egress IPs by default, so either (a) allow the broad Vercel egress range and rely on **IAM auth + TLS** as the real gate (the SG is defense-in-depth, IAM is the lock), or (b) use **Vercel Secure Compute** (static egress IPs) and allowlist exactly those. No NAT Gateway. **Test the deployed URL, not just dev** ([playbook §11.5](../reference/vercel-v0-playbook.md#115-aurora-in-a-private-subnet)). |
| **Env var scoping** | Works in prod, preview deploy errors (or vice-versa) | Set every var for **both** `production` and `preview`. The OIDC `sub` trust covers `environment:*` so both can assume the role. |
| **Static AWS keys sneak in** | `AWS_SECRET_ACCESS_KEY` present → not actually keyless | Delete them: `vercel env rm AWS_SECRET_ACCESS_KEY production`. The signer + `awsCredentialsProvider` need **only** `AWS_ROLE_ARN` + `AWS_REGION`. Their absence is the proof. |
| **IAM token expiry / `PAM authentication failed`** | Connections fail after ~15 min, or DB rejects the token | The RDS auth token lives ~15 min; `password: () => signer.getAuthToken()` signs a fresh one **per new connection**, so the pool self-heals. Confirm `recall_app` has `rds_iam` granted and IAM DB auth is enabled on the cluster (Phase 09). |
| **TLS verification failure** | `self-signed certificate in certificate chain` on cold deploy | Aurora chains to the Amazon RDS root CA. If the default Node trust store doesn't validate it, download the RDS global CA bundle, ship it in the repo, and pass `ssl: { ca: fs.readFileSync('certs/rds-global-bundle.pem'), rejectUnauthorized: true }`. Never set `rejectUnauthorized: false` for the demo. |
| **Build tries to hit Aurora** | `next build` fails connecting to DB | Mark DB-touching pages `export const dynamic = "force-dynamic"`; the console home is request-time RSC, not statically generated. No `DATABASE_URL` is needed at build for the `aurora` target. |
| **Cold start spinner on first trace** | First post-idle request is slow (Aurora scaling from `MinACU=0`) | Expected and acceptable: `fluid: true` keeps the function warm; `connectionTimeoutMillis: 10_000` + `maxDuration: 30` absorb the scale-up. Warm the URL once before recording the demo. Do **not** raise `MinACU` (it breaks scale-to-zero ~$0 idle — CONVENTIONS budget rule). |
| **Embedding dimension mismatch** | `/api/trace` throws `expected N dimensions, not M` on the `<=>` operator | `EMBED_DIM` env on Vercel MUST equal the Titan v2 `dimensions` AND the cloud `incidents.embedding vector(EMBED_DIM)` column from Phase 09. Re-verify the verified Titan v2 dim. |
| **Wrong scope on link** | Project landed under your personal account, not the team → wrong Team ID | `vercel link` and pick the **team** scope. If wrong: `rm -rf .vercel && vercel link` and re-select the team. |
| **Localhost in the demo** | Video shows `localhost:3000` | Record against the **published Vercel URL** with the URL bar visible (pitfall #5). |

---

## 7. Cut-if-scope-bites

If time is tight, you may cut **only** these — none are on the never-cut list:

- The **optional clean alias / custom domain** (§3.11) — the default `*.vercel.app` URL is a perfectly valid submission link.
- **Preview-environment** env vars (§3.6) — set only `production` if you're racing; the demo runs off the production URL. (Still preferred to set both.)
- **Bedrock as the cloud embed provider** — if Bedrock access/quotas stall, set `EMBED_PROVIDER=local` so `@xenova/transformers` runs in the function (Node, zero credits). The hero query's pgvector rail still works because the **stored** incident embeddings already exist in Aurora from seeding; only the *query* embedding changes provider. Note the swap in `BUILD_LOG.md`.

> **NEVER cut ([CONVENTIONS §12](./CONVENTIONS.md#12-global-rules-every-phase)):** the **live-URL deploy over real Aurora data**, the recursive CTE, the PostGIS map JOIN, the pgvector rail, the live `EXPLAIN`, and the **OIDC keyless** auth (no long-lived AWS keys). The on-screen latency is a **real measurement** — never hardcode it. If the deploy is failing, fix the deploy; do not fake a localhost recording.

---

## 8. BUILD_LOG entry to append

```md
## Phase 10 — Vercel Deploy (live URL, OIDC keyless to Aurora) — <DATE>

**Outcome:** Recall — The Outbreak Console is live on Vercel Fluid Compute (region iad1 = us-east-1),
serving real Aurora PostgreSQL data over OIDC keyless STS credentials (zero long-lived AWS keys).

**Submission fields (required):**
- Published project URL: https://recall-outbreak-console.vercel.app
- Vercel Team ID: team_xxxxxxxxxxxxxxxxxxxxxxxx
- Vercel Team Slug: <team-slug>   (OIDC issuer: https://oidc.vercel.com/<team-slug>)

**Config:**
- vercel.json: fluid: true, regions: ["iad1"], app/api/** maxDuration 30. Node 24.x pinned.
- Auth: @aws-sdk/rds-signer + @vercel/oidc-aws-credentials-provider; AssumeRoleWithWebIdentity to
  arn:aws:iam::<acct>:role/recall-vercel-runtime. IAM trust scoped to
  owner:<slug>:project:recall-outbreak-console:environment:*. NO AWS_SECRET_ACCESS_KEY anywhere.
- Pooling: module-scope pg.Pool(max:5) + attachDatabasePool(); per-connection 15-min IAM token.
- Embeddings: EMBED_PROVIDER=bedrock, BEDROCK_MODEL_ID=amazon.titan-embed-text-v2:0, EMBED_DIM=<dim>.

**Verification (against the LIVE URL, fresh incognito):**
- Console renders with real data; DEMO_TLC (PRD-OUTBREAK-0001) traces to ~1,400 stores on the PostGIS map.
- Warm /api/trace latency: <measured> ms (real, from meta.latencyMs). Cold first request: <measured> ms.
- Concurrency: 30 parallel traces -> 30x 200, no "too many clients".
- Query Inspector returns live EXPLAIN ANALYZE (Index Scan on lot_links per recursion, HNSW scan, GiST path).
- Logs: STS assume-role + RDS token sign succeed; no CredentialsProviderError.

**Anti-fake confirmation:** no localhost, no hardcoded latency, no static AWS keys (env + repo grep clean).
**Cost note:** Aurora MinACU=0 -> ~$0 idle. DELETE Aurora + snapshots after submission (Phase 11).
**GREEN:** pnpm typecheck + lint + test pass; live URL verified.
```

---

## 9. Related docs

- [`./CONVENTIONS.md`](./CONVENTIONS.md) — the contract (single source of truth; §3 stack, §4 `DEPLOY_TARGET`, §6 env vars, §12 global rules)
- [`./README.md`](./README.md) — build index & navigation
- [`./PHASE-09-aws-aurora.md`](./PHASE-09-aws-aurora.md) — **prerequisite:** Aurora Serverless v2, IAM role, OIDC provider, IAM DB auth, verified `EMBED_DIM`
- [`./PHASE-11-demo-and-submission.md`](./PHASE-11-demo-and-submission.md) — **next:** uses this live URL + Team ID; AWS-DB-usage screenshot, architecture diagram, <3-min video
- [`./PHASE-04-api-layer.md`](./PHASE-04-api-layer.md) / [`./PHASE-05-outbreak-console.md`](./PHASE-05-outbreak-console.md) — the routes + console the deploy serves
- [`./SETUP-AWS-V0.md`](./SETUP-AWS-V0.md) — credentials runbook (IAM OIDC trust, Bedrock access, Vercel/Team setup) — read before Phases 09–10
- [`../deep-dives/01-recall.md`](../deep-dives/01-recall.md) — the flagship product + architecture spec
- [`../reference/vercel-v0-playbook.md`](../reference/vercel-v0-playbook.md) — OIDC keyless (§3), Fluid pooling (§4), Server Components first paint (§6), config reference (§11), deploy pre-flight (§13)
- [`../reference/aws-databases.md`](../reference/aws-databases.md) — Aurora superpowers + per-engine screenshot-proof recipes
- [`../reference/submission-checklist.md`](../reference/submission-checklist.md) — required artifacts (published URL + Team ID), demo rules, pre-flight
