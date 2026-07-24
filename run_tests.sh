#!/bin/bash
set -e
echo "Starting test sequence..."

echo "1. npm run lint"
npm run lint

echo "2. unit/team-setup.test.ts"
npx vitest run tests/unit/team-setup.test.ts

echo "3. ui/team-setup-progress-card.test.tsx"
npx vitest run tests/ui/team-setup-progress-card.test.tsx

echo "4. ui/users-team-setup-progress-integration.test.tsx"
npx vitest run tests/ui/users-team-setup-progress-integration.test.tsx

echo "5. unit/home-experience.test.ts"
npx vitest run tests/unit/home-experience.test.ts

echo "6. ui/dashboard-home-experience.test.tsx"
npx vitest run tests/ui/dashboard-home-experience.test.tsx

echo "7. npm run test:starter-pack-ui"
npm run test:starter-pack-ui

echo "8. npm run build"
npm run build

echo "9. npm run test:release"
npm run test:release

echo "ALL TESTS COMPLETED SUCCESSFULLY"
