import { runTests as runTitleTests } from './utils/songDiscovery/tests/titleNormalization.test.js';
import { runTests as runArtistTests } from './utils/songDiscovery/tests/artistNormalization.test.js';
import { runTests as runLyricsTests } from './utils/songDiscovery/tests/lyricsNormalization.test.js';
import { runTests as runIdentityTests } from './utils/songDiscovery/tests/identityGenerator.test.js';
import { runTests as runMatcherTests } from './utils/songDiscovery/tests/matcher.test.js';
import { runTests as runSnapshotTests } from './utils/songDiscovery/tests/snapshotSanitizer.test.js';
import { runTests as runCurationRepoTests } from './utils/songDiscovery/tests/curationRepository.test.js';
import { runTests as runEcosystemAuthTests } from './utils/songDiscovery/tests/ecosystemAuth.test.js';

async function main() {
  await runTitleTests();
  await runArtistTests();
  await runLyricsTests();
  await runIdentityTests();
  await runMatcherTests();
  await runSnapshotTests();
  await runCurationRepoTests();
  await runEcosystemAuthTests();
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
