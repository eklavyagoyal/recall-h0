# Devpost Field Copy

Use this file when copying fields into Devpost. Do not paste owner-filled fields until
`pnpm submission:check` passes; the checker is the source of truth for whether final links and
artifacts are real.

## Fixed Fields

| Devpost field | Value to paste |
|---|---|
| Project name | Recall |
| Tagline | One serializable Aurora PostgreSQL query traces a foodborne outbreak to every affected shelf. |
| AWS database | Amazon Aurora PostgreSQL |
| Published Vercel project link | https://recall-h0.vercel.app |
| Vercel Team ID | team_vr98mdXQJyxKN5yAtBuO48T8 |
| Repository URL | https://github.com/eklavyagoyal/recall-h0 |
| Track | Monetizable B2B |

## Long Description

Copy the full contents of `docs/submission/submission.md` after these final edits are complete:

1. Remove the `visibility flip pending owner confirmation` note from the GitHub row.
2. Add the hosted demo video URL from `docs/submission/demo-link.txt`; it must not be the live app or repository URL.
3. Keep the verified live numbers unchanged: `1,400` stores, `674,285` units, `81` lots, `80` edges.

The long description must still name **Amazon Aurora PostgreSQL** and the one-query reason:
recursive CTE + PostGIS GiST + pgvector HNSW + FK-enforced DAG integrity in one serializable
transaction.

## Links

| Devpost link field | Source |
|---|---|
| Live app | `docs/submission/live-url.txt` |
| Code repository | Make `https://github.com/eklavyagoyal/recall-h0` public first, then paste that URL. |
| Demo video | Upload `docs/submission/demo.mp4`, write the reachable HTTPS URL to `docs/submission/demo-link.txt`, then paste that same URL. It must not be the live app or repository URL. |

## Upload Artifacts

| Devpost artifact | Source file |
|---|---|
| Architecture diagram | `docs/submission/architecture.png` |
| AWS database usage proof | `docs/submission/db-proof.png` |
| Gallery screenshot | `docs/submission/hero-console.png` |
| Optional opening title card | `docs/submission/demo-opening-card.png` |
| Optional end title card | `docs/submission/demo-end-card.png` |

## Final Copy Gate

Run this exact sequence before copying fields into Devpost:

```bash
pnpm submission:check
pnpm verify
pnpm build
BASE_URL=https://recall-h0.vercel.app pnpm test:smoke
```

All four commands must pass. Do not run `pnpm db:migrate`, `pnpm db:seed`, or secret-fetch
commands as part of final submission.
