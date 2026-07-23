#!/bin/bash
set -e

# Proof 1: trocar eventAssignments por assignments no adaptador de MusicScale
sed -i 's/scale.eventAssignments/scale.assignments/g' utils/homeExperience.ts
npx vitest run tests/unit/home-experience.test.ts || echo "Proof 1 failed successfully."
sed -i 's/scale.assignments/scale.eventAssignments/g' utils/homeExperience.ts

# Proof 2: trocar user.uid por userId no adaptador de BandScale
sed -i 's/assignment.user.uid/assignment.userId/g' utils/homeExperience.ts
npx vitest run tests/unit/home-experience.test.ts || echo "Proof 2 failed successfully."
sed -i 's/assignment.userId/assignment.user.uid/g' utils/homeExperience.ts

# Proof 3: voltar a usar new Date("YYYY-MM-DD") no filtro
sed -i 's/event.date >= todayKey/new Date(event.date) >= new Date(todayKey)/g' utils/homeExperience.ts
npx vitest run tests/unit/home-experience.test.ts || echo "Proof 3 failed successfully."
sed -i 's/new Date(event.date) >= new Date(todayKey)/event.date >= todayKey/g' utils/homeExperience.ts

# Proof 4: passar eventStart como string
sed -i "s/eventStart: new Date(\`\${nextAssignedEvent.date}T\${nextAssignedEvent.time || '00:00'}:00\`)/eventStart: \`\${nextAssignedEvent.date}T\${nextAssignedEvent.time || '00:00'}:00\`/g" components/dashboard/HomeFocusCard.tsx
npm run lint || echo "Proof 4 failed successfully."
sed -i "s/eventStart: \`\${nextAssignedEvent.date}T\${nextAssignedEvent.time || '00:00'}:00\`/eventStart: new Date(\`\${nextAssignedEvent.date}T\${nextAssignedEvent.time || '00:00'}:00\`)/g" components/dashboard/HomeFocusCard.tsx

# Proof 5: voltar a usar experience.upcomingEvents
sed -i 's/events={upcomingEvents}/events={(experience as any).upcomingEvents}/g' pages/DashboardPage.tsx
npm run lint || echo "Proof 5 failed successfully."
sed -i 's/events={(experience as any).upcomingEvents}/events={upcomingEvents}/g' pages/DashboardPage.tsx

# Proof 6: alterar uma chave EN e confirmar falha da igualdade estrutural
sed -i 's/"noOrgTitle": "Welcome to MusicScale",/"noOrgTitleWRONG": "Welcome to MusicScale",/g' locales/en.json
npx vitest run tests/ui/dashboard-home-experience.test.tsx || echo "Proof 6 failed successfully."
sed -i 's/"noOrgTitleWRONG": "Welcome to MusicScale",/"noOrgTitle": "Welcome to MusicScale",/g' locales/en.json

echo "All proofs executed and restored."
