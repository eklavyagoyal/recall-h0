# Phase 09 — AWS Aurora Provisioning & Cloud Swap

> **Outcome:** A real **Aurora PostgreSQL Serverless v2** cluster (engine 16+, `us-east-1`, `MinACU=0` scale-to-zero, `MaxACU=2`, `vector` + `postgis` enabled) is live; the app runs against it via `DEPLOY_TARGET=aurora`; `pnpm db:migrate` + `pnpm db:seed` have loaded real volume into the cloud; the `DEMO_TLC` trace is **sub-second** against Aurora; **scale-to-zero is confirmed** (ACU drops to 0 when idle); the **IAM role for Vercel OIDC** (trust + least-privilege) exists; the **Bedrock Titan v2** embedding provider works; and the **AWS-DB proof screenshot** (RDS console + psql `EXPLAIN` showing HNSW/GiST + CloudWatch ACU graph) is captured.

**Depends on / Unblocks:** **Depends on** [PHASE-08-testing.md](./PHASE-08-testing.md) (a GREEN, correct local spine — schema, seed, hero query, API, console all working on local Docker Postgres) and [SETUP-AWS-V0.md](./SETUP-AWS-V0.md) (AWS account, AWS CLI configured, Vercel team slug/ID recorded). **Unblocks** [PHASE-10-vercel-deploy.md](./PHASE-10-vercel-deploy.md) (the deployed Vercel function assumes the IAM role created here and talks to this cluster) and [PHASE-11-demo-and-submission.md](./PHASE-11-demo-and-submission.md) (the proof screenshots captured here are mandatory submission artifacts).

**Effort:** ~0.5–1 day. Cluster creation is ~10–15 min; OIDC/IAM ~30 min; seeding to the cloud is the long pole (~15–40 min depending on `COPY` batching and ACU ceiling). Budget a buffer for the first-time Bedrock model-access approval.

> ⚠️ **Every AWS-specific value in this doc — engine versions, ACU floors/ceilings, instance class names, IAM action names, Bedrock model IDs and dimensions, region availability — is marked "verify against current AWS docs."** AWS changes defaults, renames things (Aurora Serverless v2 → "Aurora Serverless" in 2026), and gates features by region. Run the verification commands inline; never assert a number on camera you didn't just observe.

---

## 1. Objectives

