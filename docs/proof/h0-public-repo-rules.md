# H0 Public Repository Rules Check

Date checked: 2026-06-24

Source:

- Official Devpost rules: https://h01.devpost.com/rules
- H0 overview / requirements: https://h01.devpost.com/
- H0 resources / FAQ: https://h01.devpost.com/resources

Conclusion: public repository visibility is allowed, and the official FAQ currently says the
repository must be public for submission review.

Relevant findings:

- The "What to submit" section requires a text description, a less-than-three-minute demo
  video, a published Vercel project link, and the Vercel Team ID. It does not say the code
  repository must remain private.
- The official rules' intellectual-property section says submissions remain the entrant's
  intellectual property, with a non-exclusive judging/promotional license to the sponsor and
  Devpost.
- The rules explicitly allow open source software as part of a submission when licenses are
  respected.
- The optional build-in-public content bonus must be public, which is consistent with public
  artifacts being allowed.
- The H0 resources FAQ says to keep AWS credentials out of the repository and use environment
  variables/OIDC because the repository must be public for review.

Operational decision: making `github.com/eklavyagoyal/recall-h0` public appears allowed by
the official rules. Flipping repository visibility is still an account-level action and should
be confirmed by the owner before running `gh repo edit eklavyagoyal/recall-h0 --visibility public`.
