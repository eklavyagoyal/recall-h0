# Owner Final Steps

Run these after the demo recording and AWS console captures are available. Do not create
placeholder files; `pnpm submission:check` intentionally fails until the real artifacts are staged.

## 1. Make the Repository Public

Confirm the account-level visibility change, then run:

```bash
pnpm submission:print-public-repo-command
gh repo edit eklavyagoyal/recall-h0 --description 'Recall traces a foodborne outbreak to every affected shelf with one serializable Aurora PostgreSQL query.' --homepage 'https://recall-h0.vercel.app' --visibility public
```

The readiness check verifies the public GitHub API can see the repo, homepage, description,
`README.md`, `LICENSE`, `package.json`, `vercel.json`, and the current `/api/health` plus
`/api/ready` route sources on the public default branch.

## 2. Deploy the Current Source

Ensure the production Vercel deployment includes this source before final gates. A
2026-06-24 production deploy attempt failed before build because the current Vercel Hobby plan
does not allow the `*/4 * * * *` judging warm cron. Upgrade the Vercel team/project to a plan that
supports sub-daily Cron Jobs, or consciously remove the cron and accept the weaker cold-start
fallback before deploying.

`pnpm submission:preflight:prod` checks the local Vercel project link, `vercel.json`, the Vercel
CLI version, and `vercel whoami`. It does not deploy and cannot verify Vercel plan entitlement, so
confirm the plan supports sub-daily Cron Jobs before the deploy command.

After the plan supports the cron, if using the Git integration, commit and push this work, then
wait for the production deployment to finish. If using the Vercel CLI, run the preflight and
production deploy from this workspace:

```bash
pnpm submission:preflight:prod
pnpm submission:deploy:prod
```

`pnpm submission:check` verifies the production deployment exposes `/api/health`, `/api/ready`,
the live trace numbers, and the live EXPLAIN nodes.

## 3. Record and Stage the Demo

Record from `https://recall-h0.vercel.app`, never localhost. Use
`docs/submission/demo-script.md` as the shot list and keep the exported file under three minutes
at 1920x1080 or higher.

```bash
ffprobe -v error -show_entries format=duration -of csv=p=0 docs/submission/demo.mp4
ffprobe -v error -select_streams v:0 -show_entries stream=width,height -of csv=s=x:p=0 docs/submission/demo.mp4
```

Expected: a duration below `180` and dimensions of at least `1920x1080`.

Upload the video as an unlisted/publicly reachable URL, then stage the link. This must be the
hosted demo video URL, not the live app or repository URL:

```bash
printf '%s\n' '<unlisted demo video URL>' > docs/submission/demo-link.txt
```

Paste the same URL into `docs/submission/submission.md`.

## 4. Capture and Compose AWS DB Proof

Capture these from the authenticated AWS console as full-resolution PNGs:

- `docs/submission/db-proof-rds.png`: RDS cluster `recall-aurora`, PostgreSQL 16.6, `us-east-1`.
- `docs/submission/db-proof-acu.png`: CloudWatch `ServerlessDatabaseCapacity` showing `0.0` ACU idle and `2.0` ACU under load.

Do not reveal secrets, passwords, connection strings, or environment variable values.

Then run:

```bash
pnpm submission:compose-db-proof
```

Expected output: `docs/submission/db-proof.png`, `1920x1080`.

## 5. Finalize the Writeup

In `docs/submission/submission.md`:

- Remove the `visibility flip pending owner confirmation` note from the GitHub row.
- Add the hosted demo video URL.
- Keep the verified live numbers unchanged: `1,400` stores, `674,285` units, `81` lots, `80` edges.

## 6. Final Gates

```bash
pnpm submission:check
pnpm verify
pnpm build
BASE_URL=https://recall-h0.vercel.app pnpm test:smoke
```

All four must pass before copying fields into Devpost.

Do not run `pnpm db:migrate`, `pnpm db:seed`, or secret-fetch commands as part of final submission.
