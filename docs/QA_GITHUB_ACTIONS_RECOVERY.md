# GitHub Actions recovery checklist

## Current blocker

GitHub-hosted Actions jobs are currently not starting because the account reports failed recent payments or a spending-limit restriction. The failure occurs before repository steps execute, so it must not be interpreted as a code/test failure.

## Recovery acceptance

The infrastructure blocker is considered resolved only when a fresh `MusicScale QA Automation` run starts its job and reaches repository steps.

After billing/spending access is restored, run the canonical workflow and require:

- dependency install/version verification;
- TypeScript/lint;
- full Vitest UI/unit suite;
- scale release tests;
- core server release tests;
- build;
- Java 21 + Firebase Auth/Firestore Emulator;
- Playwright browser installation;
- four-browser bootstrap smoke;
- Full E2E QA Suite;
- expected test/report artifacts.

Until then, `docs/QA_FALLBACK.md` defines the temporary Vercel portable gate and its explicit limitations.
