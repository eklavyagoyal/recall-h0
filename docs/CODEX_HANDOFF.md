# Codex Handoff Pointer

The original build prompt is tracked at [`../CODEX_HANDOFF.md`](../CODEX_HANDOFF.md).

For current execution status, use [`CODEX_HANDOFF_WIN.md`](CODEX_HANDOFF_WIN.md) together with the readiness contract:

```bash
pnpm submission:check
```

As of the latest local audit, the implementation is mostly complete locally. The remaining blockers are owner-owned submission and deployment steps:

1. Confirm repo visibility, then run the command printed by:
   ```bash
   pnpm submission:print-public-repo-command
   ```
2. Upgrade the Vercel team/project to a plan that supports the `*/4 * * * *` judging warm cron, then run:
   ```bash
   pnpm submission:preflight:prod
   pnpm submission:deploy:prod
   ```
3. Record/export `docs/submission/demo.mp4`, upload it, write the hosted HTTPS demo URL to `docs/submission/demo-link.txt`, and paste that same URL into `docs/submission/submission.md`.
4. Capture `docs/submission/db-proof-rds.png` and `docs/submission/db-proof-acu.png` from the owner AWS console, then run:
   ```bash
   pnpm submission:compose-db-proof
   ```
5. Remove the `visibility flip pending owner confirmation` note from `docs/submission/submission.md` only after the repo is public.

Do not run `pnpm db:migrate`, `pnpm db:seed`, secret-fetch commands, or `gh repo edit --visibility public` without owner confirmation.
