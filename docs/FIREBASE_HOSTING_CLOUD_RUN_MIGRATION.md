# Firebase Hosting + Cloud Run migration

This repository is being migrated from Vercel-first web delivery to **Firebase Hosting + Cloud Run**, while Vercel remains available temporarily as a manual rollback path.

## Canonical target

- Firebase project: `millionsnest`
- Hosting target: `musicscale`
- Hosting site: `mn-musicscale-555464791734`
- Cloud Run API service: `musicscale-api`
- Cloud Run region: `us-central1`
- Public production domain after cutover: `musicscale.millionsnest.com`

## Routing contract

Firebase Hosting serves the PWA/static bundle from `dist/`.
Requests under `/api/**` are routed to the pinned revision of `musicscale-api`.
All remaining application routes fall back to `/index.html`.

## Safety rules

1. Vercel is not removed until Firebase production smoke tests pass.
2. Stripe/billing authority remains in MillionsNest Hub.
3. No Firebase Admin, Stripe, Gemini, or FinOps secret may be committed or baked into the container.
4. Cloud Run must use runtime identity/Secret Manager for private configuration.
5. Production diagnostics fail closed even when Vercel-specific environment variables are absent.
6. Firestore Rules, tenant isolation, RBAC, memberships, invitations and entitlements are outside this infrastructure migration scope.
7. Domain cutover occurs only after the Firebase-provided URL and Cloud Run API are certified.

## Validation

Run the normal MusicScale QA plus:

```bash
npx tsx scripts/test_firebase_hosting_cloudrun_policy.ts
```

The GitHub workflow `firebase-web-infra-preflight.yml` also performs a read-only attempt using the existing Google Workload Identity Federation. It never reads secret values and never mutates cloud resources.
