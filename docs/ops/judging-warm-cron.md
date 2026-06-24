# Judging Warm Cron

`vercel.json` defines a Vercel Cron that calls `/api/ready` every four minutes:

```json
{
  "path": "/api/ready",
  "schedule": "*/4 * * * *"
}
```

The endpoint performs a bounded `SELECT 1` against Aurora PostgreSQL. During the judging
window this keeps the Serverless v2 cluster from being paused when a judge first opens
`https://recall-h0.vercel.app`.

## Plan prerequisite

A production deploy attempted on 2026-06-24 failed before build with Vercel's Hobby-plan
limit:

```text
Hobby accounts are limited to daily cron jobs. This cron expression (*/4 * * * *) would run more than once per day.
```

Keep the `*/4 * * * *` cron for the judging-window warm strategy, but upgrade the Vercel
team/project to a plan that supports sub-daily Cron Jobs before the production deploy. If the
owner chooses not to upgrade, remove the `crons` entry before deploy and accept that Aurora can
scale from zero on a judge's first request; that is a lower-reliability fallback, not the target
winner path.

Rollback is intentionally simple and reversible: remove the `crons` entry from
`vercel.json` and redeploy. No database migration, seed, or AWS secret change is required.

Semantics:

- `/api/health` is liveness only: returns `200` when the process is up and does not touch DB.
- `/api/ready` is readiness: returns `200` when DB answers, `503` with `{ "db": "down" }`
  when the critical DB dependency is unavailable.
