#!/bin/bash
set -e

# Proof 4: passar eventStart como string e confirmar falha do lint ou teste
sed -i "s/const eventStart = new Date(\`\${eventSummary.date}T\${eventSummary.time || '00:00'}:00\`);/const eventStart = \`\${eventSummary.date}T\${eventSummary.time || '00:00'}:00\` as any;/g" pages/DashboardPage.tsx
npx vitest run tests/ui/dashboard-home-experience.test.tsx || echo "Proof 4 failed successfully."
sed -i "s/const eventStart = \`\${eventSummary.date}T\${eventSummary.time || '00:00'}:00\` as any;/const eventStart = new Date(\`\${eventSummary.date}T\${eventSummary.time || '00:00'}:00\`);/g" pages/DashboardPage.tsx

# Proof 5: voltar a usar experience.upcomingEvents e confirmar falha do lint
sed -i 's/events={upcomingEvents}/events={(experience as any).upcomingEvents}/g' pages/DashboardPage.tsx
npm run lint || echo "Proof 5 failed successfully."
sed -i 's/events={(experience as any).upcomingEvents}/events={upcomingEvents}/g' pages/DashboardPage.tsx

# Proof 6: alterar uma chave EN e confirmar falha da igualdade estrutural
sed -i 's/"noEventsEyebrow": "Clear agenda"/"noEventsEyebrow": "Wrong"/g' locales/en.json
npx vitest run tests/ui/dashboard-home-experience.test.tsx || echo "Proof 6 failed successfully."
sed -i 's/"noEventsEyebrow": "Wrong"/"noEventsEyebrow": "Clear agenda"/g' locales/en.json

echo "Proofs 4, 5, 6 executed and restored."
