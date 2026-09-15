# MusicScale release versions

Initial public beta: **0.1.0-beta**. The installed version comes from package.json, including the sidebar, release presentation and announcement.

- Beta features: 0.1.0-beta → 0.2.0-beta (npm run release:minor).
- Fixes and small refinements: 0.1.0-beta → 0.1.1-beta (npm run release:patch).
- Stable launch: 1.0.0, explicitly approved when leaving beta.
- After stability: major = incompatible/product-wide changes; minor = compatible features; patch = fixes.

These are integer segments, not decimal fractions: 0.10.0 follows 0.9.0.

Every new production release must bump the version once. A retry or redeploy of the same release keeps its version. Group approved work into one release to avoid unnecessary deployments. The commands update package.json and both root package-lock versions together; they do not commit or deploy.

For relevant features, also update FEATURE_RELEASE in lib/appRelease.ts with a new stable announcement ID, release version, publication date and translation key, and add PT/EN/ES content in locales/releaseNews.ts. Describe real functionality and how to use it. Keep the previous announcement ID on hotfixes: this prevents a new alert for every fix.

The dashboard shows a non-blocking announcement. Opening Novidades displays the release presentation. Dismissing or closing records acknowledgment per Firebase user on that browser; hook instances and other tabs synchronize. Storage failure falls back to session memory. Another device can show the announcement again. No Firestore notifications are created and no extra paid service is needed. Announcements do not automatically open over a worship/performance screen.

Before promotion: review the complete diff, run QA, confirm package/lock version consistency, and confirm the release version is newer than the last production release. Promote main → production through the existing deployment workflow; verify deployment and production smoke checks. Rollback restores the previous approved revision and its original version.
