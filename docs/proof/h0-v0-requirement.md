# H0 v0 Requirement Check

Date checked: 2026-06-24

Source:

- H0 resources / FAQ: https://h01.devpost.com/resources
- H0 overview / submission requirements: https://h01.devpost.com/

Conclusion: v0 is officially encouraged and useful, but not mandatory for eligibility.

Relevant findings:

- The FAQ says projects must deploy on Vercel; v0 is one allowed path and is "recommended
  for speed, not required."
- The overview's required submission fields ask for a published Vercel project link and
  Vercel Team ID, plus the AWS database used and an architecture diagram.
- Recall satisfies the deployment requirement with `https://recall-h0.vercel.app` and uses a
  hand-built Next.js 16 App Router frontend on Vercel Fluid Compute.

Operational decision: do not burn time forcing a v0 export/import step. Keep the Devpost copy
focused on the official requirement: a working Vercel frontend and a load-bearing AWS database.
