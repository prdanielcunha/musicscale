# Contributing to MusicScale

Thank you for your interest in improving MusicScale.

## Public source does not mean open source

This repository is publicly viewable but remains proprietary and is governed by the root `LICENSE`. Public visibility, issues, pull requests, and forks do not grant permission to commercialize, redistribute, host, sublicense, or create a competing product from the Software.

## Before contributing

Read and follow:

1. `AGENTS.md`
2. `README.md`
3. `docs/ARCHITECTURE_CURRENT.md`
4. `docs/AI_CHANGE_PROTOCOL.md`
5. `SECURITY.md` for security-sensitive findings.

Security vulnerabilities must be reported privately, not through a public issue or pull request.

## Engineering rules

Contributions must:

- keep scope minimal and avoid unrelated refactors;
- preserve multi-tenant isolation and `organizationId` boundaries;
- preserve server-side authorization, RBAC, memberships, owner semantics, and Firestore Rules;
- preserve the MillionsNest boundary for identity, billing, and canonical entitlements;
- keep secrets and AI credentials server-side;
- preserve PT/EN/ES internationalization for user-facing strings;
- remain mobile-first and compatible with the PWA/offline architecture;
- include or update relevant tests;
- avoid production data, credentials, tokens, private URLs, and personal information;
- never weaken tests, security gates, or authorization simply to make a change pass.

Before submitting a pull request, run the relevant targeted tests plus, when applicable:

```bash
npm run lint
npm run build
git diff --check
```

Use the repository's existing scripts rather than inventing new release gates.

## Contribution license

By intentionally submitting a contribution to the official MusicScale repository, you represent that you have the right to submit that contribution and you grant the copyright holder a perpetual, worldwide, irrevocable, non-exclusive, royalty-free right to use, reproduce, modify, create derivative works from, distribute, sublicense, publicly perform, publicly display, and commercially exploit your contribution as part of MusicScale, MillionsNest, or related products and services.

This contribution grant does **not** relicense the existing MusicScale code to you or to the public. The repository's proprietary `LICENSE` continues to govern the Software.

If you cannot grant these rights, do not submit the contribution.

## Pull request scope

A pull request should solve one coherent problem. Clearly state:

- what changed;
- why it changed;
- files affected;
- tests actually executed and their results;
- security or tenant impact;
- any manual deployment or production action that remains pending.

A pull request never constitutes authorization to deploy to production, run a production backfill, alter production data, rotate credentials, or modify external infrastructure unless that action is separately and explicitly approved.
