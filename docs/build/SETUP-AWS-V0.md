# SETUP-AWS-V0 — Provisioning v0.app & AWS for Recall

> **Outcome:** Both external platforms are configured exactly enough for Codex (the building agent) and the running app to *use* them. By the end you have: a v0.app + Vercel account signed in, a spend cap set with auto-recharge OFF, the **Vercel Team ID + Team Slug** recorded, the Vercel CLI logged in, **the Outbreak Console shell generated from the v0 prompt and copied into the repo**, and a clear map of which AWS pieces a **human** creates once (Aurora cluster + IAM OIDC role + Bedrock model access) versus what the **app** consumes at runtime (OIDC keyless STS — no stored keys). Local dev (Phases 00–08) needs **zero AWS**.

**Audience:** the **human operator** (privileged, interactive steps) and **Codex** (which reads the env-var / token contract). The doc is split into two explicit tracks so neither does the other's job.

**Depends on / Unblocks:** **Depends on** nothing (this is the account-setup prerequisite). **Unblocks** [PHASE-09-aws-aurora.md](./PHASE-09-aws-aurora.md) (which expects the Vercel team slug/ID recorded and AWS CLI authed) and [PHASE-10-vercel-deploy.md](./PHASE-10-vercel-deploy.md) (which expects the project linked, OIDC enabled, CLI logged in). The v0 shell feeds [PHASE-05-outbreak-console.md](./PHASE-05-outbreak-console.md).

**Effort:** ~30–45 min for the human (sign-ins + spend caps + one v0 generation + Bedrock model-access request). AWS cluster creation itself is **deferred to Phase 09** — this doc only sets up *access*, not the cluster.

---

## 1. Objectives

1. Get the human signed in to **v0.app** and **Vercel**, with a **spend limit set and auto-recharge OFF** so credits can't silently overrun.
2. Generate the **Outbreak Console UI shell** with the canonical v0 prompt and **bring the generated code into the repo** for Codex to refine — Codex consumes v0 *output*, it does **not** need a v0 API key to build.
3. Record the **Vercel Team ID** (required submission field) and **Team Slug** (required for the OIDC trust).
4. Install + log in the **Vercel CLI** so deploys (Phase 10) and `vercel env pull` work.
5. Establish the AWS access model: **local dev needs no AWS**; the cloud phase needs a **human-created Aurora cluster + IAM OIDC role**; the **running app authenticates via OIDC keyless STS** (no long-lived keys anywhere).
6. Request **Bedrock model access** for Titan Text Embeddings v2 in `us-east-1` (the gate that takes wall-clock time — do it early).
7. Hand Codex an unambiguous **credentials matrix**: which secret lives where, and who creates it.

