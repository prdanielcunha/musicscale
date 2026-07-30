const fs = require('fs');
const file = 'tests/ui/music-scale-dashboard-release.test.tsx';
let content = fs.readFileSync(file, 'utf8');

const injection = `
const mockUseSuggestionsContext = vi.fn();
vi.mock('../../contexts/SuggestionContext', () => ({ useSuggestionsContext: () => mockUseSuggestionsContext() }));

vi.mock('../../hooks/useFirstValueJourney', () => ({
  useFirstValueJourney: () => ({
    isLoading: false,
    isEligible: false,
    isCompleted: false,
    currentEssentialStep: null
  })
}));
`;

content = content.replace(
`const mockUseSuggestionsContext = vi.fn();
vi.mock('../../contexts/SuggestionContext', () => ({ useSuggestionsContext: () => mockUseSuggestionsContext() }));`,
injection
);

fs.writeFileSync(file, content);