1. Stand up an **Aurora PostgreSQL Serverless v2** cluster in **`us-east-1`** with `MinCapacity=0` (scale-to-zero) and `MaxCapacity=2`, a **publicly-accessible** endpoint **locked by a security group** to only the IPs that need it (your seeding machine + Vercel egress). **NO NAT Gateway. NO RDS Proxy** unless connection limits force it (the contract default — Serverless v2 + Fluid pooling is enough at demo scale).
2. Enable the `vector` and `postgis` extensions on the cluster via `psql`.
3. Create the **IAM role for Vercel OIDC keyless auth** — the OIDC provider, a **trust policy** (Federated `oidc.vercel.com/<TEAM_SLUG>`, `sub`/`aud` conditions scoped to the team+project), and a **least-privilege permissions policy** (`rds-db:connect` **or** Secrets Manager read, plus `bedrock:InvokeModel`).
4. Switch the embedding provider to **Bedrock Titan Text Embeddings v2**: implement `lib/embeddings/bedrock.ts`, set `EMBED_PROVIDER=bedrock` and `EMBED_DIM` to the **verified Titan v2 output dimension** (see [§3.6](#36-step-6--switch-embeddings-to-bedrock-titan-v2)).
5. Run `pnpm db:migrate` and `pnpm db:seed` against Aurora (`DEPLOY_TARGET=aurora` + `AURORA_*` env).
6. Flip `DEPLOY_TARGET=aurora` and **re-run `pnpm bench`** against Aurora; confirm the `DEMO_TLC` trace is **sub-second** over real volume.
7. Capture the **AWS-DB proof screenshot(s)**: the RDS console Serverless v2 cluster page, a `psql` `EXPLAIN (ANALYZE, BUFFERS)` showing the **Recursive Union + HNSW index scan + GiST spatial path**, and a **CloudWatch ACU scaling graph** showing capacity rising for the burst and dropping to **0** when idle.
8. Record the **teardown commands** for after submission (delete cluster + snapshots → stop all charges).

> **The contract guardrails for this phase (from [CONVENTIONS.md](./CONVENTIONS.md) §12):** `DEPLOY_TARGET` is the *only* dev↔cloud switch — `lib/db/pool.ts` branches on it and nothing else changes. AWS creds are **server-side only, OIDC keyless, never committed**. The on-screen latency is a **real measurement**. Scale-to-zero (`MinACU=0`) keeps idle cost ~$0. **DELETE Aurora + snapshots after submission.**

---

## 2. Prerequisites (checklist)

- [ ] **The local spine is GREEN and correct.** `pnpm typecheck && pnpm lint && pnpm test` pass; `pnpm db:seed` against local Docker prints the seed-volume counts ([CONVENTIONS.md](./CONVENTIONS.md) §11); the local `DEMO_TLC` trace is sub-second. **Do not provision cloud before local works** — debugging the schema/query against a metered cluster is slow and expensive.
- [ ] **AWS CLI v2 installed and authenticated** to the target account, default region `us-east-1`. Verify:
  ```bash
  aws --version                       # aws-cli/2.x — verify v2, not v1
  aws sts get-caller-identity         # prints Account + your IAM principal ARN
  aws configure get region            # should print us-east-1 (or pass --region us-east-1 everywhere)
  ```
  Record your **account ID** — you will substitute it for `<ACCOUNT_ID>` throughout:
  ```bash
  export ACCOUNT_ID="$(aws sts get-caller-identity --query Account --output text)"
  export AWS_REGION="us-east-1"
  echo "ACCOUNT_ID=$ACCOUNT_ID  REGION=$AWS_REGION"
  ```
- [ ] **`psql` client installed** (PostgreSQL 16 client). `psql --version` → `psql (PostgreSQL) 16.x`. (macOS: `brew install libpq && brew link --force libpq`.)
- [ ] **Vercel team slug + team ID recorded** (from [SETUP-AWS-V0.md](./SETUP-AWS-V0.md) — enable OIDC, Issuer mode **Team**). You need `<TEAM_SLUG>` for the OIDC issuer URL `https://oidc.vercel.com/<TEAM_SLUG>` and the `<TEAM_ID>` for the submission. Export them:
  ```bash
  export TEAM_SLUG="<your-vercel-team-slug>"     # verify in Vercel → Settings → General
  export PROJECT_NAME="recall"                    # the Vercel project name (Phase 10)
  ```
- [ ] **Your current public IP** (to lock the security group for seeding). `curl -s https://checkip.amazonaws.com` → e.g. `203.0.113.42`. Export it:
  ```bash
  export MY_IP="$(curl -s https://checkip.amazonaws.com)/32"
  echo "MY_IP=$MY_IP"
  ```
- [ ] **Bedrock model access for Titan v2 requested/granted** in `us-east-1` (Bedrock console → *Model access* → enable **Amazon Titan Text Embeddings V2**). This can take minutes; do it now. **Verify the model ID and that it's accessible** before relying on it ([§3.6](#36-step-6--switch-embeddings-to-bedrock-titan-v2)).
- [ ] **A default VPC + subnets exist in `us-east-1`** (the AWS default account has one). The cluster goes into a **DB subnet group** spanning ≥2 AZs. If you deleted the default VPC, create subnets in ≥2 AZs first (out of scope here — most accounts have the default VPC).

---

## 3. Step-by-step

> Two parallel paths are given for cluster creation: **(A) AWS Console click-path** and **(B) AWS CLI**. Use whichever you prefer — they produce the same cluster. The CLI path is reproducible and is what the BUILD_LOG should record. Everything after creation (extensions, IAM, embeddings, seed, bench, proof) is shared.

### 3.0 — Shell variables (set once, reused below)

```bash
# Identity / region (from §2)
export ACCOUNT_ID="$(aws sts get-caller-identity --query Account --output text)"
export AWS_REGION="us-east-1"
export MY_IP="$(curl -s https://checkip.amazonaws.com)/32"

# Cluster naming (pick stable names — they appear in ARNs and the proof screenshot)
export CLUSTER_ID="recall-aurora"
export WRITER_ID="recall-aurora-writer-1"
export DB_NAME="recall"
export MASTER_USER="recall_admin"
export APP_USER="recall_app"
export SG_NAME="recall-aurora-sg"
export SUBNET_GROUP="recall-db-subnet-group"

# Generate a strong master password (do NOT commit it — store in your password manager / Secrets Manager)
export MASTER_PW="$(openssl rand -base64 24 | tr -d '/+=' | head -c 24)"
echo "MASTER_PW=$MASTER_PW   # <-- save this somewhere safe; you will need it for psql"
```

> ⚠️ **`MinACU=0` caveat — verify against current AWS docs.** Scale-to-zero (auto-pause to 0 ACU) for Aurora Serverless v2 requires a **minimum engine version** (it shipped for PG 16.4+ / 15.8+ class engines). If `create-db-cluster` rejects `--serverless-v2-scaling-configuration MinCapacity=0`, your selected engine version predates scale-to-zero support — **bump `--engine-version` to a version that supports it** (see [§6 pitfalls](#6-common-pitfalls--fixes)) or fall back to `MinCapacity=0.5` (idle cost ~a few $/day, still fine inside the $100 budget; just don't claim "scale-to-zero" if you can't show ACU=0). **Pick the latest available PG 16 Serverless v2 version:**
> ```bash
> aws rds describe-db-engine-versions \
>   --engine aurora-postgresql \
>   --query "DBEngineVersions[?contains(SupportedEngineModes, 'provisioned')].EngineVersion" \
>   --region "$AWS_REGION" --output text | tr '\t' '\n' | grep '^16' | sort -V | tail -5
> # Pick the newest 16.x that your account/region offers; set it below.
> export ENGINE_VERSION="16.6"   # <-- VERIFY against the output above; do not hardcode blindly
> ```

---

### 3.1 — Step 1A — Create the cluster (AWS Console click-path)

> **Verify every label against the current console — AWS renames and relays the RDS create wizard often. "Aurora Serverless v2" may appear as "Aurora Serverless" in the 2026 console.**

1. **RDS console** → **Databases** → **Create database**.
2. **Choose a database creation method:** *Standard create*.
3. **Engine type:** *Aurora (PostgreSQL Compatible)*. **Engine version:** the latest **PostgreSQL 16.x** that supports Serverless v2 **and** scale-to-zero (`MinACU=0`) — verify in the version dropdown / the CLI query in [§3.0](#30--shell-variables-set-once-reused-below).
4. **Templates:** *Dev/Test* (no Multi-AZ standby needed for the demo).
5. **Settings:** DB cluster identifier `recall-aurora`; Master username `recall_admin`; set **Master password** (the `$MASTER_PW` you generated, or *Manage in Secrets Manager* — see [§3.7](#37-step-7--db-credentials-rds-iam-auth-recommended-secrets-manager-fallback)).
6. **Cluster storage configuration / Instance configuration:** choose **Serverless v2**. Set **Minimum capacity (ACUs) = 0** (scale-to-zero) and **Maximum capacity (ACUs) = 2**. *(If the console blocks `0`, your engine version predates scale-to-zero — bump it.)*
7. **Availability & durability:** *Don't create an Aurora Replica* (single writer is enough; the contract caps `MaxACU=2`).
8. **Connectivity:**
   - **Compute resource:** *Don't connect to an EC2 compute resource*.
   - **Network type:** IPv4.
   - **VPC:** default VPC. **DB subnet group:** default (or `recall-db-subnet-group` if you made one).
   - **Public access:** **Yes** (publicly accessible — the contract's locked-public-endpoint pattern; **NO NAT Gateway**).
   - **VPC security group:** *Create new* → name `recall-aurora-sg`. (You'll tighten its inbound rule in [§3.3](#33-step-3--lock-the-security-group-inbound-5432).)
   - **Database port:** `5432`.
9. **Database authentication:** check **Password authentication** *and* **IAM database authentication** (you'll use IAM auth from Vercel via `rds-db:connect` — see [§3.7](#37-step-7--db-credentials-rds-iam-auth-recommended-secrets-manager-fallback)).
10. **Additional configuration:** **Initial database name:** `recall`. Disable enhanced monitoring if you want to minimize cost; **keep CloudWatch metrics on** (you need the ACU graph for the proof screenshot).
11. **Create database.** Wait until status = **Available** (~10–15 min). Note the **writer endpoint** (`recall-aurora.cluster-xxxx.us-east-1.rds.amazonaws.com`).

Skip [§3.1B](#31b--step-1b--create-the-cluster-aws-cli) if you used the console; go to [§3.2](#32-step-2--connect-via-psql--enable-extensions).

---

### 3.1B — Step 1B — Create the cluster (AWS CLI)

> Run these in order. Each `wait`/poll must complete before the next step. **All values marked "verify."**

**(a) DB subnet group** spanning ≥2 AZs (reuse default-VPC subnets):

```bash
# Find the default VPC and ≥2 of its subnets in different AZs
export VPC_ID="$(aws ec2 describe-vpcs --filters Name=isDefault,Values=true \
  --query 'Vpcs[0].VpcId' --output text --region "$AWS_REGION")"
export SUBNETS="$(aws ec2 describe-subnets --filters Name=vpc-id,Values="$VPC_ID" \
  --query 'Subnets[].SubnetId' --output text --region "$AWS_REGION")"
echo "VPC=$VPC_ID  SUBNETS=$SUBNETS"

aws rds create-db-subnet-group \
  --db-subnet-group-name "$SUBNET_GROUP" \
  --db-subnet-group-description "Recall Aurora subnet group" \
  --subnet-ids $SUBNETS \
  --region "$AWS_REGION"
```

**(b) Security group** (inbound rule added in [§3.3](#33-step-3--lock-the-security-group-inbound-5432)):

```bash
export SG_ID="$(aws ec2 create-security-group \
  --group-name "$SG_NAME" \
  --description "Recall Aurora — 5432 locked to known IPs" \
  --vpc-id "$VPC_ID" \
  --query 'GroupId' --output text --region "$AWS_REGION")"
echo "SG_ID=$SG_ID"
```

**(c) Create the cluster** — Serverless v2, `MinACU=0`, `MaxACU=2`, public, IAM auth on:

```bash
aws rds create-db-cluster \
  --db-cluster-identifier "$CLUSTER_ID" \
  --engine aurora-postgresql \
  --engine-version "$ENGINE_VERSION" \
  --database-name "$DB_NAME" \
  --master-username "$MASTER_USER" \
  --master-user-password "$MASTER_PW" \
  --serverless-v2-scaling-configuration MinCapacity=0,MaxCapacity=2 \
  --db-subnet-group-name "$SUBNET_GROUP" \
  --vpc-security-group-ids "$SG_ID" \
  --enable-iam-database-authentication \
  --port 5432 \
  --region "$AWS_REGION"
# NOTE: NO --enable-http-endpoint (no Data API needed). NO RDS Proxy. NO NAT Gateway.
```

**(d) Create the writer instance** with the special Serverless v2 instance class **`db.serverless`**:

```bash
aws rds create-db-instance \
  --db-instance-identifier "$WRITER_ID" \
  --db-cluster-identifier "$CLUSTER_ID" \
  --engine aurora-postgresql \
  --db-instance-class db.serverless \
  --publicly-accessible \
  --region "$AWS_REGION"
```

**(e) Wait until available, then capture the writer endpoint:**

```bash
aws rds wait db-instance-available \
  --db-instance-identifier "$WRITER_ID" --region "$AWS_REGION"

export AURORA_HOST="$(aws rds describe-db-clusters \
  --db-cluster-identifier "$CLUSTER_ID" \
  --query 'DBClusters[0].Endpoint' --output text --region "$AWS_REGION")"
echo "AURORA_HOST=$AURORA_HOST"
# e.g. recall-aurora.cluster-cxxxxxx.us-east-1.rds.amazonaws.com
```

> **Verify** the cluster shows `ServerlessV2ScalingConfiguration` with `MinCapacity: 0.0, MaxCapacity: 2.0`:
> ```bash
> aws rds describe-db-clusters --db-cluster-identifier "$CLUSTER_ID" \
>   --query 'DBClusters[0].{Engine:EngineVersion,Status:Status,Scaling:ServerlessV2ScalingConfiguration,Public:PubliclyAccessible}' \
>   --region "$AWS_REGION"
> ```

---

### 3.2 — Step 2 — Connect via `psql` & enable extensions

The cluster has no `vector`/`postgis` yet. Connect as the master user and create them.

```bash
# Use the master password from §3.0. SSL is required for a public Aurora endpoint.
PGPASSWORD="$MASTER_PW" psql \
  "host=$AURORA_HOST port=5432 dbname=$DB_NAME user=$MASTER_USER sslmode=require"
```

Inside `psql`:

```sql
-- Enable the two extensions the hero query depends on (idempotent; same as docker/init.sql)
CREATE EXTENSION IF NOT EXISTS vector;     -- pgvector (verify version >= 0.8.0)
CREATE EXTENSION IF NOT EXISTS postgis;    -- PostGIS geography/geometry + GiST

-- Verify they're installed and note the versions (record pgvector version for the BUILD_LOG)
SELECT extname, extversion FROM pg_extension WHERE extname IN ('vector','postgis');
--  extname | extversion
-- ---------+------------
--  vector  | 0.8.0          <- verify >= 0.8.0; if older, the HNSW perf claims weaken
--  postgis | 3.4.x

-- Confirm the engine version (must be PostgreSQL 16+)
SELECT version();
```

> If `CREATE EXTENSION vector` fails with *"extension not available"*, your engine version's bundled pgvector is too old or the extension isn't allow-listed — **bump the engine version** (verify the available version map with `aws rds describe-db-engine-versions ... --query 'DBEngineVersions[].SupportedFeatureNames'` / check the RDS PostgreSQL extensions doc). PostGIS and pgvector are both first-class on Aurora PG 16; this should "just work" on a current 16.x.

Leave `psql` open in another tab for [§3.10](#310-step-10--capture-the-aws-db-proof-screenshot) (the EXPLAIN screenshot), or reconnect later.

---

### 3.3 — Step 3 — Lock the security group inbound (5432)

Open **only** port `5432`, **only** to the IPs that need it. For seeding/benchmarking that's **your machine**. For the deployed Vercel function you'll add Vercel egress (or, cleanly, use IAM auth — the SG still must allow the connecting IP).

```bash
# Allow your seeding machine
aws ec2 authorize-security-group-ingress \
  --group-id "$SG_ID" \
  --protocol tcp --port 5432 --cidr "$MY_IP" \
  --region "$AWS_REGION"
```

> **Vercel egress is dynamic** (a wide, changing range). For a hackathon the pragmatic options are, in order of preference:
> 1. **Keep it IAM-auth + locked to your IP for seeding**, and for the deployed app either (a) temporarily widen the SG to `0.0.0.0/0` on port 5432 **only during judging** (acceptable for a throwaway demo cluster because the endpoint is still IAM/password-gated and you delete it after — *note this trade-off in the BUILD_LOG*), or (b) front with a small allow-list if Vercel publishes a stable egress range for your plan (**verify against current Vercel docs**), or (c) use **Vercel Secure Compute / static egress IP** if available on your plan and add that single CIDR.
> 2. **Do NOT** add a NAT Gateway or RDS Proxy just to solve this — the contract forbids both unless connection limits force it.
>
> Record exactly which inbound rule is live at demo time. The "publicly-accessible endpoint LOCKED by a security group" line in the contract means: never leave it wide open *after* submission — teardown ([§3.11](#311-step-11--teardown-after-submission)) removes the cluster entirely.

Verify the rule:

```bash
aws ec2 describe-security-groups --group-ids "$SG_ID" \
  --query 'SecurityGroups[0].IpPermissions' --region "$AWS_REGION"
```

---

### 3.4 — Step 4 — Create the least-privilege app DB user

The app connects as `recall_app` (not the master). Grant it exactly what the hero query + seed need, and enable **IAM auth** for it so Vercel can connect with **no password** via `rds-db:connect`.

In `psql` (as master):

```sql
-- App role with login; grant rds_iam so it authenticates via IAM tokens (no static password from Vercel)
CREATE ROLE recall_app WITH LOGIN;
GRANT rds_iam TO recall_app;                          -- enables IAM-token auth for this user

-- Least privilege on the recall schema (run AFTER migrations create the tables, or re-run GRANTs)
GRANT CONNECT ON DATABASE recall TO recall_app;
GRANT USAGE ON SCHEMA public TO recall_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO recall_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO recall_app;
-- Make future tables (created by migrate) inherit the grants:
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO recall_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO recall_app;
```

> **Order note:** run `pnpm db:migrate` ([§3.8](#38-step-8--migrate--seed-against-aurora)) **as the master user** (it creates extensions/tables), then re-run the `GRANT ... ON ALL TABLES` line so `recall_app` can read/write the freshly-created tables. Alternatively run migrate as master, then the grants. The hero query only needs `SELECT`; `INSERT/UPDATE` are for the optional Cron ingest.

---

### 3.5 — Step 5 — IAM role for Vercel OIDC (trust + least-privilege)

This is the **keyless** path: the Vercel function presents an OIDC token, assumes this role via `AssumeRoleWithWebIdentity`, and gets short-lived STS credentials. **No long-lived AWS keys anywhere.**

**(a) Register the Vercel OIDC provider in IAM (one-time per account):**

```bash
aws iam create-open-id-connect-provider \
  --url "https://oidc.vercel.com/$TEAM_SLUG" \
  --client-id-list "https://vercel.com/$TEAM_SLUG"
# If it already exists you'll get EntityAlreadyExists — fine, continue.
```

Capture the provider ARN (needed for the trust policy `Federated` principal):

```bash
export OIDC_PROVIDER_ARN="arn:aws:iam::${ACCOUNT_ID}:oidc-provider/oidc.vercel.com/${TEAM_SLUG}"
echo "$OIDC_PROVIDER_ARN"
```

**(b) Write the trust policy** — Federated `oidc.vercel.com/<TEAM_SLUG>`, with `aud` = the team issuer host and `sub` scoped to this team+project (so only the `recall` project may assume the role):

```bash
cat > /tmp/recall-trust-policy.json <<JSON
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": { "Federated": "${OIDC_PROVIDER_ARN}" },
      "Action": "sts:AssumeRoleWithWebIdentity",
      "Condition": {
        "StringEquals": {
          "oidc.vercel.com/${TEAM_SLUG}:aud": "https://vercel.com/${TEAM_SLUG}"
        },
        "StringLike": {
          "oidc.vercel.com/${TEAM_SLUG}:sub": "owner:${TEAM_SLUG}:project:${PROJECT_NAME}:environment:*"
        }
      }
    }
  ]
}
JSON
```

> **Verify the claim key shape against current Vercel/AWS docs.** Vercel's OIDC subject claim is `owner:<team>:project:<project>:environment:<env>`; the audience defaults to `https://vercel.com/<team>`. Tighten `environment:*` to `environment:production` once Phase 10 confirms the deployed env name. If you ever see `AccessDenied` on `AssumeRoleWithWebIdentity`, dump the real token claims from a Vercel function log and match the `sub`/`aud` exactly.

**(c) Create the role:**

```bash
aws iam create-role \
  --role-name recall-vercel-runtime \
  --assume-role-policy-document file:///tmp/recall-trust-policy.json \
  --description "Recall — Vercel OIDC keyless runtime role"

export AWS_ROLE_ARN="arn:aws:iam::${ACCOUNT_ID}:role/recall-vercel-runtime"
echo "AWS_ROLE_ARN=$AWS_ROLE_ARN"   # goes into Vercel env in Phase 10
```

**(d) Write & attach the least-privilege permissions policy.** Two auth styles — include **`rds-db:connect`** (IAM DB auth, recommended) **or** Secrets Manager read (fallback), plus **`bedrock:InvokeModel`** for query-time embedding. Get the cluster **resource ID** for the `rds-db:connect` ARN:

```bash
export DBI_RESOURCE_ID="$(aws rds describe-db-clusters \
  --db-cluster-identifier "$CLUSTER_ID" \
  --query 'DBClusters[0].DbClusterResourceId' --output text --region "$AWS_REGION")"
echo "DBI_RESOURCE_ID=$DBI_RESOURCE_ID"   # e.g. cluster-ABCDEF...

cat > /tmp/recall-permissions-policy.json <<JSON
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "RdsIamAuthConnectAsAppUser",
      "Effect": "Allow",
      "Action": ["rds-db:connect"],
      "Resource": "arn:aws:rds-db:${AWS_REGION}:${ACCOUNT_ID}:dbuser:${DBI_RESOURCE_ID}/${APP_USER}"
    },
    {
      "Sid": "ReadDbSecretFallback",
      "Effect": "Allow",
      "Action": ["secretsmanager:GetSecretValue"],
      "Resource": "arn:aws:secretsmanager:${AWS_REGION}:${ACCOUNT_ID}:secret:recall/db-*"
    },
    {
      "Sid": "BedrockTitanEmbeddings",
      "Effect": "Allow",
      "Action": ["bedrock:InvokeModel"],
      "Resource": "arn:aws:bedrock:${AWS_REGION}::foundation-model/amazon.titan-embed-text-v2:0"
    }
  ]
}
JSON

aws iam put-role-policy \
  --role-name recall-vercel-runtime \
  --policy-name recall-runtime-least-privilege \
  --policy-document file:///tmp/recall-permissions-policy.json
```

> **Pick ONE DB-auth statement for production** and delete the other: if you use **IAM DB auth** (recommended — no password material in Vercel), keep `RdsIamAuthConnectAsAppUser` and drop `ReadDbSecretFallback`; if you use **Secrets Manager** ([§3.7](#37-step-7--db-credentials-rds-iam-auth-recommended-secrets-manager-fallback)), do the reverse. Keeping both is broader than least-privilege. The `bedrock:InvokeModel` statement is only needed if `EMBED_PROVIDER=bedrock` resolves embeddings at runtime; if you precompute all embeddings offline (the recommended path), Bedrock is invoked from your seeding machine's credentials, not the Vercel role — you can then drop the Bedrock statement from the *runtime* role.

---

### 3.6 — Step 6 — Switch embeddings to Bedrock Titan v2

**Verify the dimension first.** As of June 2026, **Amazon Titan Text Embeddings V2** (`amazon.titan-embed-text-v2:0`) supports output dimensions **1024 (default), 512, and 256** — *verified against the [Bedrock Titan Text Embeddings V2 model card](https://docs.aws.amazon.com/bedrock/latest/userguide/model-card-amazon-titan-text-embeddings-v2.html)*. **Re-verify against current AWS docs before relying on it.** We pin **`EMBED_DIM=1024`** for the cloud (Bedrock) path; **local stays 384** (`Xenova/all-MiniLM-L6-v2`).

> ⚠️ **`EMBED_DIM` is chosen at MIGRATE time** — `incidents.embedding` is declared `vector(EMBED_DIM)` (see [PHASE-01](./PHASE-01-database-schema.md)). The local DB was migrated with `EMBED_DIM=384`; **Aurora must be migrated with `EMBED_DIM=1024`** (or whatever you verify). You cannot mix providers against one already-migrated DB without re-migrating, because the column dimension is fixed and the HNSW index is built for that dimension. This is why migrate + seed against Aurora happen *after* flipping the embedding config.

**(a) Verify Bedrock access + the actual output dimension** from your seeding machine (uses your local AWS creds):

```bash
# List the model to confirm access (verify the modelId string against current docs)
aws bedrock list-foundation-models --region "$AWS_REGION" \
  --query "modelSummaries[?modelId=='amazon.titan-embed-text-v2:0'].{id:modelId,out:outputModalities}" --output table

# Invoke once and COUNT the returned dimension — this is the ground truth EMBED_DIM
aws bedrock-runtime invoke-model \
  --region "$AWS_REGION" \
  --model-id "amazon.titan-embed-text-v2:0" \
  --content-type application/json --accept application/json \
  --body "$(printf '{"inputText":"listeria in romaine lettuce","dimensions":1024,"normalize":true}' | base64)" \
  /tmp/titan_out.json >/dev/null && \
  node -e "const j=require('/tmp/titan_out.json'); console.log('Titan v2 dim =', j.embedding.length)"
# Expect: Titan v2 dim = 1024   <-- set EMBED_DIM to this exact number
```

**(b) Implement `lib/embeddings/bedrock.ts`** (the cloud provider half of the pluggable `lib/embeddings/index.ts` dispatcher). Install the SDK if not present:

```bash
pnpm add @aws-sdk/client-bedrock-runtime @vercel/oidc-aws-credentials-provider
```

```ts
// lib/embeddings/bedrock.ts
// Cloud embedding provider — AWS Bedrock Titan Text Embeddings v2.
// Server-only. Credentials resolve via OIDC keyless on Vercel; via the default
// chain (env/SSO/role) on a seeding machine. NEVER long-lived keys in the app.
import {
  BedrockRuntimeClient,
  InvokeModelCommand,
} from "@aws-sdk/client-bedrock-runtime";
import { awsCredentialsProvider } from "@vercel/oidc-aws-credentials-provider";
import { AWS_REGION, EMBED_DIM } from "@/lib/config";

const BEDROCK_MODEL_ID =
  process.env.BEDROCK_MODEL_ID ?? "amazon.titan-embed-text-v2:0"; // verify against current docs

// On Vercel: assume the OIDC role. Off Vercel (seeding/bench): undefined →
// the SDK falls back to the default credential chain (env / SSO / instance role).
const credentials = process.env.VERCEL
  ? awsCredentialsProvider({ roleArn: process.env.AWS_ROLE_ARN! })
  : undefined;

const client = new BedrockRuntimeClient({ region: AWS_REGION, credentials });

/**
 * Embed one text into an EMBED_DIM-length vector via Titan v2.
 * EMBED_DIM MUST equal the verified Titan v2 output dimension used at migrate time.
 */
export async function embedBedrock(text: string): Promise<number[]> {
  const cmd = new InvokeModelCommand({
    modelId: BEDROCK_MODEL_ID,
    contentType: "application/json",
    accept: "application/json",
    body: JSON.stringify({
      inputText: text,
      dimensions: EMBED_DIM, // 1024 | 512 | 256 — must match the vector(EMBED_DIM) column
      normalize: true,       // cosine-ready; we index with vector_cosine_ops
    }),
  });
  const res = await client.send(cmd);
  const json = JSON.parse(new TextDecoder().decode(res.body)) as {
    embedding: number[];
  };
  if (json.embedding?.length !== EMBED_DIM) {
    throw new Error(
      `Titan v2 returned ${json.embedding?.length} dims, expected EMBED_DIM=${EMBED_DIM}. ` +
        `Verify the model dimension and re-migrate.`,
    );
  }
  return json.embedding;
}
```

**(c) Wire it into the dispatcher** `lib/embeddings/index.ts` (it already branches on `EMBED_PROVIDER` per the contract — confirm the `bedrock` branch calls `embedBedrock`):

```ts
// lib/embeddings/index.ts (excerpt — confirm this branch exists)
import { EMBED_PROVIDER } from "@/lib/config";
import { embedLocal } from "./local";
import { embedBedrock } from "./bedrock";

export async function embed(text: string): Promise<number[]> {
  return EMBED_PROVIDER === "bedrock" ? embedBedrock(text) : embedLocal(text);
}
```

**(d) Set the cloud embedding env** (you'll export these in the same shell as migrate/seed in [§3.8](#38-step-8--migrate--seed-against-aurora)):

```bash
export EMBED_PROVIDER=bedrock
export EMBED_DIM=1024                      # <-- the value you VERIFIED in (a)
export BEDROCK_MODEL_ID=amazon.titan-embed-text-v2:0
```

> **`lib/config.ts` must read `EMBED_DIM` from env** so the migration declares `vector(1024)` for Aurora and `vector(384)` for local — one constant, two values, chosen at migrate time (CONVENTIONS §6). Verify `EMBED_DIM` is sourced from `process.env.EMBED_DIM` (defaulting to 384) and not hardcoded.

---

### 3.7 — Step 7 — DB credentials: RDS IAM auth (recommended) / Secrets Manager (fallback)

You enabled IAM DB auth on the cluster ([§3.1](#31--step-1a--create-the-cluster-aws-console-click-path)/[§3.1B](#31b--step-1b--create-the-cluster-aws-cli)) and granted `rds_iam` to `recall_app` ([§3.4](#34-step-4--create-the-least-privilege-app-db-user)). Two ways the **runtime** (Vercel) connects:

**Option 1 — IAM DB auth token (recommended; no password material in Vercel).** `lib/db/pool.ts` generates a short-lived auth token via the OIDC-resolved credentials and uses it as the Postgres password. The contract's `lib/db/pool.ts` already branches on `DEPLOY_TARGET`; the `aurora` branch should mint the token. Sketch (Phase 10 wires it into the deployed pool):

```ts
// lib/db/pool.ts (aurora branch sketch — token-based, no static password)
import { Signer } from "@aws-sdk/rds-signer";
import { awsCredentialsProvider } from "@vercel/oidc-aws-credentials-provider";
// ...
const signer = new Signer({
  hostname: process.env.AURORA_HOST!,
  port: Number(process.env.AURORA_PORT ?? 5432),
  username: process.env.AURORA_USER!, // recall_app
  region: process.env.AWS_REGION!,
  credentials: process.env.VERCEL
    ? awsCredentialsProvider({ roleArn: process.env.AWS_ROLE_ARN! })
    : undefined,
});
// pg Pool password as an async fn so each new connection gets a fresh signed token:
// password: async () => signer.getAuthToken(),
// ssl: { rejectUnauthorized: true }  // Aurora public endpoint requires SSL
```

> `@aws-sdk/rds-signer` produces the IAM auth token; **verify the package/class name against current AWS SDK v3 docs** (`getAuthToken`). The matching IAM action is `rds-db:connect` on the `dbuser:<resourceId>/recall_app` ARN ([§3.5d](#35-step-5--iam-role-for-vercel-oidc-trust--least-privilege)).

**Option 2 — Secrets Manager (fallback; if IAM-token wiring fights you).** Store the `recall_app` password as a secret and have the runtime read it once at boot via `secretsmanager:GetSecretValue`:

```bash
aws secretsmanager create-secret \
  --name "recall/db-app" \
  --secret-string "{\"username\":\"$APP_USER\",\"password\":\"$(openssl rand -base64 24 | tr -d '/+=' | head -c 24)\",\"host\":\"$AURORA_HOST\",\"port\":5432,\"dbname\":\"$DB_NAME\"}" \
  --region "$AWS_REGION"
# Then ALTER the recall_app password to match, and keep the ReadDbSecretFallback IAM statement.
```

> **For seeding from your laptop** ([§3.8](#38-step-8--migrate--seed-against-aurora)) the simplest path is a **plain `DATABASE_URL`** pointing at Aurora with the master (or app) password and `sslmode=require` — IAM token signing on a laptop is unnecessary friction. Keep IAM auth for the *Vercel runtime* (Phase 10). The contract's anti-fake rule is about the deployed app, not the seeding script.

---

### 3.8 — Step 8 — Migrate & seed against Aurora

`DEPLOY_TARGET=aurora` is the only switch; `lib/db/pool.ts` reads the `AURORA_*` env. For migrate+seed from your laptop, point at the cluster with SSL. **Re-migrate with the cloud `EMBED_DIM`** (the column dimension differs from local).

```bash
# --- Cloud env for migrate + seed (one shell session) ---
export DEPLOY_TARGET=aurora
export AURORA_HOST="$AURORA_HOST"          # from §3.1B(e)
export AURORA_PORT=5432
export AURORA_DB="$DB_NAME"                # recall
export AURORA_USER="$MASTER_USER"          # run migrate as master (creates extensions/tables)
# Either a direct URL (simplest for laptop seeding) ...
export DATABASE_URL="postgres://$MASTER_USER:$MASTER_PW@$AURORA_HOST:5432/$DB_NAME?sslmode=require"
# ... or rely on lib/db/pool.ts's aurora branch reading AURORA_* + token/secret.

# Embedding config for the cloud (from §3.6)
export EMBED_PROVIDER=bedrock
export EMBED_DIM=1024                       # VERIFIED Titan v2 dim
export BEDROCK_MODEL_ID=amazon.titan-embed-text-v2:0

# 1) Apply forward-only migrations to Aurora (extensions already created in §3.2;
#    0001_extensions.sql is idempotent (CREATE EXTENSION IF NOT EXISTS), 0002 schema with vector(1024), 0003 indexes)
pnpm db:migrate
#    Expect: "applied 0001_extensions.sql, 0002_schema.sql, 0003_indexes.sql" with no errors.
#    Verify the embedding column dimension matches EMBED_DIM:
PGPASSWORD="$MASTER_PW" psql "host=$AURORA_HOST dbname=$DB_NAME user=$MASTER_USER sslmode=require" \
  -c "SELECT atttypmod FROM pg_attribute WHERE attrelid='incidents'::regclass AND attname='embedding';"
#    atttypmod should reflect vector(1024).

# 2) Seed real volume into Aurora. This is the long pole — Bedrock-embedding ~2,000 incidents
#    + COPY-loading ~80k lots / ~250k edges / ~250k shipments. Watch ACU climb (good — it's the proof).
pnpm db:seed
#    PRINTS ACTUAL COUNTS — must hit CONVENTIONS §11 targets:
#    ~5,000 suppliers/facilities · ~80,000 lots · ~250,000 lot_links · ~250,000 shipments
#    · ~1,400 stores across 38 states · ~2,000 incidents with REAL Titan v2 embeddings.

# 3) Re-grant app-user privileges on the freshly-created tables (from §3.4)
PGPASSWORD="$MASTER_PW" psql "host=$AURORA_HOST dbname=$DB_NAME user=$MASTER_USER sslmode=require" -c "
  GRANT USAGE ON SCHEMA public TO recall_app;
  GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO recall_app;
  GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO recall_app;"
```

> **Seeding tips:** raise `MaxCapacity` temporarily to **e.g. 8 ACU** *only for the seed/HNSW-index build* if seeding is slow, then drop it back to `2` for serving (`aws rds modify-db-cluster --serverless-v2-scaling-configuration MinCapacity=0,MaxCapacity=2 --apply-immediately`) — **verify and note this in the BUILD_LOG**; the contract pins `MaxACU=2` for *serving*, and a transient bump to build the index faster is fine and on-thesis (Serverless v2 scales up to build HNSW, down to serve). If `db:seed` rate-limits on Bedrock, batch the 2,000 embeddings with a small concurrency cap + retry (Titan has per-account TPM limits — **verify current quotas**).

---

### 3.9 — Step 9 — Flip `DEPLOY_TARGET=aurora` and re-run the bench

With the same cloud env exported, run the benchmark **against Aurora** and confirm sub-second.

```bash
export DEPLOY_TARGET=aurora
# (AURORA_* / DATABASE_URL / EMBED_* still exported from §3.8)

# Warm the cluster first — a cold scale-up from 0 ACU makes the FIRST query slow.
# Fire one throwaway trace, THEN measure (the on-screen/demo number must be a warm, real measurement).
PGPASSWORD="$MASTER_PW" psql "host=$AURORA_HOST dbname=$DB_NAME user=$MASTER_USER sslmode=require" \
  -c "SELECT count(*) FROM lot_links;"   # ~250000 — also a row-count proof

pnpm bench
#    tsx scripts/trace-bench.ts → prints p50/p99 over N runs of the DEMO_TLC trace.
#    EXPECT: p50 < 1s over ~250k edges; DEMO_TLC resolves to ~1,400 stores.
#    This latency is what goes on the console top bar in Phase 10 — a REAL measurement.
```

> **Cold-start honesty:** the very first trace after idle pays the scale-up-from-0 tax (can be a few seconds). For the demo, keep one warm trace running before recording, or accept a sane `MinACU` floor *for the recording window only* and reset to 0 after (and only claim "scale-to-zero" when you can show ACU=0 in CloudWatch — see [§3.10](#310-step-10--capture-the-aws-db-proof-screenshot)). Never hardcode the latency.

---

### 3.10 — Step 10 — Capture the AWS-DB proof screenshot

Three artifacts (mandatory for submission — [PHASE-11](./PHASE-11-demo-and-submission.md), [submission-checklist.md](../reference/submission-checklist.md)). Capture all three; the EXPLAIN is the single highest-leverage one.

**(a) RDS console — the Serverless v2 cluster page.** RDS → Databases → `recall-aurora`. Capture a frame showing: **cluster name `recall-aurora`**, **engine = Aurora PostgreSQL 16.x**, **region `us-east-1`**, **capacity type Serverless v2 with Min 0 / Max 2 ACU**, status **Available**, and the **cluster ARN** (Configuration tab). This is the literal "AWS DB usage" proof.

**(b) psql `EXPLAIN (ANALYZE, BUFFERS)` showing HNSW + GiST + Recursive Union.** Run the hero query's EXPLAIN against Aurora and screenshot the plan:

```bash
PGPASSWORD="$MASTER_PW" psql "host=$AURORA_HOST dbname=$DB_NAME user=$MASTER_USER sslmode=require"
```
```sql
-- Surface the index definitions first (proves vector + GiST are real, not a LIKE)
\d incidents
\d stores
-- Then the live plan over real volume. Substitute the DEMO_TLC and a real query embedding literal.
-- (Get the embedding literal from the app's /api/explain, or embed DEMO_TLC text via Bedrock and paste the [..] vector.)
EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT)
WITH RECURSIVE contaminated AS (
  SELECT l.lot_id, 0 AS depth, ARRAY[l.lot_id] AS path
  FROM lots l WHERE l.tlc = 'PRD-OUTBREAK-0001'
  UNION ALL
  SELECT ll.child_lot_id, c.depth + 1, c.path || ll.child_lot_id
  FROM contaminated c JOIN lot_links ll ON ll.parent_lot_id = c.lot_id
  WHERE c.depth < 12 AND ll.child_lot_id <> ALL(c.path)
)
-- ... (the full hero query from CONVENTIONS §7; the EXPLAIN must show:)
;
```
The screenshot **must show**, with real timing: a **Recursive Union** node, an **Index Scan using `idx_lot_links_parent`** at the recursive term (not a Seq Scan), an **`idx_incidents_hnsw`** index scan, and a **`idx_stores_geom`** GiST path. *(This is the "DB is the protagonist" money shot.)*

**(c) CloudWatch ACU scaling graph.** CloudWatch → Metrics → RDS → `ServerlessDatabaseCapacity` for cluster `recall-aurora`, last 1–3 hours. The graph must show capacity **rising during seed/bench** and **dropping to 0 when idle** (the scale-to-zero confirmation). Confirm idle = 0 from the CLI too:

```bash
aws cloudwatch get-metric-statistics \
  --namespace AWS/RDS --metric-name ServerlessDatabaseCapacity \
  --dimensions Name=DBClusterIdentifier,Value="$CLUSTER_ID" \
  --start-time "$(date -u -v-2H +%Y-%m-%dT%H:%M:%SZ 2>/dev/null || date -u -d '2 hours ago' +%Y-%m-%dT%H:%M:%SZ)" \
  --end-time "$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
  --period 60 --statistics Minimum Maximum --region "$AWS_REGION" \
  --query 'Datapoints | sort_by(@,&Timestamp)[].{t:Timestamp,min:Minimum,max:Maximum}' --output table
# Confirm: Max climbs during work, Min returns to 0.0 after idle (verify auto-pause delay ~ a few min).
```

> Pair these in **one composite frame** with the deployed Vercel URL + Team ID (the "is this really wired up?" closer) when you assemble the submission in Phase 11.

---

### 3.11 — Step 11 — Teardown (after submission)

> **Run this ONLY after the submission is final and recorded.** Deleting the cluster stops all charges. `MinACU=0` already keeps idle ~$0 between sessions, but the cluster, snapshots, and any secret still cost something to keep — delete everything.

```bash
# 1) Delete the writer instance
aws rds delete-db-instance \
  --db-instance-identifier "$WRITER_ID" \
  --skip-final-snapshot --region "$AWS_REGION"
aws rds wait db-instance-deleted --db-instance-identifier "$WRITER_ID" --region "$AWS_REGION"

# 2) Delete the cluster WITHOUT a final snapshot (so no lingering snapshot cost)
aws rds delete-db-cluster \
  --db-cluster-identifier "$CLUSTER_ID" \
  --skip-final-snapshot --region "$AWS_REGION"
aws rds wait db-cluster-deleted --db-cluster-identifier "$CLUSTER_ID" --region "$AWS_REGION"

# 3) Delete any manual/automated snapshots that remain (verify none linger)
aws rds describe-db-cluster-snapshots --db-cluster-identifier "$CLUSTER_ID" \
  --query 'DBClusterSnapshots[].DBClusterSnapshotIdentifier' --output text --region "$AWS_REGION"
# For each: aws rds delete-db-cluster-snapshot --db-cluster-snapshot-identifier <id> --region "$AWS_REGION"

# 4) Tear down networking + secret
aws rds delete-db-subnet-group --db-subnet-group-name "$SUBNET_GROUP" --region "$AWS_REGION"
aws ec2 delete-security-group --group-id "$SG_ID" --region "$AWS_REGION"
aws secretsmanager delete-secret --secret-id "recall/db-app" --force-delete-without-recovery --region "$AWS_REGION" 2>/dev/null || true

# 5) (Optional) Remove IAM role + OIDC provider if not reused by other projects
aws iam delete-role-policy --role-name recall-vercel-runtime --policy-name recall-runtime-least-privilege 2>/dev/null || true
aws iam delete-role --role-name recall-vercel-runtime 2>/dev/null || true
# aws iam delete-open-id-connect-provider --open-id-connect-provider-arn "$OIDC_PROVIDER_ARN"   # only if no other project uses it

echo "Teardown complete. Verify in the RDS console that no recall-aurora resources remain."
```

> **Verify $0:** after teardown, check the AWS **Billing** console the next day and confirm no RDS/Serverless charges accrue. Keep the `BUILD_LOG` note of when you tore down (for the cost story).

---

## 4. Key files

| Path | Purpose |
|---|---|
| `lib/embeddings/bedrock.ts` | **Created/finished here.** Cloud embedding provider — Titan v2 via Bedrock Runtime; OIDC creds on Vercel, default chain on the seeding machine; asserts the returned dim == `EMBED_DIM`. |
| `lib/embeddings/index.ts` | The dispatcher — confirm the `bedrock` branch calls `embedBedrock`. |
| `lib/config.ts` | `EMBED_DIM` must read from `process.env.EMBED_DIM` (384 local / 1024 Aurora), plus `EMBED_PROVIDER`, `DEPLOY_TARGET`, `AWS_REGION`, `DEMO_TLC`. |
| `lib/db/pool.ts` | The `aurora` branch (IAM-token or Secrets-Manager creds, `ssl: { rejectUnauthorized: true }`) — wired for the runtime in Phase 10; used here for migrate/seed/bench via `AURORA_*`/`DATABASE_URL`. |
| `db/migrations/0002_schema.sql` | Declares `incidents.embedding vector(EMBED_DIM)` — re-applied to Aurora with `EMBED_DIM=1024`. |
| `scripts/migrate.ts` | `pnpm db:migrate` — forward-only; idempotent extensions; run as master against Aurora. |
| `db/seed/load.ts` | `pnpm db:seed` — generates + loads real volume; embeds incidents via the active provider (Bedrock here); prints actual counts. |
| `scripts/trace-bench.ts` | `pnpm bench` — measures p50/p99 of the `DEMO_TLC` trace against the active `DEPLOY_TARGET`. |
| `.env.example` | Document the `AURORA_*`, `AWS_ROLE_ARN`, `EMBED_PROVIDER=bedrock`, `EMBED_DIM=1024`, `BEDROCK_MODEL_ID` cloud values. |
| `/tmp/recall-trust-policy.json` | The OIDC trust policy (Federated `oidc.vercel.com/<TEAM_SLUG>`, `sub`/`aud` conditions). |
| `/tmp/recall-permissions-policy.json` | The least-privilege permissions policy (`rds-db:connect` / Secrets read + `bedrock:InvokeModel`). |

---

## 5. Definition of Done

Each box has an **exact verification command and expected output**. All must hold.

- [ ] **Cluster is Serverless v2, PG 16+, Min 0 / Max 2 ACU, public, in `us-east-1`.**
  ```bash
  aws rds describe-db-clusters --db-cluster-identifier recall-aurora \
    --query 'DBClusters[0].{Engine:EngineVersion,Status:Status,Scaling:ServerlessV2ScalingConfiguration,Public:PubliclyAccessible}' \
    --region us-east-1
  ```
  Expect: `Engine` starts `16.`, `Status: "available"`, `Scaling.MinCapacity: 0.0`, `Scaling.MaxCapacity: 2.0`, `Public: true`.
- [ ] **Extensions enabled.** `psql ... -c "SELECT extname,extversion FROM pg_extension WHERE extname IN ('vector','postgis');"` → both rows present (`vector` ≥ 0.8.0, `postgis` 3.x).
- [ ] **IAM OIDC role + policies exist and are scoped.** `aws iam get-role --role-name recall-vercel-runtime` returns the trust policy with `Federated` = the `oidc.vercel.com/<TEAM_SLUG>` provider ARN and the `aud`/`sub` conditions; `aws iam get-role-policy --role-name recall-vercel-runtime --policy-name recall-runtime-least-privilege` returns the least-privilege actions.
- [ ] **Bedrock Titan v2 reachable; dimension verified == `EMBED_DIM`.** The `aws bedrock-runtime invoke-model` call in [§3.6a](#36-step-6--switch-embeddings-to-bedrock-titan-v2) prints `Titan v2 dim = 1024` (or your verified number); `EMBED_DIM` matches.
- [ ] **Migrated + seeded against Aurora at real volume.** `pnpm db:seed` prints counts hitting CONVENTIONS §11 targets; `psql ... -c "SELECT count(*) FROM lot_links;"` ≈ `250000`; `SELECT count(*) FROM incidents WHERE embedding IS NOT NULL;` ≈ `2000`; the `incidents.embedding` column is `vector(1024)`.
- [ ] **`DEPLOY_TARGET=aurora pnpm bench` is sub-second.** Bench prints **p50 < 1000 ms** over ~250k edges; `DEMO_TLC` resolves to ~1,400 stores. (Warm the cluster first.)
- [ ] **App runs against Aurora.** With `DEPLOY_TARGET=aurora` + cloud env, `pnpm dev` → paste `DEMO_TLC` in the console → graph/map/rail populate from Aurora rows; top bar shows a real measured latency. (Phase 10 does this on the *deployed* URL; here, locally pointed at Aurora.)
- [ ] **Scale-to-zero confirmed.** The CloudWatch `ServerlessDatabaseCapacity` graph (and the CLI `get-metric-statistics` in [§3.10c](#310-step-10--capture-the-aws-db-proof-screenshot)) show **Min returning to 0.0** when idle and rising under load.
- [ ] **Proof screenshots captured** (all three): RDS Serverless v2 cluster page · psql `EXPLAIN (ANALYZE, BUFFERS)` showing Recursive Union + `idx_lot_links_parent` index scan + `idx_incidents_hnsw` + `idx_stores_geom` · CloudWatch ACU graph rising-then-zero.
- [ ] **No secrets committed.** `git grep -nE 'AWS_SECRET_ACCESS_KEY|AKIA[0-9A-Z]{16}|-----BEGIN' || echo "clean"` → `clean`; `MASTER_PW`/tokens never written to a tracked file.
- [ ] **GREEN gate still holds.** `pnpm typecheck && pnpm lint && pnpm test` pass with the new `bedrock.ts` in the tree.
- [ ] **BUILD_LOG entry appended** ([§8](#8-build_log-entry-to-append)).

---

## 6. Common pitfalls & fixes

| Pitfall | Symptom | Fix |
|---|---|---|
| **`MinCapacity=0` rejected** | `create-db-cluster` errors that 0 is invalid | Engine version predates scale-to-zero. Bump `--engine-version` to a PG 16.x that supports it (query in [§3.0](#30--shell-variables-set-once-reused-below)); **verify the minimum version against current AWS docs**. Fallback: `MinCapacity=0.5` (don't claim scale-to-zero without ACU=0 proof). |
| **`db.serverless` instance fails to create** | instance creation errors / stuck | Create the **cluster first**, then the writer instance with `--db-instance-class db.serverless` ([§3.1B(d)](#31b--step-1b--create-the-cluster-aws-cli)). Both must specify `--engine aurora-postgresql`. |
| **`CREATE EXTENSION vector` not available** | `extension "vector" is not available` | Engine version too old or extension not allow-listed. Bump engine version; confirm against the RDS PostgreSQL extensions list. PostGIS + pgvector are first-class on current 16.x. |
| **Can't connect via psql** | timeout on `host=...rds.amazonaws.com` | SG inbound 5432 not open to your IP, or cluster not public. Re-check [§3.3](#33-step-3--lock-the-security-group-inbound-5432) (`$MY_IP` changed? re-`authorize`), confirm `PubliclyAccessible: true`, and always pass `sslmode=require`. |
| **Embedding-dimension mismatch** | seed insert errors `expected N dimensions, got 1024`, or HNSW build fails | Aurora was migrated with `EMBED_DIM=384` (the local value). Re-migrate with `EMBED_DIM=1024` so `incidents.embedding` is `vector(1024)`; the column dim must equal the provider's output dim. |
| **`AssumeRoleWithWebIdentity` AccessDenied** | Vercel function can't assume the role (Phase 10) | `sub`/`aud` in the trust policy don't match the real token claims. Dump claims from a function log; match `oidc.vercel.com/<TEAM_SLUG>:sub` = `owner:<team>:project:<project>:environment:<env>` and `:aud` = `https://vercel.com/<team>`. **Verify the OIDC provider was registered with the team-scoped URL.** |
| **Bedrock `AccessDeniedException` / model not found** | invoke-model fails | Model access not granted in this region, or wrong model ID. Enable Titan Text Embeddings V2 in Bedrock → Model access (`us-east-1`); **verify the exact model ID** (`amazon.titan-embed-text-v2:0`). |
| **Bedrock throttling during seed** | `ThrottlingException` embedding 2,000 incidents | Cap concurrency, add jittered retry, or batch. **Verify current TPM quota**; request an increase if needed, or precompute with a slower loop. |
| **First on-camera query is slow** | seconds-long trace right after idle | Cold scale-up from 0 ACU. Warm with a throwaway query before recording ([§3.9](#39-step-9--flip-deploy_targetaurora-and-re-run-the-bench)); never hardcode latency. |
| **Cross-region latency tax** | snappy local, slow Aurora | Vercel function region ≠ Aurora region. Pin Vercel `regions: ["iad1"]` (== `us-east-1`) in Phase 10; the cluster is already in `us-east-1`. |
| **Seeding is very slow** | `pnpm db:seed` crawls; ACU pinned at 2 | Temporarily raise `MaxCapacity` (e.g. 8) for the seed/HNSW build, then reset to 2 for serving ([§3.8](#38-step-8--migrate--seed-against-aurora)); note it in BUILD_LOG. |
| **Snapshot cost lingers after teardown** | unexpected RDS charge post-submission | Delete with `--skip-final-snapshot` and delete any remaining cluster snapshots ([§3.11](#311-step-11--teardown-after-submission)); verify Billing the next day. |

---

## 7. Cut-if-scope-bites

Cut in this order if the cloud swap is eating time — **but never cut the never-cut list below**:

1. **Bedrock embeddings → keep local 384-dim against Aurora.** If Bedrock access/throttling fights you, set `EMBED_PROVIDER=local` and migrate Aurora with `EMBED_DIM=384`. The pgvector HNSW path is still real and on Aurora — you simply embed with `@xenova/transformers` instead of Titan. (The all-AWS narrative is nicer, but a working HNSW on Aurora beats a blocked Bedrock call.) Drop the `bedrock:InvokeModel` IAM statement in that case.
2. **IAM DB-auth token → Secrets Manager password.** If `@aws-sdk/rds-signer` token wiring is flaky, fall back to the Secrets-Manager password path ([§3.7 Option 2](#37-step-7--db-credentials-rds-iam-auth-recommended-secrets-manager-fallback)). Still keyless from Vercel's perspective (no static AWS keys; the role reads the secret via OIDC).
3. **Tight Vercel-egress SG allow-list → temporary `0.0.0.0/0` on 5432 during judging only.** Acceptable for a throwaway, IAM/password-gated, soon-deleted demo cluster — note the trade-off; tear down after.

> **NEVER cut (CONVENTIONS §12):** the recursive CTE · the PostGIS map JOIN · the pgvector rail · the live `EXPLAIN` · real seed volume · the live-URL deploy · **OIDC keyless (no long-lived AWS keys)** · **the AWS-DB proof screenshot**. If any of these is at risk, cut from the list above instead. The whole point of this phase is that the protagonist database is *real Aurora*, proven on camera.

---

## 8. BUILD_LOG entry to append

```markdown
## Phase 09 — AWS Aurora provisioning & cloud swap — <YYYY-MM-DD>

**Outcome:** Recall now runs against a real Aurora PostgreSQL Serverless v2 cluster
in us-east-1 (engine 16.x, MinACU=0 / MaxACU=2), with pgvector + PostGIS enabled,
seeded to real volume, and the DEMO_TLC trace measured sub-second in the cloud.

- **Cluster:** `recall-aurora` (Serverless v2, db.serverless writer), engine `<16.x>`,
  pgvector `<0.8.x>`, PostGIS `<3.4.x>`, region `us-east-1`. Public endpoint LOCKED by
  SG `recall-aurora-sg` (5432 → `<scope>`). No NAT Gateway, no RDS Proxy.
- **Scale-to-zero:** confirmed — CloudWatch `ServerlessDatabaseCapacity` rises under
  load and returns to 0.0 when idle. (Screenshot captured.)
- **Embeddings:** switched to Bedrock Titan Text Embeddings v2
  (`amazon.titan-embed-text-v2:0`), verified output dim = `<1024>` → `EMBED_DIM=1024`;
  re-migrated Aurora so `incidents.embedding` is `vector(1024)`. Local stays 384.
  (`lib/embeddings/bedrock.ts` implemented.)
- **OIDC keyless:** registered IAM OIDC provider `oidc.vercel.com/<TEAM_SLUG>`; role
  `recall-vercel-runtime` with trust scoped to the team+project and a least-privilege
  policy (`rds-db:connect` on dbuser/recall_app + `bedrock:InvokeModel`). No long-lived
  AWS keys anywhere.
- **Seed counts (cloud):** suppliers/facilities `<n>` · lots `<n>` · lot_links `<~250k>`
  · shipments `<~250k>` · stores `<~1400>`/38 states · incidents `<~2000>` (real embeddings).
- **Bench (Aurora):** p50 `<X> ms` / p99 `<Y> ms` over ~250k edges; DEMO_TLC →
  `<~1400>` stores. Warm measurement; never hardcoded.
- **Proof captured:** RDS Serverless v2 cluster page · psql EXPLAIN (ANALYZE, BUFFERS)
  showing Recursive Union + idx_lot_links_parent index scan + idx_incidents_hnsw +
  idx_stores_geom · CloudWatch ACU graph.
- **Gotchas:** <e.g. bumped engine version for MinACU=0; warmed cluster before bench;
  raised MaxACU to 8 only for the HNSW build then reset to 2>.
- **GREEN:** `pnpm typecheck && pnpm lint && pnpm test` pass.
- **Teardown:** commands recorded; cluster to be DELETED with snapshots after submission.
```

---

## 9. Related docs

- [`./CONVENTIONS.md`](./CONVENTIONS.md) — the contract (Cloud DB row in §3, env vars §6, hero query §7, DB objects/indexes §9, global rules §12). **Overrides everything.**
- [`./README.md`](./README.md) — build index; this is the first **Cloud** phase on the Golden Path.
- [`./SETUP-AWS-V0.md`](./SETUP-AWS-V0.md) — AWS account + IAM OIDC + Bedrock + Vercel team setup. **Read before this phase.**
- [`./PHASE-08-testing.md`](./PHASE-08-testing.md) — the GREEN local spine this phase depends on.
- [`./PHASE-10-vercel-deploy.md`](./PHASE-10-vercel-deploy.md) — wires the deployed Vercel function to the IAM role + cluster created here (OIDC keyless, Fluid pooling, `regions: ["iad1"]`).
- [`./PHASE-11-demo-and-submission.md`](./PHASE-11-demo-and-submission.md) — consumes the proof screenshots captured here.
- [`../deep-dives/01-recall.md`](../deep-dives/01-recall.md) — §7 AWS provisioning runbook, §7.2/7.3 IAM trust + least-privilege policies, §5.1 DDL.
- [`../reference/aws-databases.md`](../reference/aws-databases.md) — §4 Aurora PG superpowers, §6 the Aurora-PG screenshot-proof catalog, §7.5 connection-limit guidance.
- [`../reference/vercel-v0-playbook.md`](../reference/vercel-v0-playbook.md) — §3 OIDC keyless, §4 Fluid + pooling, §11.5 Aurora-reachability-from-Vercel.
- [`../reference/submission-checklist.md`](../reference/submission-checklist.md) — the mandatory artifact list the proof screenshots satisfy.
- **External (verify against current AWS docs):** [Bedrock Titan Text Embeddings V2 model card](https://docs.aws.amazon.com/bedrock/latest/userguide/model-card-amazon-titan-text-embeddings-v2.html) · [Aurora Serverless v2 capacity](https://docs.aws.amazon.com/AmazonRDS/latest/AuroraUserGuide/aurora-serverless-v2.html) · [RDS IAM database authentication](https://docs.aws.amazon.com/AmazonRDS/latest/AuroraUserGuide/UsingWithRDS.IAMDBAuth.html).
