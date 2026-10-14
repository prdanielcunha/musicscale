# Connect support entry

Both browser-to-MusicScale and MusicScale-to-Connect preserve the same transient user bearer in Authorization and X-Connect-User-Authorization, matching the established Cloud Run transport. Connect still verifies the selected token through the canonical Hub; the extra header is never authority. No credential enters a draft URL, logs or persistent storage.

The existing SupportModal keeps email support and adds a PT/EN/ES manual WhatsApp button only when VITE_CONNECT_SUPPORT_ENABLED=true. It uses current AuthContext identity/organization, obtains a transient Firebase token on explicit click and calls POST /api/v1/connect/support-draft with locale only. Account/organization changes and unmount invalidate pending results; failures close the blank popup and preserve email support. No automatic message or token persistence.

The server route sits after the existing Hub trial gate and calls only the fixed official Connect support-draft endpoint. Product is server-fixed musicscale; requested organization comes from the existing scope header and remains untrusted until Connect revalidates Hub authorization. No role/UID/product/phone/body scope override. Validates the returned manual HTTPS wa.me URL, expiry and product, strips unrelated/private fields and refuses redirects. No business rule is duplicated.

Connect#250 must be published and its SUPPORT_DRAFT_ENABLED gate enabled after authenticated metadata QA. This MusicScale flag remains disabled by default. Actual browser/Hub/Meta integration is pending; relay unit tests do not prove it. Promote this scoped slice with normal release/version/QA gates, never all unrelated main features or customer data changes.
