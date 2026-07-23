#!/bin/bash
set -e

echo "=== npm run lint ==="
npm run lint

echo "=== unit tests ==="
npx vitest run tests/unit/home-experience.test.ts
npx vitest run tests/ui/use-home-experience.test.tsx
npx vitest run tests/ui/dashboard-home-experience.test.tsx

echo "=== starter pack ==="
npm run test:starter-pack-ui

echo "=== ui tests ==="
npm run test:ui

echo "=== scale-review ==="
npm run test:release:scale-review

echo "=== release core ==="
npm run test:release:core

echo "=== build ==="
npm run build

echo "=== test:release ==="
npm run test:release

echo "ALL GATES PASSED!"
