# reviewer-high-attestor

Only HIGH decisions with equal target and authorized 40-character SHAs are accepted. The workflow path and ref are fixed to the production controlled writer. The target must be current production or the live head SHA of an open PR.

The workflow runs only from production source, rejects an existing reviewer-high context, then posts exactly one legacy success status using context reviewer-high and description reviewer-high: APPROVED; attestation=target-url. Its URL carries the musicscale.reviewer-high.v1 contract consumed by scripts/verify-reviewer-high-attestation.mjs.

Workflow and job permissions are only contents read and statuses write. It has no environment, id-token, WIF, Firebase, backfill dispatch, branch/PR mutation, or infrastructure access. Actions are SHA-pinned.
