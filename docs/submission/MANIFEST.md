# Devpost Submission Manifest

Run `pnpm submission:check` before copying fields into Devpost. The check passes only when
all required human-owned assets have been staged.

| Devpost field / artifact | Source file | Status |
|---|---|---|
| Published Vercel project link | `docs/submission/live-url.txt` | Ready; rechecked live by `pnpm submission:check` |
| Live demo trace numbers | `PRD-OUTBREAK-0001` via `/api/trace` | Ready; rechecked live by `pnpm submission:check` |
| Live EXPLAIN proof nodes | `PRD-OUTBREAK-0001` via `/api/explain` | Ready; rechecked live by `pnpm submission:check` |
| Vercel Team ID | `docs/submission/team-id.txt` | Ready |
| Judging warm cron | `vercel.json`, `app/api/ready/route.ts`, `docs/ops/judging-warm-cron.md` | Ready; rechecked by `pnpm submission:check` |
| H0 rules proof | `docs/proof/h0-public-repo-rules.md`, `docs/proof/h0-v0-requirement.md` | Ready; rechecked by `pnpm submission:check` |
| Public GitHub repository | `https://github.com/eklavyagoyal/recall-h0` | Pending owner visibility confirmation |
| Public README, LICENSE, and source sync | `README.md`, `LICENSE`, `package.json`, `vercel.json`, `app/api/health/route.ts`, `app/api/ready/route.ts` | Ready locally; rechecked via GitHub default branch after visibility flip |
| Production deployment source sync | `https://recall-h0.vercel.app/api/health`, `/api/ready` | Pending Vercel plan support for `*/4` warm cron and current-source deploy; rechecked live by `pnpm submission:check` |
| Written description | `docs/submission/submission.md` | Pending final demo URL paste and removal of owner-pending note |
| Architecture diagram | `docs/submission/architecture.png` | Ready; PNG dimensions rechecked |
| Live EXPLAIN proof still | `docs/submission/db-proof-explain.png` | Ready |
| RDS console source still | `docs/submission/db-proof-rds.png` | Pending owner AWS console capture |
| CloudWatch ACU source still | `docs/submission/db-proof-acu.png` | Pending owner AWS console capture |
| AWS DB usage proof screenshot | `docs/submission/db-proof.png` | Pending `pnpm submission:compose-db-proof` after owner captures; final PNG must be 1920x1080 |
| Demo video file | `docs/submission/demo.mp4` | Pending owner recording/export; must be <3:00 and at least 1920x1080 by `ffprobe` |
| Hosted demo video URL | `docs/submission/demo-link.txt` | Pending owner recording/upload; must be the hosted demo video URL, not the live app or repository URL; reachability rechecked by `pnpm submission:check` |
| Gallery screenshot | `docs/submission/hero-console.png` | Ready; 1920x1080 |
| Demo opening card | `docs/submission/demo-opening-card.png` | Ready; 1920x1080 |
| Demo end card | `docs/submission/demo-end-card.png` | Ready; 1920x1080 |
| Demo recording checklist | `docs/submission/demo-script.md` | Ready |
| AWS artifact shot list | `docs/submission/artifact-shot-list.md` | Ready |
| Completion audit | `docs/submission/COMPLETION_AUDIT.md` | Ready; current blocker map |
| Devpost field copy | `docs/submission/DEVPOST_FIELDS.md` | Ready; paste only after final gates pass |
| Codex execution handoff | `docs/CODEX_HANDOFF_WIN.md` | Ready; current execution status at top |
| Owner final handoff | `docs/submission/OWNER_FINAL_STEPS.md` | Ready |

Human-owned final commands/actions:

```bash
pnpm submission:print-public-repo-command
gh repo edit eklavyagoyal/recall-h0 --description 'Recall traces a foodborne outbreak to every affected shelf with one serializable Aurora PostgreSQL query.' --homepage 'https://recall-h0.vercel.app' --visibility public
pnpm submission:preflight:prod
pnpm submission:deploy:prod
ffprobe -v error -show_entries format=duration -of csv=p=0 docs/submission/demo.mp4
ffprobe -v error -select_streams v:0 -show_entries stream=width,height -of csv=s=x:p=0 docs/submission/demo.mp4
pnpm submission:compose-db-proof
printf '%s\n' '<unlisted demo video URL>' > docs/submission/demo-link.txt
# Paste that same hosted URL into docs/submission/submission.md and remove the repo visibility pending note.
pnpm submission:check
```

Do not create placeholder `demo-link.txt`, `demo.mp4`, or `db-proof.png`; the readiness check
intentionally fails until the repo is public, the real <3:00 exported demo exists, the real hosted
video URL exists, the demo URL is not the live app or repository URL, the real AWS proof composite exists, and production includes this source. The
`*/4 * * * *` Vercel warm cron requires a plan that supports sub-daily Cron Jobs; the 2026-06-24
production deploy attempt failed on Hobby before build. `pnpm submission:preflight:prod` verifies
Vercel CLI auth, the local project link, and cron config, but it does not deploy or prove plan
entitlement. The live EXPLAIN still is already staged as `db-proof-explain.png`. After the owner captures `db-proof-rds.png` and `db-proof-acu.png`, run
`pnpm submission:compose-db-proof` to generate the final `db-proof.png` composite.
