# MusicScale release versions

MusicScale follows Semantic Versioning 2.0.0 using the release shape:

`MAJOR.MINOR.PATCH-prerelease.iteration`

The current meaningful feature release is **0.10.0-beta.0** (NestTuner integration).

## Beta rules

- Compatible feature: `0.2.0-beta.0` → `0.3.0-beta.0` (`npm run release:minor`).
- Functional fix/hotfix: `0.2.0-beta.0` → `0.2.1-beta.0` (`npm run release:patch`).
- Visual-only micro-adjustment: `0.2.1-beta.0` → `0.2.1-beta.1` (`npm run release:visual` or `npm run release:revision`).
- Next visual-only micro-adjustment: `0.2.1-beta.1` → `0.2.1-beta.2`.
- Initial stable release: `1.0.0`, only after explicit approval.
- After maturity, an incompatible major change uses the next MAJOR, for example `1.0.0` → `2.0.0`.

The release scripts update `package.json` and the root versions in `package-lock.json` together. They do not commit, deploy, merge into production, or promote a build to stable.

Legacy versions such as `0.1.5-beta` remain readable by the validator so existing production history can be compared safely; new releases use the explicit `.N` beta iteration.

## Where the installed version appears

The installed version is shown only in **Help → Version**. Navigation, the Header, the Sidebar and What’s New do not carry a permanent version label. The Help surface shows the public core version (for example `MusicScale 0.3.0`), a small localized Beta badge and the complete technical build (`0.3.0-beta.0`).

## What’s New policy

A meaningful compatible feature release updates `FEATURE_RELEASE` in `lib/appRelease.ts` with a new immutable announcement ID, release version, publication date and translation key. Its PT/EN/ES editorial copy lives in `locales/releaseNews.ts`.

Hotfixes and visual revisions keep the same meaningful feature-release ID and never auto-open the What’s New presentation. Small fixes belong in the collapsed “fixes and refinements” section.

Feature highlight cards may expose an optional deep link through `FEATURE_RELEASE.actions`. Use an internal route when the user can open the feature directly inside MusicScale; external links are reserved for a canonical companion surface. The CTA is localized and closes/acknowledges the announcement before navigation.

Acknowledgement is stored per Firebase user on the current browser through local storage, with an in-memory fallback if storage is unavailable. No Firestore document, notification or paid service is created for release acknowledgement.

The automatic presenter is eligible only when the current `FEATURE_RELEASE` is a published feature release that has not been acknowledged by that user on the current browser. It does not open merely because an account is new, and it does not auto-open on stage/performance surfaces.

## Live update detection

Every production build emits `/version.json` from the package version. Firebase Hosting serves this manifest with `no-cache,no-store,must-revalidate`, and Workbox excludes it from precache.

A running app checks the published manifest every 30 seconds while visible and immediately on load, focus, return from background and restored connectivity. A version mismatch shows the update action.

The release manifest is the **only** in-app authority for deciding whether a new version exists. The update action does not wait for `registration.update()`, `controllerchange`, `unregister()` or any other Service Worker API. It immediately performs a cache-busted navigation to the same app URL.

The PWA worker may precache versioned static assets, but it must **not precache `index.html` and must not install a navigation fallback**. Browser navigations therefore go back to Firebase Hosting and receive the current app shell. This prevents Safari/iOS from repeatedly reopening an obsolete HTML shell after a release.

The generated worker imports `/sw-migration-rescue.js`. That script performs the `network-shell-v1` migration once per browser: when a new worker first activates after this policy change, it claims legacy clients and navigates open MusicScale windows once so they leave workers that previously cached `index.html`. The migration marker is stored in its own Cache Storage entry; it does not clear authentication, IndexedDB, local storage or application data.

## Promotion checklist

Before any future production promotion: review the complete diff, run focused release/news/stage tests, run `npm run lint`, `npm run test:ui`, `npm run build`, run `git diff --check`, confirm package/lock version consistency and verify the release is newer than the current production version. Production promotion remains a separate, explicitly approved operation.
