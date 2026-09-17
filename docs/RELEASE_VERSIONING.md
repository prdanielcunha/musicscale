# MusicScale release versions

MusicScale follows Semantic Versioning 2.0.0 using the release shape:

`MAJOR.MINOR.PATCH-prerelease.iteration`

The version for this feature release is **0.3.0-beta.0**.

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

Acknowledgement is stored per Firebase user on the current browser through local storage, with an in-memory fallback if storage is unavailable. No Firestore document, notification or paid service is created for release acknowledgement.

The automatic presenter is eligible only when the current `FEATURE_RELEASE` is a published feature release that has not been acknowledged by that user on the current browser. It does not open merely because an account is new, and it does not auto-open on stage/performance surfaces.

## Promotion checklist

Before any future production promotion: review the complete diff, run focused release/news/stage tests, run `npm run lint`, `npm run test:ui`, `npm run build`, run `git diff --check`, confirm package/lock version consistency and verify the release is newer than the current production version. Production promotion remains a separate, explicitly approved operation.
