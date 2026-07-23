#!/bin/bash
set -e
sed -i 's/"noEventsEyebrow": "Clear agenda",/"noEventsEyebrow": "Wrong",/g' locales/en.json
npx vitest run tests/ui/dashboard-home-experience.test.tsx || echo "Proof 6 failed successfully."
sed -i 's/"noEventsEyebrow": "Wrong",/"noEventsEyebrow": "Clear agenda",/g' locales/en.json