> **The one-sentence security rule (memorize it):** *No long-lived AWS keys ever — not in the repo, not in `.env`, not in Vercel env. The app gets short-lived STS credentials from Vercel OIDC at runtime; its proof is the **absence** of `AWS_SECRET_ACCESS_KEY` anywhere.* See [§9 Security do-not-do list](#9-security-do-not-do-list).

---

## 2. Two tracks at a glance

| | **(A) What the HUMAN does ONCE** (privileged, interactive) | **(B) What CODEX / the APP uses** (programmatic, repeatable) |
|---|---|---|
| **v0 / Vercel** | Sign in to v0.app + Vercel; set v0 spend limit, auto-recharge OFF; run the v0 prompt; record Team ID + Slug; `vercel login`; (Phase 10) enable OIDC, set project env vars | Reads the **v0-generated code** committed to the repo; runs `vercel` / `vercel env pull` / `vercel deploy` with the CLI session the human created; reads `VERCEL_TEAM_ID`/slug from notes, not secrets |
| **AWS** | (Phase 09) create Aurora cluster; request Bedrock Titan v2 model access; create IAM OIDC provider + role (trust + least-privilege); either run the Phase 09 CLI yourself **or** grant Codex short-lived SSO creds | **Never** holds AWS keys. At runtime assumes the IAM role via **OIDC → STS `AssumeRoleWithWebIdentity`** and gets short-lived credentials per request via `awsCredentialsProvider({ roleArn })` |
| **Local dev (Phases 00–08)** | Install Docker + pnpm + Node 24 (one time) | Uses **Docker Postgres + local `@xenova/transformers` embeddings** — **zero AWS, zero Vercel, zero keys** |

> **Read this twice:** the only thing standing between "Codex can build the whole spine" and "Codex is blocked on AWS" is **nothing** — Phases 00–08 run entirely on local Docker Postgres with local embeddings. AWS only enters at Phase 09. So the human can do all of Track (A)/AWS *in parallel* while Codex builds.

---

## 3. v0.app & Vercel setup (human, Track A)

### 3.1 Sign in to Vercel and v0

1. **Vercel:** go to <https://vercel.com> → sign in (GitHub/GitLab/Bitbucket/email). If you are part of a **Team** (you should be — Team issuer mode is required for OIDC), switch to that team in the top-left scope switcher. Personal "Hobby" scope works for the demo but the **Team ID** is a required submission field, so prefer a Team.
2. **v0:** go to <https://v0.app> → sign in **with the same Vercel account**. v0 and Vercel share auth and billing; signing into v0 with the Vercel account links generations to your team and enables one-click deploy.

> v0.app (formerly v0.dev) is a Next.js App Router + shadcn/ui + Tailwind generator. We use it for **UI shells only** — the data wiring is done by Codex (see [vercel-v0-playbook §1](../reference/vercel-v0-playbook.md#1-what-v0-generates-well-and-how-to-prompt-it)).

### 3.2 Set the v0 spend limit and turn OFF auto-recharge

The team has full v0/Vercel credits and is happy to use them, but **uncapped auto-recharge can convert "free credits" into a surprise card charge**. Cap it.

1. v0.app → your **avatar / account menu → Billing** (or **Settings → Billing → Usage / Spend management**).
2. Set a **monthly spend limit** (e.g. the credit allotment, or a hard ceiling like `$50` for v0 generations — generations are cheap; a handful of console iterations is well under this).
3. **Turn OFF auto-recharge / "automatically purchase more credits."** When the limit is hit, v0 should **stop**, not bill the card.
4. Vercel side: **Settings → Billing → Spend Management** → set a project/team spend cap and (optionally) a **pause-deployments-on-overage** action. Auto-recharge OFF here too.

> **Hosting the app is within credits.** Recall's deployed footprint is one Next.js project on Fluid Compute in `iad1`; that sits inside the Vercel plan/credits. The cost risk is **AWS** (Aurora ACU-hours), governed separately by the **$100 AWS budget** and scale-to-zero (`MinACU=0`) — see [§7](#7-aws-cost--budget) and [PHASE-09 §teardown](./PHASE-09-aws-aurora.md).

### 3.3 Record the Vercel Team ID and Team Slug (do this now)

You need **both**:
- **Team ID** — a required *submission* field, and used to scope nothing else but the form.
- **Team Slug** — used to build the **OIDC issuer URL** `https://oidc.vercel.com/<TEAM_SLUG>` and the IAM trust policy in Phase 09.

How to get them:
1. Vercel → **Settings → General** (team scope). The **Team ID** is shown (looks like `team_xxxxxxxxxxxxxxxxxxxxxxxx`). The **Team Slug** is the URL segment, e.g. `vercel.com/<your-team-slug>`.
2. Or via the CLI once logged in (see §3.4):
   ```bash
   vercel teams ls            # lists teams; the slug is the left column
   vercel whoami              # your username/team context
   ```
3. **Write them down** where Codex can read them (a note in `BUILD_LOG.md` or `.env.example` comment — the slug/ID are **not secrets**, but they are not in the bundle either):
   ```text
   VERCEL_TEAM_ID=team_xxxxxxxxxxxxxxxxxxxxxxxx     # submission field
   VERCEL_TEAM_SLUG=your-team-slug                  # OIDC issuer: https://oidc.vercel.com/your-team-slug
   ```

### 3.4 Install and log in the Vercel CLI

Codex (and Phase 10) deploy through the CLI. Install it globally and authenticate **once** (interactive — the human does this; the session persists for Codex).

```bash
pnpm add -g vercel@latest        # or: npm i -g vercel@latest
vercel --version                 # confirm it's installed
vercel login                     # opens browser / emails a code — interactive, human-run
vercel whoami                    # should print your user once logged in
```

> The `vercel login` session is stored in `~/.vercel` and is reused by every subsequent `vercel` call, including ones Codex runs. Codex does **not** need to log in again; it inherits the human's session. Linking the repo (`vercel link`) happens in [PHASE-10 §3.1](./PHASE-10-vercel-deploy.md).

### 3.5 Generate the Outbreak Console shell (the v0 prompt)

Run this **exact prompt** in v0.app to generate the hero screen shell. It deliberately asks for the *evidence chrome* (latency chip, row-count chip, SLA timer, cosine badges, the Query Inspector) and **refuses client data fetching** so credentials stay server-side and Codex can wire a Server Component cleanly.

> **Paste into v0.app:**
>
> *"Build a dark-mode, data-dense food-safety 'Outbreak Console' dashboard with Next.js App Router (TypeScript), shadcn/ui, and Tailwind CSS v4. Control-room aesthetic; red is the ONLY accent color (contamination); everything else cool/neutral. Top bar: a primary input to paste a 'Traceability Lot Code (TLC)' with a 'Trace' button, plus three KPI chips — query latency in ms, affected-store row count, and a 24-hour FDA SLA countdown timer. Main area is a split layout: left pane = a large panel placeholder for a force-directed network graph; right pane = a US map panel placeholder for store pins. A collapsible right-edge rail titled 'Similar Past Incidents' showing cards each with a cosine-distance relevance badge and skeleton loading states. A bottom time-slider. A collapsible bottom drawer labeled 'Query Inspector' that shows SQL and an EXPLAIN plan in a monospace block. Include explicit empty, loading, error, and 'clean lot — no shelves at risk' states. Do NOT add any data fetching — leave the data as typed props (`stores`, `edges`, `incidents`, `latencyMs`, `rowCount`, `lotCount`) so I can wire a React Server Component. Define those TypeScript types."*

The single most important instruction is **"do NOT add any data fetching — leave the data as typed props."** That is what lets Codex drop the v0 component into an `async` Server Component that runs the hero query server-side.

> The same prompt appears (slightly abbreviated) in [01-recall.md §8.1](../deep-dives/01-recall.md#81-v0-prompt-to-generate-the-shell). If you want the architecture-diagram artifact for free, run a **second** v0 pass asking for an `<ArchitectureOverlay/>` component tracing `v0 frontend → Vercel Function → OIDC/STS → Aurora` (see [vercel-v0-playbook §1.2 Pass 2](../reference/vercel-v0-playbook.md#12-how-to-prompt-v0-concrete-recipe)).

### 3.6 Bring the generated code into the repo (the handoff)

v0 → repo, so Codex consumes **code**, not an API. Two ways:

- **Easiest (CLI):** in the v0 generation, use the **"Add to Codebase" / `npx shadcn@latest add <v0-url>`** command v0 gives you; run it **at the repo root** so files land in `components/` and `app/` per [CONVENTIONS §REPO LAYOUT](./CONVENTIONS.md). Then `git add` + commit on a branch.
- **Manual:** copy the generated files from the v0 UI into the canonical paths — the shell components map to `components/console/GraphPane.tsx`, `MapPane.tsx`, `IncidentRail.tsx`, `QueryInspector.tsx`, `TopBar.tsx` (rename to match the contract).

> **Codex does NOT need a v0 API key to build.** It refines committed code. The v0 key is only needed if you script generation through the **v0 Platform API** (programmatic generation) — which we are **not** doing for the spine. *If* you ever automate v0 via the Platform API, the key is `V0_API_KEY`, lives **only** in the human's shell or Vercel **server** env (never the client bundle, never committed), and is **not** required by the deployed app.

---

## 4. AWS setup model (the big picture)

```mermaid
flowchart LR
  subgraph Local["Phases 00–08 — LOCAL (zero AWS)"]
    DOCK[(Docker Postgres<br/>postgis + pgvector)]
    XEN["@xenova/transformers<br/>local 384-dim embeddings"]
  end
  subgraph Human["Phase 09 — HUMAN does once (privileged)"]
    AUR[("Aurora PostgreSQL<br/>Serverless v2, us-east-1")]
    BR["Bedrock Titan v2<br/>(model access enabled)"]
    IAMROLE["IAM role recall-vercel-runtime<br/>trust: oidc.vercel.com/&lt;slug&gt;"]
  end
  subgraph App["Phase 10 — the APP at runtime (keyless)"]
    FN["Vercel Function (iad1)"]
    STS["STS AssumeRoleWithWebIdentity<br/>short-lived creds"]
  end
  FN -- "OIDC token" --> STS
  STS -- "assumes" --> IAMROLE
  IAMROLE -- "rds-db:connect / bedrock:InvokeModel" --> AUR
  IAMROLE --> BR
```

**The rule, stated three ways:**
1. **Local dev needs ZERO AWS.** Phases 00–08 run on Docker Postgres (`postgis/postgis:16-3.4` + `postgresql-16-pgvector`) and local embeddings (`@xenova/transformers`, `Xenova/all-MiniLM-L6-v2`, 384-dim). No account, no keys, no internet to AWS. Codex builds the entire spine here.
2. **The cloud phase is human-privileged.** Creating the Aurora cluster, requesting Bedrock model access, and creating the IAM OIDC provider + role are **one-time privileged actions** the human runs (or supervises). They are scripted in [PHASE-09](./PHASE-09-aws-aurora.md).
3. **The app authenticates keyless.** The deployed Vercel function presents an **OIDC token** to AWS STS and assumes the IAM role (`AssumeRoleWithWebIdentity`), getting **short-lived** credentials per request. There are **no AWS access keys** in the app, env, or bundle — that absence *is* the security proof.

### 4.1 Who runs the Phase 09 privileged commands?

Phase 09 contains AWS CLI commands that need admin-ish IAM permissions (create cluster, create OIDC provider, create role, attach policies). Pick **one**:

- **Option 1 — the human runs Phase 09 themselves** (recommended; simplest, no Codex AWS access). The human pastes the [PHASE-09](./PHASE-09-aws-aurora.md) commands into their own authenticated `aws` shell.
- **Option 2 — grant Codex *short-lived SSO* credentials** to run Phase 09. Use **AWS IAM Identity Center (SSO)** — `aws sso login` mints a session that expires (e.g. 1–8h). Codex runs the commands within that session; the creds vanish on expiry. **Never** hand Codex a long-lived IAM user access key. If you must scope it, create a temporary role with only the Phase-09 actions and `aws sts assume-role` into it.

> Either way, the **app's** runtime credentials are unaffected — those are always OIDC/STS, minted by Vercel, never the same as the provisioning creds.

### 4.2 Bedrock model access (do this early — it has wall-clock latency)

Bedrock foundation models are **off by default** per account/region. Titan Text Embeddings v2 must be explicitly enabled:

1. AWS Console → **Amazon Bedrock** → **Model access** (in **`us-east-1`**, the contract region).
2. **Manage model access** → enable **Amazon Titan Text Embeddings V2** → submit.
3. Approval is usually minutes but can lag — **do it the moment you start Phase 09 prep**, not when you need it.
4. **Verify the model ID and output dimension against current AWS docs.** The contract pins `BEDROCK_MODEL_ID=amazon.titan-embed-text-v2:0`. Titan v2 supports **256 / 512 / 1024** output dims — set `EMBED_DIM` to the dimension you request and migrate the `incidents.embedding` column with (Phase 09). **Local stays 384** (`@xenova/transformers`); cloud uses the Titan dim. `EMBED_DIM` is the single config constant that controls the `vector(EMBED_DIM)` column.

> Bedrock is only the **cloud** embedding provider. Codex never touches Bedrock during Phases 00–08; it uses the local provider, so the Bedrock model-access request can happen entirely in parallel with the build.

---

## 5. Environment variables — exactly where each one goes

Two environments, two `.env` realities. The **only** flag that differs between them is `DEPLOY_TARGET`.

### 5.1 Local `.env` (Phases 00–08 — committed as `.env.example`, real values in untracked `.env`)

```bash
DEPLOY_TARGET=local
DATABASE_URL=postgres://recall:recall@localhost:5432/recall   # local Docker Postgres
EMBED_PROVIDER=local
EMBED_DIM=384                                                 # @xenova/transformers all-MiniLM-L6-v2
DEMO_TLC=PRD-OUTBREAK-0001
# NO AWS anything. NO Vercel anything. This file never contains a cloud secret.
```

### 5.2 Vercel project env (production + preview — set with `vercel env add`, Phase 10)

```bash
DEPLOY_TARGET=aurora
EMBED_PROVIDER=bedrock
EMBED_DIM=1024                          # the VERIFIED Titan v2 dim you migrated with (256/512/1024)
DEMO_TLC=PRD-OUTBREAK-0001
AWS_REGION=us-east-1
AWS_ROLE_ARN=arn:aws:iam::<ACCOUNT_ID>:role/recall-vercel-runtime   # the role the app assumes
BEDROCK_MODEL_ID=amazon.titan-embed-text-v2:0
AURORA_HOST=recall-aurora.cluster-xxxx.us-east-1.rds.amazonaws.com
AURORA_PORT=5432
AURORA_DB=recall
AURORA_USER=recall_app                  # IAM-authenticated DB user (GRANT rds_iam)
# Secrets-Manager FALLBACK only (if not using RDS IAM token auth):
# AURORA_SECRET_ARN=arn:aws:secretsmanager:us-east-1:<ACCOUNT_ID>:secret:recall/db-xxxxxx
#
# ❌ NEVER set AWS_ACCESS_KEY_ID or AWS_SECRET_ACCESS_KEY here. OIDC mints credentials.
# Their ABSENCE is the proof OIDC is doing the work.
```

> Set each with `vercel env add <NAME> production` (and `preview`). Pull locally to test the cloud path with `vercel env pull` (this also mints a dev OIDC token so the keyless path works from your laptop without static keys). See [PHASE-10 §env](./PHASE-10-vercel-deploy.md).

### 5.3 Which env values are **secret**?

| Value | Secret? | Why |
|---|---|---|
| `DEPLOY_TARGET`, `EMBED_PROVIDER`, `EMBED_DIM`, `DEMO_TLC`, `AWS_REGION`, `BEDROCK_MODEL_ID` | No | Config, not credentials. Safe in `.env.example`. |
| `AURORA_HOST`, `AURORA_PORT`, `AURORA_DB`, `AURORA_USER` | No (sensitive, not secret) | Endpoint/identity; harmless without the ability to assume the role + reach the SG-locked endpoint. Keep server-side; don't ship in the client bundle. |
| `AWS_ROLE_ARN` | No | The ARN is not a credential; you can't assume it without the OIDC trust. Server-side only by habit. |
| `VERCEL_TEAM_ID`, `VERCEL_TEAM_SLUG` | No | Public-ish identifiers (Team ID is a submission field). |
| `AURORA_SECRET_ARN` (if used) | No (the ARN) | The ARN points at the secret; the **secret value** never leaves Secrets Manager + is read server-side via OIDC. |
| `AWS_SECRET_ACCESS_KEY` / `AWS_ACCESS_KEY_ID` | **N/A — must not exist** | OIDC keyless. If you ever see these, something is wrong. |
| `DATABASE_URL` (local) | Low | Local Docker creds (`recall:recall`); fine for local, never used in cloud. |
| `V0_API_KEY` (only if scripting v0 Platform API) | **Yes** | Human shell / Vercel server env only; never committed, never client-side, **not** needed by the deployed app. |

> **Rule:** anything that is a usable credential lives **server-side only** and is minted at runtime via OIDC where possible. The client bundle gets **nothing** AWS-related (no `NEXT_PUBLIC_AWS_*`, ever).

---

## 6. Credentials matrix

| Item | Who creates it | Where it lives | Secret? | Used by |
|---|---|---|---|---|
| **Vercel account / Team** | Human | vercel.com | No | Human (deploy), Codex (CLI session) |
| **Vercel CLI session** | Human (`vercel login`) | `~/.vercel` on the build machine | Yes (session token) | Codex + human for `vercel`/`deploy`/`env pull` |
| **Vercel Team ID** | Vercel (read it) | Note / submission form | No | Submission + OIDC scope reference |
| **Vercel Team Slug** | Vercel (read it) | Note / IAM trust policy | No | OIDC issuer `oidc.vercel.com/<slug>` |
| **v0 generation (UI shell)** | Human (v0 prompt) | Repo (`components/`, `app/`) as committed code | No | Codex (refines it) |
| **v0 spend limit + auto-recharge OFF** | Human | v0/Vercel billing settings | No | Cost guardrail |
| **`V0_API_KEY`** (optional, Platform API only) | Human (v0 settings) | Human shell / Vercel server env | **Yes** | Only if scripting v0 generation; NOT the app |
| **Local Docker Postgres creds** (`recall:recall`) | docker-compose / init.sql | `.env` local + `docker/` | Low | Codex local dev (Phases 00–08) |
| **Aurora cluster** | Human (Phase 09) | AWS `us-east-1` | endpoint = not secret | App at runtime (via OIDC role) |
| **Aurora master password** | Human (Phase 09) | Password manager / Secrets Manager | **Yes** | Human (psql admin); NOT the app's runtime path |
| **Aurora app DB user `recall_app`** | Human (Phase 09, `GRANT rds_iam`) | Aurora | identity, not secret | App via RDS IAM token (signed per connection) |
| **IAM OIDC provider** (`oidc.vercel.com/<slug>`) | Human (Phase 09) | AWS IAM | No | Trust anchor for the role |
| **IAM role `recall-vercel-runtime`** | Human (Phase 09) | AWS IAM | ARN = not secret | App assumes it via STS at runtime |
| **Runtime AWS credentials** | **AWS STS at request time** | In-memory in the Vercel function only | **Yes (short-lived)** | App (`awsCredentialsProvider`) — never stored, never committed |
| **Bedrock Titan v2 model access** | Human (Bedrock console) | AWS account/region grant | No | App's `lib/embeddings/bedrock.ts` via OIDC role |
| **`AURORA_SECRET_ARN`** (fallback only) | Human (Phase 09) | Vercel server env | ARN = not secret; value in Secrets Manager | App (read via OIDC `secretsmanager:GetSecretValue`) |

---

## 7. AWS cost & budget

- **$100 AWS budget is set and fine to use fully.** The dominant cost is **Aurora Serverless v2 ACU-hours**. With `MinCapacity=0` (scale-to-zero), an **idle** cluster costs ~$0 — it only bills ACUs while a query runs or during the seed/HNSW-build burst.
- **Bedrock Titan v2** is pay-per-token for embeddings; ~2,000 incident embeddings is pennies. Embeddings are **precomputed offline** (Phase 09 seed), not per-request.
- **No NAT Gateway, no RDS Proxy** by default (the contract) — both are recurring hourly costs you avoid; the publicly-accessible-but-SG-locked endpoint + Fluid pooling is enough at demo scale.
- **Vercel hosting is within credits** (one Fluid Compute project).
- **Set an AWS Budgets alert** at e.g. $50 and $90 (Console → Billing → Budgets) as a backstop to the $100 cap.
- **DELETE Aurora + snapshots after submission** — see the teardown in [PHASE-09](./PHASE-09-aws-aurora.md). Snapshots bill storage even after the cluster is gone; delete them too.

---

## 8. Do-this-now-in-order quickstart (human)

Run top to bottom. Items marked **‖parallel** can run while Codex builds the local spine.

1. [ ] Sign in to **Vercel** (pick the **Team** scope). Sign in to **v0.app** with the same account.
2. [ ] v0 + Vercel **Billing → set spend limit, turn OFF auto-recharge**.
3. [ ] Record **Team ID** + **Team Slug** (Settings → General). Write them into `BUILD_LOG.md` / `.env.example` comments.
4. [ ] `pnpm add -g vercel@latest` → `vercel login` → `vercel whoami` (confirm).
5. [ ] Run the **v0 prompt** ([§3.5](#35-generate-the-outbreak-console-shell-the-v0-prompt)); bring the generated shell into the repo ([§3.6](#36-bring-the-generated-code-into-the-repo-the-handoff)); commit on a branch.
6. [ ] **‖parallel** AWS Console → **Bedrock → Model access → enable Titan Text Embeddings V2** in `us-east-1`. Verify the model ID + pick `EMBED_DIM` (256/512/1024).
7. [ ] **‖parallel** Confirm AWS CLI v2 auth: `aws sts get-caller-identity`, region `us-east-1`. Decide [§4.1](#41-who-runs-the-phase-09-privileged-commands): human runs Phase 09, **or** grant Codex short-lived SSO creds.
8. [ ] When the **local spine is GREEN (Phase 08)**, proceed to [PHASE-09](./PHASE-09-aws-aurora.md) (cluster + IAM OIDC role), then [PHASE-10](./PHASE-10-vercel-deploy.md) (deploy + OIDC enable + env vars).
9. [ ] After submission: **delete Aurora + snapshots**; confirm AWS Budgets shows charges stopping.

> Steps 1–5 unblock the frontend handoff. Steps 6–7 unblock Phase 09. **Codex does not wait for any of them** to build Phases 00–08 (local-only).

---

## 9. Security do-not-do list

- ❌ **No long-lived AWS keys** (`AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY`) in the repo, in `.env`, in `.env.example`, or in Vercel project env. The app uses **OIDC keyless STS** only. Leaked/hardcoded keys are an **instant disqualifier**.
- ❌ **No AWS credentials in the client bundle.** No `NEXT_PUBLIC_AWS_*`. All SDK calls (`pg`, Bedrock) run **server-side only** (RSC / Server Action / Route Handler).
- ❌ **Don't commit secrets.** No master DB password, no Secrets Manager secret value, no `V0_API_KEY` in git. Add `.env` to `.gitignore`; only `.env.example` (placeholders) is committed.
- ❌ **Don't hand Codex a long-lived IAM user key** to run Phase 09. Use **short-lived SSO** (`aws sso login`) or run the privileged steps yourself ([§4.1](#41-who-runs-the-phase-09-privileged-commands)).
- ❌ **Don't widen the IAM role.** Least privilege: `rds-db:connect` to the one DB user (or `secretsmanager:GetSecretValue` on the one secret) + `bedrock:InvokeModel` on the one Titan model. No `*` resources.
- ❌ **Don't open the Aurora security group to `0.0.0.0/0`.** Publicly-accessible endpoint, but SG-locked to your seeding IP + Vercel egress ([PHASE-09](./PHASE-09-aws-aurora.md), [vercel-v0-playbook §11.5](../reference/vercel-v0-playbook.md#115-aurora-in-a-private-subnet)).
- ❌ **Don't pass localhost off as deployed.** The demo runs on the **live Vercel URL** over real Aurora data; the on-screen latency is a **real measurement**, never hardcoded.
- ✅ **Do prove keylessness:** grep the repo and the Vercel env for `AWS_SECRET_ACCESS_KEY` and confirm **zero hits** before recording.

---

## 10. Definition of Done

- [ ] Signed in to v0.app + Vercel; **spend limit set, auto-recharge OFF** on both.
  - Verify: Billing pages show a limit and auto-recharge disabled.
- [ ] **Team ID + Team Slug recorded.** Verify: `vercel teams ls` shows the slug; Settings → General shows `team_...` ID; both are in `BUILD_LOG.md`/notes.
- [ ] **Vercel CLI logged in.** Verify: `vercel whoami` prints your user (non-error exit).
- [ ] **Outbreak Console shell generated and committed** to the repo at the canonical `components/console/*` paths, with **typed props and no client data fetching**. Verify: `git log` shows the shell commit; `grep -r "useEffect.*fetch" components/console` returns nothing in the shell.
- [ ] **Bedrock Titan v2 model access enabled** in `us-east-1`; `EMBED_DIM` decided. Verify: Bedrock console → Model access shows "Access granted" for Titan Text Embeddings V2.
- [ ] **AWS access path decided** ([§4.1](#41-who-runs-the-phase-09-privileged-commands)): human runs Phase 09 **or** Codex gets short-lived SSO. Verify: `aws sts get-caller-identity` succeeds in the chosen shell.
- [ ] **No secrets committed.** Verify: `git grep -i "AWS_SECRET_ACCESS_KEY"` → no real value; `.env` is gitignored.
- [ ] **Local dev confirmed to need zero AWS.** Verify: Phases 00–08 run with `DEPLOY_TARGET=local` and no AWS env present.

---

## 11. Common pitfalls & fixes

| Pitfall | Symptom | Fix |
|---|---|---|
| Auto-recharge left ON | Surprise card charge after credits run out | Turn OFF auto-recharge in v0 + Vercel billing; set a hard spend cap ([§3.2](#32-set-the-v0-spend-limit-and-turn-off-auto-recharge)) |
| Personal/Hobby scope, no Team ID | Can't fill the required Team ID submission field; OIDC Team issuer unavailable | Create/switch to a **Team** before recording Team ID ([§3.1](#31-sign-in-to-vercel-and-v0)) |
| v0 generated client `useEffect` fetching | Loading flash; can't hold AWS creds; Codex has to rip it out | The prompt says **"do NOT add data fetching — leave data as typed props"**; if v0 ignored it, re-prompt or delete the fetch and add the prop ([§3.5](#35-generate-the-outbreak-console-shell-the-v0-prompt)) |
| Thinking Codex needs a v0 API key | Blocked waiting on a key that isn't needed | Codex consumes committed **code**; the key is only for the Platform API, which the spine doesn't use ([§3.6](#36-bring-the-generated-code-into-the-repo-the-handoff)) |
| Bedrock model access requested late | Cloud embeddings 403 at the worst moment | Request Titan v2 access at the **start** of Phase 09 prep ([§4.2](#42-bedrock-model-access-do-this-early--it-has-wall-clock-latency)) |
| `EMBED_DIM` mismatch (local 384 vs Titan) | Vector column dim error when swapping to cloud | `EMBED_DIM` is one config constant; local=384, cloud=verified Titan dim; column migrated to match ([§5.2](#52-vercel-project-env-production--preview--set-with-vercel-env-add-phase-10)) |
| Long-lived key as the "quick fix" | Security-aware judge notices; instant DQ | OIDC keyless only; if STS isn't wired yet, fix the wiring, don't paste a key ([§9](#9-security-do-not-do-list)) |
| Forgetting to delete Aurora snapshots | Storage bills after cluster deleted | Delete snapshots **and** cluster in the Phase 09 teardown; confirm in AWS Budgets ([§7](#7-aws-cost--budget)) |
| Vercel function region ≠ Aurora region | 100–300 ms cross-region latency tax | Pin `regions: ["iad1"]` (= `us-east-1`) in `vercel.json` ([PHASE-10](./PHASE-10-vercel-deploy.md)) |

---

## 12. Related docs

- [./PHASE-09-aws-aurora.md](./PHASE-09-aws-aurora.md) — the privileged AWS provisioning runbook (Aurora cluster, IAM OIDC provider + role, Bedrock swap, seed, proof screenshots, teardown).
- [./PHASE-10-vercel-deploy.md](./PHASE-10-vercel-deploy.md) — link the repo, enable OIDC, set project env vars, deploy the live URL, capture the Team ID.
- [../reference/vercel-v0-playbook.md](../reference/vercel-v0-playbook.md) — v0 prompting recipe, OIDC keyless pattern, Fluid Compute pooling, region rule, pitfalls.
- [./CONVENTIONS.md](./CONVENTIONS.md) — the single-source-of-truth contract (env var names, repo layout, tech stack).
- [./README.md](./README.md) — phase index & navigation.
- [../deep-dives/01-recall.md](../deep-dives/01-recall.md) — the product + architecture spec (v0 prompt origin, AWS provisioning, OIDC, seeding).
- [../reference/aws-databases.md](../reference/aws-databases.md) — why Aurora PostgreSQL, screenshot-proof catalog, connection-limit guidance.
