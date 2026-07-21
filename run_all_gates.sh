set -e
npx tsx scripts/test_ms_scale_review_02.ts
npm run test:release:scale-review
npx vitest run tests/unit/global-song-update-controller.test.ts
npx vitest run tests/ui/scale-local-settings-cleanup.test.tsx
npx vitest run tests/ui/scale-review-song-order.test.tsx
npx vitest run tests/ui/scale-song-settings.test.tsx
npm run test:starter-pack-ui
npm run test:ui
npm run test:functions
npm run test:song-discovery
npm run test:curation-approval
npm run test:release:core
npm run lint
npm run build
npm run test:release
