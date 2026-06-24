# Required Artifact Shot List

## architecture.png

Generated artifact: `docs/submission/architecture.png`.

Export the diagram from `docs/submission/architecture.md` as a PNG. The diagram should show:

- Browser / Outbreak Console.
- Vercel Fluid Compute in `iad1`.
- Vercel OIDC to AWS STS / IAM role.
- Aurora PostgreSQL Serverless v2 in `us-east-1`.
- Bedrock Titan embeddings.
- TLS-verified `pg` pool with `attachDatabasePool`.

## db-proof.png

Prepared local proof still: `docs/submission/db-proof-explain.png`.

Create one composite PNG with these three visible proofs:

1. AWS RDS console for cluster `recall-aurora`, engine PostgreSQL 16.6, region `us-east-1`.
2. Live Query Inspector / `EXPLAIN (ANALYZE, BUFFERS)` showing Recursive Union, GiST Spatial Path, and HNSW Index Scan. Use the prepared `docs/submission/db-proof-explain.png` still if the composite needs a clean, legible plan crop.
3. CloudWatch `ServerlessDatabaseCapacity` graph showing 0.0 ACU idle and 2.0 ACU under load.

Recording order:

1. Open `https://recall-h0.vercel.app` in incognito.
2. Run trace `PRD-OUTBREAK-0001` once to warm Aurora.
3. Open Query Inspector and capture the plan nodes.
4. Open AWS RDS from the owner's authenticated AWS console session and capture it as `docs/submission/db-proof-rds.png`.
5. Open CloudWatch `ServerlessDatabaseCapacity` and capture it as `docs/submission/db-proof-acu.png`.
6. Run `pnpm submission:compose-db-proof` to composite those two owner screenshots with `docs/submission/db-proof-explain.png` into `docs/submission/db-proof.png`.

Capture the RDS and CloudWatch sources as full-resolution PNGs, at least `1200x700` each. The
composer rejects tiny, corrupt, or non-PNG screenshots before producing the final `1920x1080`
proof image.

Do not paste or reveal secrets, connection strings, passwords, or environment variable values in the screenshots.
