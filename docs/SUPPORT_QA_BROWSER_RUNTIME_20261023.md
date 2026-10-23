# Support release QA browser runtime

Three main support-PR browser jobs stopped before tests at the existing eight-minute apt dependency installation limit. The Ubuntu mirror was delivering only part of 119 MB/181 additional packages before timeout; mobile Chromium completed successfully. This is an environment setup failure, not a passing application test.

Use the official Microsoft Playwright v1.62.1-noble container, pinned to the verified Microsoft registry digest sha256:dcc5531e97840b9b5e794f2814476b21571c5124a3fca2267d73041f56e7580e and matching the frozen @playwright/test 1.62.1, for qa-core bootstrap and full-e2e browser jobs. It already includes browser executables and OS dependencies. Verify exact package version and both executable paths before running tests. No matrix project, test command, assertion, timeout, emulator, report, required gate, permission, secret, production deploy or fail-fast policy is removed or relaxed. The complete QA gate still requires qa-core and all four E2E projects. Future Playwright upgrades require updating the reviewed container together.

Official guidance: https://playwright.dev/docs/ci and https://playwright.dev/docs/docker. This change affects synthetic CI execution only, not customer infrastructure or app access.

Container follow-up: retain the host runner Bash semantics explicitly, including pipefail support, and trust only the known checked-out GITHUB_WORKSPACE for Git ownership checks. No wildcard safe.directory or persistent credentials. Container startup and exact package checks were observed; full tests remain required after these environment-only corrections.
