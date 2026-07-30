const fs = require('fs');
const file = 'tests/ui/music-scale-dashboard-release.test.tsx';
let content = fs.readFileSync(file, 'utf8');

const injection = `
vi.mock('../../hooks/useFirstScaleExperience', () => ({
  useFirstScaleExperience: () => ({
    isLoading: false,
    isEligible: false,
    isCompleted: false,
    currentEssentialStep: null
  })
}));
`;

content = content.replace(
`vi.mock('../../hooks/useFirstValueJourney', () => ({
  useFirstValueJourney: () => ({
    isLoading: false,
    isEligible: false,
    isCompleted: false,
    currentEssentialStep: null
  })
}));`,
injection
);

fs.writeFileSync(file, content);
