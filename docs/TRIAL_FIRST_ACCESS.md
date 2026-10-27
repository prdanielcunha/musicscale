# Trial begins on authenticated MusicScale entry

New Hub evaluations are prepared as `pending_first_access`, without timestamps or musical data access. MusicScale confirms its authenticated bootstrap through the Hub POST `/api/v1/billing/trial/first-access`. The Hub revalidates the organization, actor, membership, app disable, owner and subscription in one transaction, then starts 168 hours using server time. Repeated entry never restarts it. Existing active/expired trials and paid contracts are untouched.

Deploy this reader before the Hub starts issuing pending evaluations. Calls happen only for the pending marker. Failure is not reported as successful bootstrap. No credentials, billing authority or database writes are introduced in MusicScale.

Validation: `tests/server/hub-trial-first-access.test.ts`, existing trial-window and workspace-guard tests, lint and build.
